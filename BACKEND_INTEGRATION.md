# 백엔드 연동 가이드

## 환경 설정

`.env.local` 파일을 수정하여 백엔드 API URL을 설정하세요:

```bash
# 로컬 개발 (Mock API)
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# 실제 백엔드 서버
NEXT_PUBLIC_API_URL=http://localhost:8000
# 또는
NEXT_PUBLIC_API_URL=https://your-backend-api.com
```

## API 엔드포인트

### 인증
- `POST /auth/signup` - 회원가입
- `POST /auth/signin` - 로그인
- `POST /auth/logout` - 로그아웃

### 회의
- `GET /meetings/current` - 현재 활성 회의 조회
- `GET /meetings/{id}` - 특정 회의 조회
- `GET /meetings` - 회의 목록 (with pagination)
- `POST /meetings/start` - 회의 시작
- `POST /meetings/{id}/end` - 회의 종료
- `DELETE /meetings/{id}` - 회의 삭제
- `GET /meetings/{id}/subject` - 회의의 현재 주제

### 주제
- `GET /subjects` - 주제 목록 (with pagination)
- `POST /subjects/select` - 주제 선택
- `DELETE /subjects/{id}` - 주제 삭제

### 채팅
- `POST /chats/messages` - 메시지 전송
- `POST /chats/messages/{messageId}/answer` - AI 답변 요청
- `GET /chats/{chatId}/messages` - 채팅 히스토리

## 백엔드 연동 체크리스트

- [ ] `.env.local`에서 `NEXT_PUBLIC_API_URL` 설정
- [ ] 백엔드 서버 실행 확인
- [ ] CORS 설정 확인
- [ ] 인증 토큰 헤더 형식 확인 (`Authorization: Bearer {token}`)
- [ ] API 응답 형식이 프론트엔드와 일치하는지 확인

## 개발 서버 재시작

환경 변수 변경 후 개발 서버를 재시작하세요:

```bash
npm run dev
```
