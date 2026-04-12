# 아키텍처

## 요약

이 프로젝트는 하이브리드 구조를 사용한다.

- 로컬 인증 및 세션 재사용이 필요한 provider는 로컬 에이전트에서 처리
- 공식 usage endpoint가 안정적인 provider는 백엔드에서 직접 poll
- 최종 상태 표시는 공통 정규화 계층을 통해 통합

## 주요 구성 요소

### 로컬 에이전트
- provider별 인증 해석
- 로컬 usage endpoint 호출
- 이벤트 관측
- 버퍼링 및 업로드

### 백엔드 API
- 정규화 이벤트 수집
- 가능한 provider 직접 poll
- 상태 집계
- 대시보드용 API 제공

### 웹 대시보드
- 전체 overview
- provider / account 상세
- timeline
- health 표시
