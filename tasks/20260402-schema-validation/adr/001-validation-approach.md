# ADR-001: 스키마 검증 방식 — 자체 경량 검증기

## 상태

결정됨 (2026-04-03)

## 맥락

GitLab CI 문법 오류 탐지를 위해 ajv(JSON Schema 검증 라이브러리) vs 자체 경량 검증기 중 선택해야 한다.

## PoC 결과

| 측정 항목 | ajv | 자체 구현 (추정) |
|-----------|-----|-----------------|
| 번들 크기 | 243KB | ~5KB |
| 검증 정확도 | 높음 (JSON Schema 완전 준수) | 충분함 (job-level 키 + 타입 체크) |
| false positive (정상 yml) | 0건 | 0건 (allowlist 기반) |
| true positive (오류 yml) | 4/4 | 4/4 (동일 커버리지 가능) |
| 유지보수 | 스키마 업데이트만 | 키워드 목록 수동 관리 |

## 결정

**자체 allowlist 기반 경량 검증기를 구현한다.**

## 근거

- **번들 크기**: ajv 243KB 추가 시 vscode 확장이 230KB → 473KB로 2배 증가. 사용자 첫 설치 경험에 영향.
- **커버리지 충분**: 실무에서 가장 흔한 3가지(오타, 타입 불일치, 알 수 없는 키)는 allowlist + typeof 체크로 커버 가능.
- **GitLab CI 스키마 구조**: job 정의가 `additionalProperties`와 `patternProperties`로 되어 있어 ajv를 써도 에러 메시지 커스텀 매핑이 필요함. 직접 구현해도 작업량 차이가 크지 않음.
- **확장성**: 향후 ajv가 필요해지면 그때 전환 가능. 자체 검증기의 인터페이스(`validateSchema()`)는 동일하게 유지.

## 구현 방식

- GitLab CI 공식 스키마에서 **유효한 job-level 키워드 목록**과 **값 타입 정보**를 추출
- allowlist 기반으로 알 수 없는 키 탐지
- typeof 체크로 값 타입 검증
- Levenshtein distance로 오타 제안

## 결과

- ajv devDependency 제거
- ci-schema.json은 유지 (키워드 목록 추출 참조용)
