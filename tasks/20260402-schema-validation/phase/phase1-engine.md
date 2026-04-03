# Phase 1: 검증 엔진

## Goal

Phase 0에서 결정된 방식으로 스키마 검증 엔진을 구현한다.

## Gate (Phase 완료 조건)

- [ ] `validateSchema()` 함수가 동작하고 SC-001/002/003 경고를 생성
- [ ] false positive 안전 장치 5종 적용
- [ ] Levenshtein distance 오타 제안 동작
- [ ] 단위 테스트 통과

## Checklist

- [ ] P1-01: `scripts/bundle-schema.ts` 작성 (ci-schema.json → bundled-schema.ts)
- [ ] P1-02: prebuild에 bundle-schema 연결
- [ ] P1-03: `src/schema/validator.ts` 모듈 구현
- [ ] P1-04: Levenshtein distance 유틸 구현 (`src/schema/levenshtein.ts`)
- [ ] P1-05: SC-001 (알 수 없는 job-level 키) 구현
- [ ] P1-06: SC-002 (값 타입 불일치) 구현
- [ ] P1-07: SC-003 (알 수 없는 top-level 키) 구현
- [ ] P1-08: false positive 안전 장치 적용 (hidden job, extends, include, variables, 안내 문구)
- [ ] P1-09: AP 중복 제외 (AP-005, AP-012, AP-014 겹치는 항목 skip)
- [ ] P1-10: GLOBAL_KEYWORDS를 schema.ts에서 export + validator에서 재사용
- [ ] P1-11: 단위 테스트 작성 (`src/__tests__/schema-validation.test.ts`)

## Dependencies

- Phase 0 ADR 결정 (ajv vs 자체 구현)
- Phase 0에서 커밋된 ci-schema.json
