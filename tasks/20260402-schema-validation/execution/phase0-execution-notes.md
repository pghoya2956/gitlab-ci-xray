# Phase 0: PoC + 스키마 준비 실행 로그

> Append-only. 수정/삭제 금지.

| 항목 | 값 |
|------|-----|
| 시작 | 2026-04-03 00:15 |
| Phase 계획 | [phase0-poc.md](../phase/phase0-poc.md) |

---

### P0-01: GitLab CI JSON Schema 다운로드 [●]

**배경**: 오프라인 검증을 위해 GitLab 공식 스키마가 필요

**실행**: `curl`로 GitLab master 브랜치의 ci.json 다운로드 → `packages/core/src/data/ci-schema.json`

**결과**: 115KB, JSON Schema Draft-07, job 정의는 patternProperties + additionalProperties 구조

---

### P0-02: update-schema.ts 작성 [●]

**배경**: 향후 스키마 업데이트를 수동으로 할 수 있는 스크립트 필요

**실행**: `scripts/update-schema.ts` 작성 — fetch → writeFileSync

**결과**: `pnpm exec tsx scripts/update-schema.ts`로 수동 실행 가능

---

### P0-03~04: ajv PoC + 번들 크기 측정 [●]

**배경**: ajv 채택 여부를 번들 크기와 정확도로 결정

**실행**: ajv 설치 → 의도적 오류 yaml로 검증 → esbuild로 번들 크기 측정

**결과**:
- ajv 단독 번들: **243KB** (core 105KB, vscode 230KB 대비 과도)
- true positive: 4/4 (scrpit 오타, retry 타입, allow_failure 타입, unknown key)
- false positive (정상 yml): 0건

---

### P0-05: 실제 yml false positive 테스트 [●]

**배경**: 정상 파일에서 false positive 비율 확인

**실행**: /tmp/test-ci.yml (7 jobs, 4 stages) 검증

**결과**: Valid: true, 0 errors. false positive 없음.

---

### P0-06: ADR 작성 [●]

**배경**: PoC 결과 기반으로 최종 결정 문서화

**선택지**:
- A) ajv 채택 — 정확하지만 243KB 번들 추가 ← 미선택
- B) 자체 allowlist 경량 검증기 ← 선택

**결정 이유**: 243KB는 vscode 확장 크기를 2배로 증가시킴. 실무에서 필요한 3가지(오타, 타입, unknown key)는 allowlist + typeof로 충분. 인터페이스는 동일하게 유지하여 향후 ajv 전환 가능.

**결과**: ADR-001 작성, ajv 제거, ci-schema.json은 참조용으로 유지

---

