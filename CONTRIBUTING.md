# 기여 / 작업 규칙

이 저장소는 `Portfolio-Project`에서 사용 중인 커밋/PR 흐름을 참고해 운영한다.

## 1. 브랜치 전략

기본 브랜치는 다음처럼 사용한다.

- `main`: 배포 가능하거나 기준이 되는 안정 브랜치
- `dev`: 다음 작업들을 모아두는 통합 브랜치
- 작업 브랜치: 기능/수정 단위 브랜치

권장 흐름:

1. `dev`에서 작업 브랜치를 만든다.
2. 작업이 끝나면 `dev`로 PR을 연다.
3. 검증이 끝난 뒤 `dev -> main`으로 올린다.

브랜치 이름 예시:

- `feat/codex-adapter`
- `feat/claude-adapter`
- `fix/schema-normalizer`
- `chore/repo-scaffold`
- `docs/provider-notes-ko`

## 2. 커밋 메시지 규칙

기본 형식:

```text
<type>(<scope>): <한글 설명>
```

scope가 애매하면 생략 가능:

```text
<type>: <한글 설명>
```

### type 목록

- `feat`: 기능 추가
- `fix`: 버그 수정
- `refactor`: 동작 변화 없는 구조 개선
- `docs`: 문서 수정
- `chore`: 설정, 스캐폴드, 기타 유지보수
- `ci`: CI/CD 변경
- `test`: 테스트 추가/수정
- `perf`: 성능 개선

### scope 예시

- `agent`
- `schemas`
- `adapters`
- `codex`
- `claude`
- `repo`
- `docs`

### 좋은 예시

- `feat(codex): usage endpoint 응답을 공통 snapshot으로 변환`
- `fix(agent): status 명령 출력 포맷 오류 수정`
- `docs(repo): 브랜치 전략과 PR 규칙 추가`
- `ci(schemas): schema 검사 잡 추가`

### 피할 것

- `update`
- `fix bug`
- `작업중`
- `커밋`
- 의미 없는 여러 변경을 한 커밋에 몰아넣기

## 3. Pull Request 규칙

### PR 제목

기본 형식:

```text
[type] 한글 요약
```

예시:

- `[feat] Codex usage adapter 초안 추가`
- `[fix] usage snapshot 정렬 오류 수정`
- `[docs] schema 예시 payload 문서화`

### PR 본문

설명은 기본적으로 한글로 작성한다.
외부 라이브러리명, API명, 경로, 코드 식별자는 원문 그대로 적어도 된다.

PR 본문에는 최소한 아래 내용을 포함한다.

1. 요약
2. 변경 내용
3. 변경 이유
4. 영향 범위
5. 테스트 / 확인
6. 리뷰 포인트
7. 참고 사항

### 영향 범위 체크 예시

- [ ] `packages/schemas`
- [ ] `packages/provider-adapters`
- [ ] `repo`
- [ ] `docs`

## 4. 작업 단위 규칙

- 하나의 PR은 가능한 한 하나의 주제만 다룬다.
- 스캐폴드/문서/기능/리팩터링을 한 PR에 과하게 섞지 않는다.
- 기능 PR이면 가능한 한 mock 또는 sample payload 기준으로라도 확인 결과를 남긴다.
- provider endpoint 검증 코드는 `scripts/poc/`에서 시작하고, 안정화되면 package 내부로 옮긴다.

## 5. 병합 전 확인

최소 확인 항목:

- 관련 문서가 필요하면 같이 수정했는가
- schema 변경이면 sample payload도 같이 반영했는가
- CLI 출력 변경이면 실행 결과 또는 설명이 있는가
- endpoint/auth 관련 변경이면 인증/보안 영향이 정리됐는가

## 6. 이 저장소의 기본 원칙

- 커밋 타입은 영어로 유지
- 설명은 한글 기준
- PR 본문도 한글 기준
- `dev`를 통합 브랜치로 우선 사용
- `main`은 비교적 안정적인 상태만 반영
