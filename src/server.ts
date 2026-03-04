import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import dotenv from 'dotenv';
import * as pty from 'node-pty';
import os from 'os';
import url from 'url';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = Number(process.env.PORT) || 3000;
const SHELL = os.platform() === 'win32' ? 'powershell.exe' : 'zsh';
const GEMINI_CLI_PATH = process.env.GEMINI_CLI_PATH || 'gemini';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

interface Session {
  pty: pty.IPty;
  timer?: NodeJS.Timeout;
}

// 다중 세션 구조: Map<Token, Map<TabId, Session>>
const userSessions = new Map<string, Map<string, Session>>();

app.use(express.static(path.join(__dirname, '../public')));

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const ip = req.socket.remoteAddress;
  const parsedUrl = url.parse(req.url || '', true);
  const token = (parsedUrl.query.token as string) || '';
  const tabId = (parsedUrl.query.tabId as string) || 'default';

  if (AUTH_TOKEN && token !== AUTH_TOKEN) {
    ws.send('\x1b[31m[Security] 인증 토큰이 유효하지 않습니다.\x1b[0m\r\n');
    ws.close();
    return;
  }

  const isTest = process.env.NODE_ENV === 'test';
  
  // 유저의 세션 맵 가져오기
  if (!userSessions.has(token)) {
    userSessions.set(token, new Map());
  }
  const tabs = userSessions.get(token)!;
  let session = !isTest ? tabs.get(tabId) : null;

  if (session) {
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = undefined;
    }
    console.log(`[Session] 탭 재연결 (Token: ${token}, Tab: ${tabId})`);
  } else {
    const ptyProcess = pty.spawn(SHELL, [GEMINI_CLI_PATH], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: { ...process.env, TERM: 'xterm-256color' } as any,
    });
    session = { pty: ptyProcess };
    if (!isTest) tabs.set(tabId, session);
    console.log(`[Session] 새 탭 시작 (Token: ${token}, Tab: ${tabId})`);
  }

  const ptyProcess = session.pty;

  const onDataListener = (data: string) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  };
  ptyProcess.onData(onDataListener);

  ws.on('message', (message: string | Buffer) => {
    const data = message.toString();
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'resize') {
        ptyProcess.resize(parsed.cols, parsed.rows);
      }
    } catch (e) {
      ptyProcess.write(data);
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] 연결 일시 중단: ${ip} (Tab: ${tabId})`);
    if (isTest) {
      ptyProcess.kill();
      tabs.delete(tabId);
    } else if (session) {
      session.timer = setTimeout(() => {
        console.log(`[Session] 탭 만료 및 종료 (Token: ${token}, Tab: ${tabId})`);
        ptyProcess.kill();
        tabs.delete(tabId);
        if (tabs.size === 0) userSessions.delete(token);
      }, 5 * 60 * 1000);
    }
  });
});

function getLocalExternalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        addresses.push(config.address);
      }
    }
  }
  return addresses;
}

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 Gemini CLI Remote Bridge V2 실행 중');
    console.log('------------------------------------------------');
    console.log(`로컬 접속: http://localhost:${PORT}/?token=${AUTH_TOKEN}`);
    const ips = getLocalExternalIPs();
    if (ips.length > 0) {
      ips.forEach(ip => console.log(`👉 http://${ip}:${PORT}/?token=${AUTH_TOKEN}`));
    }
    console.log('------------------------------------------------\n');
  });
}

export { app, server, wss };
