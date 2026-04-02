# 안티패턴 규칙 목록

GitLab CI X-Ray가 탐지하는 안티패턴 규칙입니다. 각 규칙은 GitLab 공식 문서, 커뮤니티 best practice, 실무 경험에 기반합니다.

| ID | 심각도 | 이름 | 근거 |
|----|--------|------|------|
| [AP-001](ap-001.md) | warning | only/except 사용 | GitLab 공식 deprecated |
| [AP-002](ap-002.md) | warning | artifacts expire_in 미설정 | GitLab best practice |
| [AP-003](ap-003.md) | info | 병렬화 가능한 job | DAG 최적화 |
| [AP-004](ap-004.md) | warning | cache key 미설정 | GitLab 공식 문서 |
| [AP-005](ap-005.md) | error | script/trigger 누락 | GitLab CI 엔진 에러 |
| [AP-006](ap-006.md) | warning | 과도한 artifacts 범위 | 스토리지/네트워크 낭비 |
| [AP-007](ap-007.md) | warning | retry 미설정 (네트워크) | Flaky pipeline 방지 |
| [AP-008](ap-008.md) | info | resource_group 미설정 | 동시 배포 방지 |
| [AP-009](ap-009.md) | error | needs 순환 의존 | GitLab CI 엔진 에러 |
| [AP-010](ap-010.md) | info | interruptible 미설정 | 러너 자원 절약 |
| [AP-011](ap-011.md) | info | script 중복 | DRY 원칙 |
| [AP-012](ap-012.md) | error | rules 빈 배열 | job 실행 불가 |
| [AP-013](ap-013.md) | warning | image 미설정 | 재현 가능한 빌드 |
| [AP-014](ap-014.md) | error | 정의되지 않은 stage | GitLab CI 엔진 에러 |
| [AP-015](ap-015.md) | info | allow_failure + rules 혼용 | 동작 혼란 방지 |

## 규칙 추가 가이드

`packages/core/src/rules/` 에 새 규칙 파일을 추가하고, `rules/index.ts`에 등록한 뒤, 이 문서에 항목을 추가하세요.

## 변경 이력

[CHANGELOG.md](../CHANGELOG.md) 참조.
