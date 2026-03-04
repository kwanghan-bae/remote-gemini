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

const sessionMap = new Map<string, { pty: pty.IPty, timer?: NodeJS.Timeout }>();

app.use(express.static(path.join(__dirname, '../public')));

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const parsedUrl = url.parse(req.url || '', true);
  const token = (parsedUrl.query.token as string) || '';

  if (AUTH_TOKEN && token !== AUTH_TOKEN) {
    ws.send('\x1b[31m[Security] 인증 토큰이 유효하지 않습니다.\x1b[0m\r\n');
    ws.close();
    return;
  }

  // 테스트 환경에서는 세션 유지를 하지 않음 (독립성 보장)
  const isTest = process.env.NODE_ENV === 'test';
  let session = !isTest ? sessionMap.get(token) : null;

  if (session) {
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = undefined;
    }
  } else {
    const ptyProcess = pty.spawn(SHELL, [GEMINI_CLI_PATH], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: { ...process.env, TERM: 'xterm-256color' } as any,
    });
    session = { pty: ptyProcess };
    if (!isTest) sessionMap.set(token, session);
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
    if (isTest) {
      ptyProcess.kill();
    } else if (session) {
      session.timer = setTimeout(() => {
        ptyProcess.kill();
        sessionMap.delete(token);
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
    console.log('\n🚀 Gemini CLI Remote Bridge 실행 완료!');
    console.log('------------------------------------------------');
    console.log(`로컬 접속: http://localhost:${PORT}/?token=${AUTH_TOKEN}`);
    const ips = getLocalExternalIPs();
    if (ips.length > 0) {
      console.log('\n📱 스마트폰 접속 주소:');
      ips.forEach(ip => console.log(`👉 http://${ip}:${PORT}/?token=${AUTH_TOKEN}`));
    }
    console.log('------------------------------------------------\n');
  });
}

export { app, server, wss };
