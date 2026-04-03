# Task Plan: GitLab CI Schema Validation

## Goal

GitLab CI 공식 JSON Schema 기반으로 `.gitlab-ci.yml` 문법 오류를 오프라인 탐지한다.

## Spec

[Initial](spec/initial.md) | [Review](spec/review-log.md) | [Final](spec/final.md)

## Master Progress

| Phase | Goal | Plan | Notes | Status |
|-------|------|------|-------|--------|
| 0 | PoC + 스키마 준비 | [plan](phase/phase0-poc.md) | [notes](execution/phase0-execution-notes.md) | ● |
| 1 | 검증 엔진 구현 | [plan](phase/phase1-engine.md) | [notes](execution/phase1-execution-notes.md) | ● |
| 2 | 통합 + 테스트 + 배포 | [plan](phase/phase2-integration.md) | [notes](execution/phase2-execution-notes.md) | ◐ |

---

## Phase 0: PoC + 스키마 준비

**Goal**: ajv 채택 여부를 실측 데이터로 결정

### Checklist
- [x] P0-01: GitLab CI JSON Schema 다운로드
- [x] P0-02: update-schema.ts 작성
- [x] P0-03: ajv 최소 검증 코드 작성
- [x] P0-04: 번들 크기 측정 (before/after)
- [x] P0-05: 실제 yml로 false positive 카운트
- [x] P0-06: ADR 작성 → 자체 경량 검증기 결정

---

## Phase 1: 검증 엔진 구현

**Goal**: SC-001/002/003 규칙 + 오타 제안 + 안전 장치

### Checklist
- [x] P1-01: bundle-schema.ts 작성
- [x] P1-02: prebuild 연결
- [x] P1-03: validator.ts 모듈 구현
- [x] P1-04: Levenshtein distance 유틸
- [x] P1-05: SC-001 (알 수 없는 job-level 키)
- [x] P1-06: SC-002 (값 타입 불일치)
- [x] P1-07: SC-003 (알 수 없는 top-level 키)
- [x] P1-08: false positive 안전 장치 5종
- [x] P1-09: AP 중복 제외
- [x] P1-10: GLOBAL_KEYWORDS export + 재사용
- [x] P1-11: 단위 테스트 (14 tests)

---

## Phase 2: 통합 + 테스트 + 배포

**Goal**: analyze 파이프라인 통합, 전체 테스트, v0.2.0 배포

### Checklist
- [ ] P2-01: analyze.ts 통합
- [ ] P2-02: index.ts export 추가
- [ ] P2-03: 통합 테스트
- [ ] P2-04: 기존 테스트 regression 확인
- [ ] P2-05: 엣지 케이스 테스트
- [ ] P2-06: CLI 출력 확인
- [ ] P2-07: VS Code WebView 확인
- [ ] P2-08: 빌드 + 패키징 + 번들 크기
- [ ] P2-09: v0.2.0 배포
- [ ] P2-10: CHANGELOG 업데이트

---

## Decisions Made

- [ajv PoC 우선]: 번들 크기와 false positive 실측 후 결정
- [스키마 스냅샷 커밋]: 네트워크 의존 제거
- [SC- 시리즈]: AP- 규칙과 네임스페이스 분리
- [AP 중복 제외]: AP-005, AP-012, AP-014 겹침 방지

## Errors Encountered

(없음)

## Status

**Current**: Phase 0 완료, Phase 1 시작 대기
**Updated**: 2026-04-03 00:30
**Next**: P1-01 bundle-schema.ts 작성
**결정**: ajv 대신 자체 allowlist 경량 검증기 (ADR-001)
