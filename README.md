# GitLab CI X-Ray

`.gitlab-ci.yml` 파일을 분석하여 DAG 시각화, 안티패턴 탐지, 최적화 제안을 제공합니다.

## 기능

- **DAG 시각화** — 파이프라인 구조를 그래프로 확인 (stage + needs 의존 관계)
- **안티패턴 탐지** — 17개 규칙으로 잠재적 문제를 찾아냄 (GitLab 공식 문서, 커뮤니티 best practice 기반)
- **최적화 제안** — artifacts 범위 축소, 캐시 키 설정 등 실행 가능한 개선안
- **클라이언트 사이드** — 모든 데이터는 로컬에서 처리, 서버 전송 없음

## 사용 방법

### VS Code / Cursor / Antigravity 확장

마켓플레이스에서 **GitLab CI X-Ray** 검색 후 설치.

`.gitlab-ci.yml` 파일을 열면 자동으로 분석이 시작됩니다:
- 에디터 우측 상단 그래프 아이콘으로 DAG 패널 열기
- 인라인 경고 (Problems 패널)
- 호버로 GitLab CI 키워드 설명 확인
- CodeLens로 빠른 수정 적용

### CLI

```bash
# 한 번 실행
npx gitlab-ci-xray .gitlab-ci.yml

# 전역 설치
npm install -g gitlab-ci-xray
gitlab-ci-xray .gitlab-ci.yml

# JSON 출력 (CI 통합용)
gitlab-ci-xray .gitlab-ci.yml --json

# AI 분석용 마크다운 출력
gitlab-ci-xray .gitlab-ci.yml --ai
```

## 안티패턴 규칙

| ID | 심각도 | 설명 |
|----|--------|------|
| AP-001 | warning | `only/except` 대신 `rules` 사용 권장 |
| AP-002 | warning | `artifacts.expire_in` 미설정 |
| AP-003 | info | 병렬화 가능한 job (DAG 최적화) |
| AP-004 | warning | `cache.key` 미설정 |
| AP-005 | error | `script` 또는 `trigger` 누락 |
| AP-006 | warning | 과도한 `artifacts.paths` 범위 |
| AP-007 | warning | 네트워크 명령에 `retry` 미설정 |
| AP-008 | info | `environment`에 `resource_group` 미설정 |
| AP-009 | error | `needs` 순환 의존 |
| AP-010 | info | `interruptible` 미설정 |
| AP-011 | info | job 간 `script` 중복 |
| AP-012 | error | `rules: []` 빈 배열 |
| AP-013 | warning | `image` 미설정 |
| AP-014 | error | 정의되지 않은 `stage` 참조 |
| AP-015 | info | `allow_failure` + `rules[].allow_failure` 혼용 |
| AP-016 | warning | 파괴적 명령(`rm -rf` 등) + 미검증 변수 |
| AP-017 | info | 동일한 `rules` 블록 3회 이상 반복 |

각 규칙의 상세 설명: [docs/rules/](docs/rules/)

## 패키지 구조

```
packages/
  core/    — 파서, 규칙 엔진, DAG 빌더, 최적화 (gitlab-ci-xray-core)
  cli/     — 터미널 도구 (gitlab-ci-xray)
  vscode/  — VS Code 확장 (gitlab-ci-xray-vscode)
```

## 개발

```bash
pnpm install
pnpm -r build
pnpm --filter gitlab-ci-xray-core test
```

## 라이선스

MIT
