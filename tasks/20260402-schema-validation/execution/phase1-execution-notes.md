# Phase 1: 검증 엔진 실행 로그

> Append-only. 수정/삭제 금지.

| 항목 | 값 |
|------|-----|
| 시작 | 2026-04-03 00:35 |
| Phase 계획 | [phase1-engine.md](../phase/phase1-engine.md) |

---

### P1-01~02: bundle-schema.ts + prebuild 연결 [●]

**배경**: ci-schema.json에서 키워드 목록과 타입 정보를 TS 상수로 추출해야 함

**실행**: `scripts/bundle-schema.ts` 작성 — JSON Schema에서 job_template.properties, top-level properties 추출 → bundled-schema.ts 생성. prebuild에 `&& tsx scripts/bundle-schema.ts` 추가.

**결과**: 38 job keywords, 12 top-level keywords 번들링 완료

---

### P1-03~09: validator 모듈 + Levenshtein + SC 규칙 + 안전 장치 [●]

**배경**: 자체 allowlist 경량 검증기 구현 (ADR-001 결정)

**실행**:
- `src/schema/levenshtein.ts` — Levenshtein distance + findClosest 유틸
- `src/schema/validator.ts` — validateSchema() 함수
- SC-001: unknown job key + 오타 제안 (findClosest)
- SC-002: 타입 불일치 (JOB_KEYWORD_TYPES 참조)
- SC-003: unknown top-level key (non-object value)
- 안전 장치: hidden job skip, extends 완화, include시 severity downgrade, variables 키 무시, 안내 문구

**결과**: 번들 크기 변화 없음 (validator가 자체 구현이므로 외부 의존성 0). GLOBAL_KEYWORDS export 완료.

---

### P1-10~11: GLOBAL_KEYWORDS export + 단위 테스트 [●]

**배경**: schema.ts의 GLOBAL_KEYWORDS를 validator에서 재사용 + 14개 테스트 케이스

**실행**: GLOBAL_KEYWORDS를 export로 변경. schema-validation.test.ts 작성 (levenshtein 3 + SC-001 5 + SC-002 3 + SC-003 2 + valid config 1)

**결과**: 129/129 테스트 통과 (기존 115 + 신규 14)

---

