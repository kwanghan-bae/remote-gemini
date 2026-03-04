# 📱 Gemini CLI Remote Control Bridge V2
### "내 손안의 강력한 AI 개발 스테이션"

이 프로젝트는 [클로드 코드(Claude Code) 원격 제어 가이드](https://adim.in/p/remote-control-claude-code/)의 철학을 계승하여, 안드로이드 및 iOS 환경에서 로컬 PC의 Gemini CLI를 완벽하게 제어할 수 있도록 고도화된 V2 버전입니다.

---

## 🌟 V2 주요 업데이트 (New Features)

1. **완벽한 PWA 지원**: 브라우저 주소창 없이 전용 앱처럼 전체 화면으로 터미널을 사용할 수 있습니다.
2. **다중 탭(Multi-Tab) 시스템**: 여러 개의 터미널 세션을 동시에 열고 자유롭게 전환하며 작업할 수 있습니다.
3. **모바일 가상 키보드 툴바**: 스마트폰 기본 키보드에 없는 `ESC`, `Tab`, `Ctrl+C`, `방향키`를 원터치로 입력할 수 있습니다.
4. **강화된 보안 (Secure Mode)**: Rate Limiting을 통해 무차별 대입 공격을 차단하고, 상세 보안 로깅을 지원합니다.

---

## 📲 스마트폰 설치 및 사용 가이드

### 1. 전용 앱으로 설치하기 (PWA)
- **Android (Chrome)**: 주소창 우측의 메뉴(⋮)를 누르고 `앱 설치` 또는 `홈 화면에 추가`를 클릭하세요.
- **iOS (Safari)**: 하단의 공유 버튼을 누르고 `홈 화면에 추가`를 클릭하세요.
- 이제 홈 화면에 생성된 아이콘을 통해 **전체 화면 터미널**을 즐길 수 있습니다.

### 2. 가상 키보드 툴바 활용
- 터미널 하단의 툴바 버튼을 통해 특수 키를 즉시 입력할 수 있습니다.
- 안드로이드 유저라면 **Hacker's Keyboard**와 병행하여 더욱 강력한 입력을 경험해 보세요.

### 3. 다중 탭 활용하기
- 상단의 `+` 버튼을 눌러 새 세션을 추가할 수 있습니다.
- 백그라운드에서 긴 작업을 실행해 두고, 새 탭을 열어 다른 작업을 동시에 진행할 수 있습니다.

---

## 🛠️ 서버 설정 및 실행

### .env 설정
```env
PORT=3000
AUTH_TOKEN=복잡한_비밀번호_입력
GEMINI_CLI_PATH=gemini
```

### 실행 방법
```bash
npm install
npm run build
npm start
```

서버가 시작되면 접속 가능한 **로컬 및 외부 IP 주소**가 자동으로 출력됩니다. 스마트폰에서 해당 주소를 입력하여 바로 시작하세요!

---

## 🏗️ 시스템 아키텍처 (V2)
```text
[ Browser PWA ] <---(Secure WebSocket)---> [ Node.js V2 Server ] <---(Multi-PTY)---> [ Gemini CLI x N ]
      ↑                                           ↑                                      ↑
(Toolbar / Tabs)                         (Rate Limit / Auth)                      (Session Buffer)
```

---
Developed with ❤️ by Gemini CLI Agent.  
Inspired by [Remote Control Claude Code](https://adim.in/p/remote-control-claude-code/).
