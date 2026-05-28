# 다락방 (DARAKBANG)

1인용 비공개 노트/문서 관리 웹앱.  
구글 드라이브 기반, GitHub Pages 호스팅.

---

## 로컬 테스트

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve . -p 8080
```

브라우저에서 `http://localhost:8080` 열기

---

## ⚠️ 배포 전 필수 설정

### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 (예: `darakbang-app`)
3. **API 및 서비스 → 라이브러리** → **Google Drive API** 활성화
4. **API 및 서비스 → OAuth 동의 화면**
   - 사용자 유형: 외부
   - 앱 이름: 다락방
   - 게시 상태: **테스트**
   - 테스트 사용자: 본인 이메일 추가
5. **API 및 서비스 → 사용자 인증 정보**
   - OAuth 2.0 클라이언트 ID 만들기
   - 앱 유형: 웹 애플리케이션
   - 승인된 JavaScript 출처:
     - `http://localhost:8080` (로컬 테스트)
     - `https://{your-username}.github.io` (배포)
   - Client ID 복사

### 2. Client ID 삽입

`js/auth.js` 파일에서 아래 줄 수정:

```javascript
// Before
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com';

// After
const CLIENT_ID = '123456789-abcdefg.apps.googleusercontent.com';
```

### 3. GitHub Pages 배포

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/{username}/darakbang.git
git push -u origin main
```

GitHub 저장소 Settings → Pages → Source: `main` branch / `/ (root)`

---

## 파일 구조

```
darakbang/
├── index.html
├── css/
│   ├── reset.css
│   ├── variables.css    # 디자인 토큰 (라이트/다크)
│   ├── layout.css
│   ├── sidebar.css
│   ├── editor.css
│   ├── blocks.css       # Toggle, Callout, Image, PageLink
│   └── components.css   # 버튼, 모달, 토스트, 이모지 피커
├── js/
│   ├── ui.js            # 공통 UI 유틸리티
│   ├── auth.js          # Google OAuth 2.0
│   ├── drive.js         # Drive API v3 레이어
│   ├── workspace.js     # 페이지 상태 관리
│   ├── editor.js        # Editor.js + 커스텀 블록
│   ├── sidebar.js       # 사이드바
│   └── app.js           # 진입점
└── assets/
    └── favicon.svg
```

---

## 지원 블록

| 블록 | 슬래시 명령어 |
|------|--------------|
| 텍스트 | `/텍스트` |
| 제목 1/2/3 | `/제목 1` |
| 체크리스트 | `/체크리스트` |
| 인용구 | `/인용구` |
| 구분선 | `/구분선` |
| 토글 | `/토글` |
| 콜아웃 | `/콜아웃` |
| 이미지 | `/이미지` |
| 하위 문서 | `/하위 문서` |

---

## 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl+S` | 현재 페이지 저장 |
| `Ctrl+B` | 굵게 |
| `Ctrl+I` | 기울임 |
| `Ctrl+U` | 밑줄 |
| `Ctrl+K` | 링크 |
| `/` | 블록 타입 선택 |

---

## 데이터 저장 위치

구글 드라이브 > `DARAKBANG/`
- `workspace.json` — 페이지 목록 및 트리 구조
- `pages/{id}.json` — 각 페이지 내용
- `images/{id}.ext` — 이미지 파일
- `settings.json` — 테마, 즐겨찾기 등
