// xterm.js 설정 (안드로이드 터치 지원 최적화)
const term = new Terminal({
  cursorBlink: true,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
  theme: {
    background: '#000000',
  },
  allowTransparency: true,
  screenReaderMode: true, // 모바일 접근성 지원
  mouseEvents: true, // 분석된 페이지의 tmux -g mouse on에 대응
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

// WebSocket 설정
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token') || '';
const wsUrl = `${protocol}//${window.location.host}?token=${token}`;

let socket;
let reconnectAttempts = 0;
const maxReconnectDelay = 30000;

function connect() {
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('WebSocket 연결 성공 (세션 유지 모드)');
    reconnectAttempts = 0;
    term.write('\x1b[32m[System] 연결되었습니다. (기존 세션이 있다면 복구됩니다)\x1b[0m\r\n');
    
    // 초기 터미널 크기 전송
    socket.send(
      JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }),
    );
  };

  socket.onmessage = (event) => {
    term.write(event.data);
  };

  socket.onclose = (event) => {
    if (event.code === 1000 || event.code === 1008) {
      term.write('\r\n\x1b[31m[System] 인증 오류. 재연결 안함.\x1b[0m\r\n');
      return;
    }
    // Mosh와 유사한 자동 재연결 경험 제공
    term.write('\r\n\x1b[33m[System] 연결 중단. 네트워크 확인 중...\x1b[0m\r\n');
    attemptReconnect();
  };
}

function attemptReconnect() {
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), maxReconnectDelay);
  setTimeout(connect, delay);
}

// 터미널 입력 -> PTY
term.onData((data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(data);
  }
});

// 리사이즈 처리
window.addEventListener('resize', () => {
  fitAddon.fit();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }),
    );
  }
});

connect();
