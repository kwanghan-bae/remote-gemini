const terminalContainer = document.getElementById('terminal-container');
const tabsContainer = document.getElementById('tabs');
const addTabButton = document.getElementById('add-tab');

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token') || '';

let tabs = [];
let activeTabId = null;

class Tab {
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
    
    this.button = document.createElement('button');
    this.button.className = 'tab';
    this.button.innerText = `Tab ${id.substring(0, 4)}`;
    this.button.onclick = () => switchTab(id);
    tabsContainer.appendChild(this.button);
    
    this.connect();
    this.setupInput();
  }

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

  setupInput() {
    this.term.onData((data) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(data);
      }
    });
  }

  sendResize() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'resize',
        cols: this.term.cols,
        rows: this.term.rows,
      }));
    }
  }

  show() {
    this.container.style.display = 'block';
    this.button.classList.add('active');
    this.fitAddon.fit();
    this.term.focus();
    this.sendResize();
  }

  hide() {
    this.container.style.display = 'none';
    this.button.classList.remove('active');
  }
}

function switchTab(id) {
  tabs.forEach(tab => {
    if (tab.id === id) {
      tab.show();
      activeTabId = id;
    } else {
      tab.hide();
    }
  });
}

function createTab() {
  const id = Math.random().toString(36).substring(7);
  const newTab = new Tab(id);
  tabs.push(newTab);
  switchTab(id);
}

// 툴바 키 매핑
const keys = {
  'ESC': '\x1b',
  'TAB': '\t',
  'CTRL_C': '\x03',
  'UP': '\x1b[A',
  'DOWN': '\x1b[B',
  'LEFT': '\x1b[D',
  'RIGHT': '\x1b[C'
};

document.querySelectorAll('.key').forEach(button => {
  button.onclick = (e) => {
    const key = e.target.getAttribute('data-key');
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && keys[key] && activeTab.socket.readyState === WebSocket.OPEN) {
      activeTab.socket.send(keys[key]);
      activeTab.term.focus();
    }
  };
});

window.addEventListener('resize', () => {
  tabs.forEach(tab => tab.fitAddon.fit());
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) activeTab.sendResize();
});

addTabButton.onclick = createTab;

// 초기 탭 생성
createTab();
