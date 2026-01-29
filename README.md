# school

NEIS Open API를 이용해 **시간표/급식**을 보여주는 간단한 정적 웹앱이야.  
HTML/CSS/JavaScript만 사용했고, 별도 빌드/서버 없이 실행 가능해.

## 실행 방법

- `index.html`을 더블클릭해서 브라우저로 열면 됨
- 또는 VSCode/Cursor의 Live Server 확장으로 열어도 됨

## 기능

- **지역(교육청) 선택**
- **학교 유형 선택**: 초/중/고
- **학교명 검색 → 학교 선택(학교코드 자동)**
- **날짜 선택(캘린더 input)**
- **시간표 먼저 표시**, 아래에서 **급식 펼쳐보기**
- **학년 선택 + 반(학급) 숫자 입력**
- **로그인 후 즐겨찾기(학교/학년/반) 저장/불러오기/삭제**
- **오늘로 이동 버튼**
- **반응형 UI**
- **다크모드 토글(저장)**
- **Firebase 회원가입/로그인/로그아웃**

## 사용 API

- 급식: `mealServiceDietInfo` (KEY: 제공 키 사용)
- 시간표: `elsTimetable` / `misTimetable` / `hisTimetable` (각각 제공 키 사용)
- 학교검색: `schoolInfo` (학교코드 얻기)

## Firebase 설정(중요)

이 프로젝트는 브라우저에서 Firebase를 직접 호출합니다.

- 인증: Email/Password를 사용하며, UI에서는 **아이디/비밀번호** 형태로 입력받습니다.
  - 아이디가 이메일 형식이 아니면 내부적으로 `아이디@school-login.local` 형태로 변환해 저장합니다.
- 즐겨찾기 저장 위치: Firestore `users/{uid}` 문서의 `favorites` 배열

Firestore 보안 규칙 예시(권장):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```


