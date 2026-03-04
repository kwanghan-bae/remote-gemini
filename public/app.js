/** 터미널이 렌더링될 DOM 컨테이너입니다. */
const terminalContainer = document.getElementById('terminal-container');
/** 탭 버튼들이 배치될 DOM 컨테이너입니다. */
const tabsContainer = document.getElementById('tabs');
/** 새 탭을 추가하는 버튼입니다. */
const addTabButton = document.getElementById('add-tab');

/** 현재 접속 프로토콜 (ws 또는 wss)을 결정합니다. */
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
/** URL 쿼리 파라미터를 파싱합니다. */
const urlParams = new URLSearchParams(window.location.search);
/** 인증을 위한 토큰 값입니다. */
const token = urlParams.get('token') || '';

/** 생성된 모든 탭 인스턴스들을 관리하는 배열입니다. */
let tabs = [];
/** 현재 화면에 활성화된 탭의 고유 ID입니다. */
let activeTabId = null;

/**
 * 개별 터미널 탭 세션을 관리하는 클래스입니다.
 * xterm.js 인스턴스와 WebSocket 연결을 독립적으로 관리합니다.
 */
class Tab {
  /**
   * 탭 인스턴스를 초기화하고 터미널 UI를 생성합니다.
   * @param {string} id - 탭의 고유 식별자
   */
  constructor(id) {
    this.id = id;
    this.term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: { background: '#000000' },
      mouseEvents: true,
    });
    this.fitAddon = new FitAddon.FitAddon();
    this.term.loadAddon(this.fitAddon);

    this.container = document.createElement('div');
    this.container.className = 'terminal-instance';
    this.container.style.display = 'none';
    this.container.style.height = '100%';
    terminalContainer.appendChild(this.container);

    this.term.open(this.container);
    this.fitAddon.fit();

    // 모바일 최적화: 터치 시 강제 포커스 및 키보드 활성화
    const textarea = this.term.textarea;
    if (textarea) {
      textarea.setAttribute('autocorrect', 'off');
      textarea.setAttribute('autocapitalize', 'none');
      textarea.setAttribute('spellcheck', 'false');
    }

    this.container.addEventListener('touchstart', () => {
      this.term.focus();
    });

    this.button = document.createElement('button');
    this.button.className = 'tab';
    this.button.innerText = `Tab ${id.substring(0, 4)}`;
    this.button.onclick = () => switchTab(id);
    tabsContainer.appendChild(this.button);

    this.connect();
    this.setupInput();
  }

  /**
   * 백엔드 브릿지 서버와 WebSocket 연결을 수립합니다.
   */
  connect() {
    const wsUrl = `${protocol}//${window.location.host}?token=${token}&tabId=${this.id}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.term.write('\x1b[32m[System] 연결됨\x1b[0m\r\n');
      this.sendResize();
    };

    this.socket.onmessage = (event) => {
      this.term.write(event.data);
    };

    this.socket.onclose = () => {
      this.term.write('\r\n\x1b[33m[System] 연결 끊김. 재연결 중...\x1b[0m\r\n');
      setTimeout(() => this.connect(), 3000);
    };
  }

  /**
   * 터미널 키보드 입력을 WebSocket을 통해 서버로 전달하도록 설정합니다.
   */
  setupInput() {
    this.term.onData((data) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(data);
      }
    });
  }

  /**
   * 현재 터미널의 행/열 크기를 서버의 PTY 프로세스에 전달합니다.
   */
  sendResize() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'resize',
          cols: this.term.cols,
          rows: this.term.rows,
        }),
      );
    }
  }

  /**
   * 탭을 화면에 표시하고 포커스를 맞춥니다.
   */
  show() {
    this.container.style.display = 'block';
    this.button.classList.add('active');
    this.fitAddon.fit();
    this.term.focus();
    this.sendResize();
  }

  /**
   * 탭을 화면에서 숨깁니다.
   */
  hide() {
    this.container.style.display = 'none';
    this.button.classList.remove('active');
  }
}

/**
 * 지정된 ID를 가진 탭으로 화면을 전환합니다.
 * @param {string} id - 전환할 탭의 ID
 */
function switchTab(id) {
  tabs.forEach((tab) => {
    if (tab.id === id) {
      tab.show();
      activeTabId = id;
    } else {
      tab.hide();
    }
  });
}

/**
 * 새로운 터미널 탭을 생성하고 활성화합니다.
 */
function createTab() {
  const id = Math.random().toString(36).substring(7);
  const newTab = new Tab(id);
  tabs.push(newTab);
  switchTab(id);
}

// 툴바 키 매핑
const keys = {
  ESC: '\x1b',
  TAB: '\t',
  CTRL_C: '\x03',
  UP: '\x1b[A',
  DOWN: '\x1b[B',
  LEFT: '\x1b[D',
  RIGHT: '\x1b[C',
};

document.querySelectorAll('.key').forEach((button) => {
  button.onclick = (e) => {
    const key = e.target.getAttribute('data-key');
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && keys[key] && activeTab.socket.readyState === WebSocket.OPEN) {
      activeTab.socket.send(keys[key]);
      activeTab.term.focus();
    }
  };
});

window.addEventListener('resize', () => {
  tabs.forEach((tab) => tab.fitAddon.fit());
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab) activeTab.sendResize();
});

addTabButton.onclick = createTab;

// 초기 탭 생성
createTab();
