# 머니 서바이벌 (Money Survival)

다연쌤이 진행하고 학생들이 실시간으로 참여하는 금융교육 게임.
Vite + React 로 만들어졌고, 실시간 동기화는 **Firebase Realtime Database** 를 사용합니다.

## 빠른 시작

```bash
npm install
cp .env.example .env   # 그리고 .env 안의 값을 Firebase 설정으로 채우기
npm run dev            # http://localhost:5173
```

## 1. Firebase 준비 (한 번만)

1. https://console.firebase.google.com 에서 **새 프로젝트 생성**.
2. 좌측 메뉴 **빌드 > Realtime Database > 데이터베이스 만들기** 클릭.
   - 위치는 아무거나(예: asia-southeast1), 규칙은 우선 **테스트 모드**로 시작.
3. 좌측 상단 **프로젝트 설정(톱니) > 일반 > 내 앱**에서 **웹 앱(</>)** 추가.
4. 표시되는 `firebaseConfig` 값을 `.env` 에 옮겨 적기:
   - `apiKey` → `VITE_FB_API_KEY`
   - `authDomain` → `VITE_FB_AUTH_DOMAIN`
   - `databaseURL` → `VITE_FB_DATABASE_URL` (Realtime Database 페이지 상단 URL)
   - `projectId` → `VITE_FB_PROJECT_ID`
   - `appId` → `VITE_FB_APP_ID`

### Realtime Database 보안 규칙

수업 중에만 잠깐 열어두는 가장 단순한 형태(누구나 읽기/쓰기):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ 이 규칙은 링크를 아는 누구나 데이터를 읽고 쓸 수 있습니다.
수업이 끝나면 규칙을 `false`로 닫거나, 날짜 만료 조건을 넣는 것을 권장합니다.
예) 특정 날짜까지만 허용:

```json
{
  "rules": {
    ".read": "now < 1893456000000",
    ".write": "now < 1893456000000"
  }
}
```

## 2. 게임 흐름

- 학생: **🎓 수업 참여** → 이름 입력 → 직업 카드 뽑기 → 월급 분산투자 → "투자 완료" 후 대기
- 다연쌤: **🖥️ 다연쌤 화면** → 실시간 현황판에서 모두 완료 확인 → **속보 띄우기** → 결과 → **다음 달**
- 마지막에 **게임 종료**를 누르면 🏆 최종 순위(시상대 + 효도왕) 발표

모두가 **같은 배포 주소**에 접속해야 동기화됩니다.

## 3. 배포

빌드:

```bash
npm run build   # dist/ 폴더 생성
```

- **Vercel / Netlify**: 깃허브에 올린 뒤 연결하면 자동 빌드.
  환경변수(`VITE_FB_*`)를 배포 플랫폼 설정에도 똑같이 넣어주세요.
- 정적 호스팅이라면 `dist/` 폴더만 올리면 됩니다.

## 4. 구조

```
src/
  App.jsx      게임 전체 (UI/로직). 저장은 storage.js 함수만 호출.
  storage.js   sGet/sSet/sList/sDel — Firebase RTDB 어댑터
  firebase.js  Firebase 초기화
  main.jsx     진입점
```

동기화 방식을 바꾸고 싶으면 **storage.js 4개 함수만** 교체하면 됩니다.
(원래 Claude 아티팩트의 window.storage 도 이 4개 함수 형태였습니다.)

## 5. 다음에 해볼 만한 개선

- **반(room) 코드**: 여러 반이 동시에 쓰면 데이터가 섞입니다.
  키 앞에 방 코드를 붙이면(`rooms/<code>/game`, `rooms/<code>/players/...`) 분리됩니다.
- **폴링 → 실시간 리스너**: 지금은 1.5~2초 폴링. Firebase `onValue`로 바꾸면 즉시 반영 + 읽기 비용 절감.
- 시상대 연출 강화, 속보 추가/수정.
