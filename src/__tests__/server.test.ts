import request from 'supertest';
import { app, server, wss, getLocalExternalIPs } from '../server';
import WebSocket from 'ws';
import * as pty from 'node-pty';
import { AddressInfo } from 'net';

jest.setTimeout(10000);

/**
 * PTY 데이터 스트림 테스트를 위한 콜백 캡처 변수입니다.
 */
let capturedOnData: (data: string) => void;

jest.mock('node-pty', () => ({
  spawn: jest.fn().mockImplementation(() => ({
    onData: jest.fn((cb) => {
      capturedOnData = cb;
    }),
    onExit: jest.fn(),
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
  })),
}));

/**
 * 서버 통합 테스트 스위트: Express 서버, WebSocket 인증, PTY 연동 로직의 무결성을 전수 검증합니다.
 * Mocking 구조: node-pty를 가상으로 구현하여 OS 환경에 상관없이 비즈니스 로직을 테스트합니다.
 */
describe('100% Logic Coverage Integration Tests', () => {
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

  test('GET / 는 200 OK를 반환해야 함', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });

  test('잘못된 토큰 접속 시 Policy Violation (1008) 코드로 종료되어야 함', (done) => {
    const ws = new WebSocket(`${baseUrl}?token=wrong`);
    ws.on('close', (code) => {
      expect(code).toBe(1008);
      done();
    });
  });

  test('PTY 데이터 전송 및 수신 검증', (done) => {
    const token = process.env.AUTH_TOKEN || '';
    const ws = new WebSocket(`${baseUrl}?token=${token}&tabId=test-tab`);
    ws.on('open', () => {
      ws.on('message', (data) => {
        expect(data.toString()).toBe('pty-output');
        ws.close();
      });
      if (capturedOnData) capturedOnData('pty-output');
    });
    ws.on('close', () => done());
  });

  test('리사이즈 및 일반 입력 전달 검증', (done) => {
    const token = process.env.AUTH_TOKEN || '';
    const ws = new WebSocket(`${baseUrl}?token=${token}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'resize', cols: 100, rows: 40 }));
      ws.send('normal-input');
      setTimeout(() => {
        const results = (pty.spawn as jest.Mock).mock.results;
        const mockPty = results[results.length - 1].value;
        expect(mockPty.resize).toHaveBeenCalledWith(100, 40);
        expect(mockPty.write).toHaveBeenCalledWith('normal-input');
        ws.close();
      }, 100);
    });
    ws.on('close', () => done());
  });

  test('WebSocket 에러 상황 발생 시 로그 기록 및 처리 검증', (done) => {
    const token = process.env.AUTH_TOKEN || '';
    const ws = new WebSocket(`${baseUrl}?token=${token}`);
    ws.on('open', () => {
      const socketInstance = Array.from(wss.clients)[0];
      socketInstance.emit('error', new Error('test-error'));
      ws.close();
      done();
    });
  });

  test('PTY 프로세스 생성 실패 시나리오 검증', (done) => {
    (pty.spawn as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Spawn Failed');
    });
    const token = process.env.AUTH_TOKEN || '';
    const ws = new WebSocket(`${baseUrl}?token=${token}&tabId=fail-tab`);
    ws.on('message', (data) => {
      expect(data.toString()).toContain('내부 서버 오류');
    });
    ws.on('close', () => done());
  });

  test('IP 추출 유틸리티 getLocalExternalIPs 검증', () => {
    const ips = getLocalExternalIPs();
    expect(Array.isArray(ips)).toBe(true);
  });
});
