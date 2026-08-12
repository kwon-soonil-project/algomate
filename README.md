# AlgoMate

팀을 만들고, 주차별 알고리즘 문제를 등록하고, 코드를 작성하며 서로 피드백하는 스터디 서비스입니다.

## 포함된 MVP

- 이메일 회원가입·로그인(Supabase Auth)
- 스터디 생성, 초대 코드 발급 및 참여
- 내 스터디 사이드바와 진행 현황 대시보드
- 주차·마감일·문제 링크 관리
- Monaco 기반 코드 에디터, 자동 저장, 언어 선택
- 팀원 코드 즉시 열람 및 실시간 갱신
- 풀이 설명, 복잡도, 피드백·질문 댓글
- 기존 GitHub 저장소의 `week01/문제/이름.java` 코드 일괄 가져오기
- GitHub 원본 파일 링크와 반복 동기화
- 팀 데이터 격리를 위한 전체 RLS 정책
- Supabase 설정 전에도 모든 흐름을 확인할 수 있는 로컬 데모 모드

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

환경변수가 없으면 데모 모드로 실행됩니다. 로그인 화면에 미리 채워진 체험 계정을 그대로 사용하세요.

## Supabase 연결

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/migrations/202608120001_initial_schema.sql`을 실행합니다.
3. Authentication → URL Configuration에 로컬과 배포 주소를 등록합니다.
4. `.env.example`을 참고해 `.env.local`을 만들고 Project URL과 anon key를 넣습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

브라우저에 노출되는 anon key는 RLS 사용을 전제로 한 공개 키입니다. `service_role` 키는 이 프로젝트나 Vercel의 공개 환경변수에 넣지 마세요.

## 기존 GitHub 스터디 저장소 가져오기

스터디 화면의 **GitHub 가져오기**에서 아래 구조를 자동 인식합니다.

```text
week01/
  swea1529/
    minji.java
    junho.java
week02/
  boj1260/
    minji.java
```

공개 저장소는 URL과 브랜치만 입력하면 됩니다. 비공개 저장소는 GitHub fine-grained token을 발급하고 대상 저장소 하나의 **Contents: Read-only** 권한만 허용한 뒤, 서버 환경변수에 추가합니다.

```env
GITHUB_TOKEN=github_pat_READ_ONLY_TOKEN
```

이 값은 서버에서만 사용하며 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다. 가져온 코드는 읽기 전용이고, **GitHub 동기화**를 다시 실행하면 같은 파일 경로의 코드가 최신 버전으로 갱신됩니다.

## Vercel 자동 배포

1. 이 폴더를 GitHub 저장소 하나에 push합니다.
2. Vercel에서 **Add New → Project**로 저장소를 연결합니다.
3. 위의 두 환경변수를 Production, Preview, Development에 등록합니다.
4. 배포 후 생성된 Vercel 주소를 Supabase Authentication의 Site URL과 Redirect URLs에 추가합니다.

이후 `main` 브랜치 push는 운영에 자동 배포되고, Pull Request에는 별도의 Preview 주소가 생성됩니다.

## 검증

```bash
npm test
npm run lint
npm run build
```

GitHub Actions를 추가한다면 위 세 명령을 Pull Request 필수 검사로 설정하는 것을 권장합니다.
