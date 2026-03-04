import request from 'supertest';
import { app, server, wss } from '../server';
import WebSocket from 'ws';
import * as pty from 'node-pty';
import { AddressInfo } from 'net';

jest.setTimeout(10000);

let capturedOnData: (data: string) => void;

jest.mock('node-pty', () => ({
  spawn: jest.fn().mockImplementation(() => ({
    onData: jest.fn((cb) => { capturedOnData = cb; }),
    onExit: jest.fn(),
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
  })),
}));

describe('100% Logic Coverage Tests', () => {
  let baseUrl: string;

  beforeAll((done) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `ws://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    wss.close(() => {
      server.close(done);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('PTY 데이터가 WebSocket으로 전달되어야 함', (done) => {
    const token = process.env.AUTH_TOKEN || 'secret_password_here';
    const ws = new WebSocket(`${baseUrl}?token=${token}`);
    ws.on('open', () => {
      ws.on('message', (data) => {
        expect(data.toString()).toBe('output-from-pty');
        ws.close();
      });
      if (capturedOnData) capturedOnData('output-from-pty');
    });
    ws.on('close', () => done());
  });

  test('WebSocket 메시지가 PTY로 write 되어야 함', (done) => {
    const token = process.env.AUTH_TOKEN || 'secret_password_here';
    const ws = new WebSocket(`${baseUrl}?token=${token}`);
    ws.on('open', () => {
      ws.send('user-input');
      setTimeout(() => {
        const results = (pty.spawn as jest.Mock).mock.results;
        const mockPty = results[results.length - 1].value;
        expect(mockPty.write).toHaveBeenCalledWith('user-input');
        ws.close();
      }, 100);
    });
    ws.on('close', () => done());
  });

  test('인증 실패 시 에러 메시지 전송 및 연결 종료', (done) => {
    const ws = new WebSocket(`${baseUrl}?token=wrong`);
    ws.on('message', (data) => {
        expect(data.toString()).toContain('인증 토큰이 유효하지 않습니다');
    });
    ws.on('close', () => done());
  });
});
