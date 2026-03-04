# 📱 Gemini CLI Remote Control Bridge
### "내 스마트폰에서 제어하는 나만의 AI 개발 비서"

이 프로젝트는 [클로드 코드(Claude Code) 원격 제어 가이드](https://adim.in/p/remote-control-claude-code/)의 철학을 그대로 계승하여 구현되었습니다. **Mosh**의 끊김 없는 연결성과 **tmux**의 세션 유지 능력을 웹 기술로 재해석하여, 안드로이드 폰에서 가장 완벽한 Gemini CLI 경험을 제공합니다.

---

## 🌟 이 프로젝트의 핵심 가치 (Why?)

1. **"Steering" (원격 개입)**: PC에서 Gemini에게 긴 작업을 시켜두고 외출하셨나요? 폰으로 접속해서 Gemini의 질문에 답하거나(Y/N), 진행 상황을 실시간으로 확인하고 개입할 수 있습니다.
2. **세션 유지 (Persistence)**: 스마트폰의 네트워크가 잠시 끊기거나 브라우저를 닫아도 작업은 죽지 않습니다. 다시 접속하면 이전 화면 그대로 이어집니다. (서버에서 5분간 세션 유지)
3. **완벽한 터미널 재현**: `node-pty`를 사용하여 로컬 터미널의 ANSI 색상, 진행 바, 대화형 프롬프트를 100% 동일하게 스마트폰 브라우저에 뿌려줍니다.

---

## 🛠️ 안드로이드 최적화 설정

### 1. 터치 스크롤 및 마우스 모드
- `xterm.js` 설정을 통해 안드로이드 폰에서 터치로 터미널 스크롤이 가능하며, 긴 코드 로그를 확인하기 편리합니다.

### 2. 홈 화면에 추가 (PWA 스타일)
- 크롬 브라우저에서 '홈 화면에 추가'를 하면, 주소창 없는 **전체 화면 터미널**로 사용할 수 있습니다.

### 3. 추천 키보드
- 스마트폰 기본 키보드로는 `Ctrl`, `Tab` 입력이 어렵습니다. 안드로이드 유저라면 **Hacker's Keyboard** (무료) 설치를 강력 추천합니다.

---

## 📲 상세 연결 가이드

### 단계 1: 서버 실행 (PC)
```bash
npm run build
npm start
```

### 단계 2: 스마트폰 접속
주소창에 다음과 같이 입력하세요:
`http://[PC아이피]:3000/?token=[내비밀번호]`

> **Tip!** 외부망(LTE/5G)에서 접속하고 싶다면, 원문 필자가 추천한 **Tailscale**을 설치하거나 **Cloudflare Tunnels**를 사용하세요. 가장 안전하고 빠릅니다.

---

## 🏗️ 시스템 아키텍처
```text
[ Browser ] --(WebSocket + SSL)--> [ Bridge Server ] --(PTY)--> [ Gemini CLI ]
    ↑                                   ↑                         ↑
(Session Recovery)                (5-Min Buffer)            (Interactive Mode)
```

이 시스템은 단순한 텍스트 전달자가 아닙니다. 로컬 PC의 터미널 환경 자체를 웹소켓으로 '중계'하여 스마트폰을 강력한 개발 스테이션으로 변모시킵니다.

---
Developed with ❤️ by Gemini CLI Agent.  
Inspired by [Remote Control Claude Code](https://adim.in/p/remote-control-claude-code/).
