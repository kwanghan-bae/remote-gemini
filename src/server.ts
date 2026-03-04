import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import dotenv from 'dotenv';
import * as pty from 'node-pty';
import os from 'os';
import url from 'url';
import rateLimit from 'express-rate-limit';
import { execSync } from 'child_process';
import fs from 'fs';

dotenv.config();

const app = express();

/**
 * 보안을 위한 Rate Limit 설정: 15분 동안 IP당 최대 100회 요청으로 제한하여 무차별 대입 공격을 방지합니다.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
});

app.use(limiter);
app.use(express.static(path.join(__dirname, '../public')));

/**
 * HTTP 서버 인스턴스: Express 앱을 기반으로 생성하며 WebSocket 서버와 공유합니다.
 */
const server = http.createServer(app);

/**
 * WebSocket 서버 인스턴스: 클라이언트와의 실시간 양방향 통신 및 터미널 스트리밍을 담당합니다.
 */
const wss = new WebSocketServer({ server });

/**
 * 서버 포트 설정: 환경 변수(PORT)를 우선하며 기본값은 3000입니다.
 */
const PORT = Number(process.env.PORT) || 3000;

/**
 * 실행 쉘 설정: OS에 따라 Windows는 powershell, 나머지는 zsh(또는 기본 쉘)을 사용합니다.
 */
const SHELL = os.platform() === 'win32' ? 'powershell.exe' : 'zsh';

/**
 * Gemini CLI 실행 경로 자동 탐색 및 검증 함수:
 * 시스템 PATH를 전수 조사하고 실제 실행 가능 여부를 확인합니다.
 */
export function getVerifiedGeminiPath(): string {
  // 1. .env 설정 우선
  if (process.env.GEMINI_CLI_PATH && fs.existsSync(process.env.GEMINI_CLI_PATH)) {
    return process.env.GEMINI_CLI_PATH;
  }

  // 2. 시스템 명령어(which/where)로 탐색
  try {
    const lookupCmd = os.platform() === 'win32' ? 'where gemini' : 'which gemini';
    const foundPath = execSync(lookupCmd, { encoding: 'utf8' }).trim().split('\n')[0];
    if (foundPath && fs.existsSync(foundPath)) return foundPath;
  } catch (e) {
    // lookup 실패 시 계속 진행
  }

  // 3. 일반적인 npm 전역 설치 경로 추론 (nvm 포함)
  const commonPaths = [
    '/usr/local/bin/gemini',
    '/opt/homebrew/bin/gemini',
    path.join(os.homedir(), '.npm-global/bin/gemini'),
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  // 4. 마지막 보루: 환경 변수 무시하고 명령어만 반환
  return 'gemini';
}

const GEMINI_CLI_PATH = getVerifiedGeminiPath();

/**
 * 서버 시작 전 CLI 가용성 최종 검증 함수입니다.
 */
export function verifyCliReady() {
  try {
    execSync(`${GEMINI_CLI_PATH} --help`, { stdio: 'ignore' });
    console.log(`✅ Gemini CLI 탐색 완료: ${GEMINI_CLI_PATH}`);
  } catch (e) {
    console.warn(`⚠️ 경고: '${GEMINI_CLI_PATH}' 명령어를 실행할 수 없습니다.`);
    console.warn(`명령어 'npm install -g @google/gemini-cli'로 설치되어 있는지 확인하세요.\n`);
  }
}

/**
 * 인증 토큰: 외부 접근을 제어하기 위한 비밀번호입니다. .env 파일에서 설정합니다.
 */
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

interface Session {
  pty: pty.IPty;
  timer?: NodeJS.Timeout;
}

/**
 * 다중 세션 관리 맵: 토큰과 탭 ID를 조합하여 유저별/탭별 독립적인 PTY 프로세스를 관리합니다.
 */
const userSessions = new Map<string, Map<string, Session>>();

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const ip = req.socket.remoteAddress;
  const parsedUrl = url.parse(req.url || '', true);
  const token = (parsedUrl.query.token as string) || '';
  const tabId = (parsedUrl.query.tabId as string) || 'default';

  if (AUTH_TOKEN && token !== AUTH_TOKEN) {
    console.warn(`[Security] 유효하지 않은 토큰 접근 차단 (IP: ${ip}, Tab: ${tabId})`);
    ws.send('\x1b[31m[Security] 인증 토큰이 유효하지 않습니다.\x1b[0m\r\n');
    ws.close(1008, 'Policy Violation');
    return;
  }

  const isTest = process.env.NODE_ENV === 'test';

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
    console.log(
      `[Session] 탭 재연결 (Token: ${token.substring(0, 4)}***, Tab: ${tabId}, IP: ${ip})`,
    );
  } else {
    try {
      const ptyProcess = pty.spawn(SHELL, [GEMINI_CLI_PATH], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color' } as any,
      });
      session = { pty: ptyProcess };
      if (!isTest) tabs.set(tabId, session);
      console.log(
        `[Session] 새 탭 시작 (Token: ${token.substring(0, 4)}***, Tab: ${tabId}, IP: ${ip})`,
      );
    } catch (err) {
      console.error(`[PTY] 프로세스 생성 실패: ${err}`);
      ws.send('\x1b[31m[System] 내부 서버 오류로 프로세스를 시작할 수 없습니다.\x1b[0m\r\n');
      ws.close();
      return;
    }
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

  ws.on('close', (code, reason) => {
    console.log(
      `[WebSocket] 연결 종료 (IP: ${ip}, Tab: ${tabId}, Code: ${code}, Reason: ${reason})`,
    );
    if (isTest) {
      ptyProcess.kill();
      tabs.delete(tabId);
    } else if (session) {
      session.timer = setTimeout(
        () => {
          console.log(
            `[Session] 세션 만료 및 정리 (Token: ${token.substring(0, 4)}***, Tab: ${tabId})`,
          );
          ptyProcess.kill();
          tabs.delete(tabId);
          if (tabs.size === 0) userSessions.delete(token);
        },
        5 * 60 * 1000,
      );
    }
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] 에러 발생 (IP: ${ip}): ${err.message}`);
  });
});

/**
 * 로컬 네트워크의 외부 IP 주소들을 추출하여 스마트폰 접속을 돕는 유틸리티 함수입니다.
 */
export function getLocalExternalIPs() {
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
    console.log('\n🛡️ Gemini CLI Remote Bridge V2 (Secure Mode)');
    console.log('------------------------------------------------');
    verifyCliReady();
    console.log(`로컬 접속: http://localhost:${PORT}/?token=${AUTH_TOKEN}`);

    const ips = getLocalExternalIPs();
    if (ips.length > 0) {
      ips.forEach((ip) => console.log(`👉 http://${ip}:${PORT}/?token=${AUTH_TOKEN}`));
    }
    console.log('------------------------------------------------\n');
  });
}

export { app, server, wss };
