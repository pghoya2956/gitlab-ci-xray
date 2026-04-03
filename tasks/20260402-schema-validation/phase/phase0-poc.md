# Phase 0: PoC + 스키마 준비

## Goal

ajv 채택 여부를 실측 데이터로 결정한다. 스키마를 프로젝트에 커밋한다.

## Gate (Phase 완료 조건)

- [ ] ci-schema.json이 `src/data/`에 커밋됨
- [ ] ajv 번들 크기 측정 완료 (esbuild 기준)
- [ ] 실제 .gitlab-ci.yml 3개 이상으로 false positive 비율 확인
- [ ] ADR 작성: ajv 채택 or 자체 구현 결정 + 근거

## Checklist

- [ ] P0-01: GitLab 공식 CI JSON Schema 다운로드 → `packages/core/src/data/ci-schema.json`
- [ ] P0-02: `scripts/update-schema.ts` 작성 (향후 수동 업데이트용)
- [ ] P0-03: ajv 설치 + 최소 검증 코드 작성 (임시 스크립트)
- [ ] P0-04: esbuild로 ajv 포함 빌드 → 번들 크기 측정 (before/after)
- [ ] P0-05: 테스트용 .gitlab-ci.yml 3개로 검증 실행 → false positive 카운트
- [ ] P0-06: 결과 기반 ADR 작성 (`adr/001-validation-approach.md`)

## Risk

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| ajv 번들 200KB+ | 중간 | vscode 확장 크기 2배 | 자체 경량 검증기로 전환 |
| GitLab 스키마 구조 복잡 | 높음 | ajv 에러 메시지가 모호 | 에러 메시지 커스텀 매핑 |
| false positive > 30% | 중간 | 사용자 신뢰 하락 | 안전 장치 강화 or 검증 범위 축소 |
