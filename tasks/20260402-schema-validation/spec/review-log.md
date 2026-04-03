# 스펙 검토 로그

## 검토 대상

- 파일: tasks/20260402-schema-validation/spec/initial.md
- 검토일: 2026-04-02

## 발견 사항

### 기술적 구현

| 항목 | 상태 | 발견 내용 | 보완 내용 |
|------|------|----------|----------|
| ajv 번들 크기 | ◐ 모호 | "~50KB"는 과소 추정. ajv는 standalone 빌드 없이 esbuild하면 100KB+. vscode 번들이 224KB→324KB로 45% 증가 | ajv/dist/2020 대신 ajv의 standalone compile 모드 검토. 또는 ajv 없이 자체 경량 검증기 구현 |
| 스키마 fetch 시점 | ◐ 모호 | "prebuild에서 fetch"라고만 기술. ci.json이 ~200KB+ 대형 파일. 네트워크 실패 시 빌드 실패? | 스키마를 git에 커밋(스냅샷). prebuild는 로컬 파일 읽기만. 업데이트는 수동 스크립트로 분리 |
| raw data 검증 타이밍 | ● 명확 | parseYaml 직후, resolver 전에 검증 — 적절한 위치 | — |
| GLOBAL_KEYWORDS 중복 | ◐ 모호 | schema.ts에 이미 GLOBAL_KEYWORDS Set이 있음. SC-003에서 "알 수 없는 top-level 키"를 또 정의하면 중복 | schema.ts의 GLOBAL_KEYWORDS를 공유하거나, SC-003이 이 목록을 참조 |
| AP 규칙 중복 처리 | ◐ 모호 | AP-005(script 누락)와 SC-002(required field) 겹침 가능. "제외"라고만 기술, 구체적 제외 목록 없음 | 중복 규칙 매핑 테이블 필요: AP-005↔script required, AP-014↔stage enum |

### 트레이드오프

| 항목 | 상태 | 발견 내용 | 보완 내용 |
|------|------|----------|----------|
| ajv vs 자체 구현 | ◐ 모호 | ajv는 정확하지만 무거움. GitLab CI 스키마는 patternProperties + additionalProperties를 많이 사용하여 job 이름이 동적 — ajv가 이를 올바르게 처리하는지 검증 필요 | [보완] ajv로 먼저 PoC, 번들 크기와 false positive 비율 확인 후 결정. 문제 시 자체 allowlist 기반 경량 검증기로 전환 |
| 전체 스키마 vs 부분 스키마 | ○ 누락 | GitLab CI 스키마는 매우 복잡 (inputs, components, deployment 등). 전체를 쓸지 job-level만 추출할지 미결정 | [보완] Phase 0에서 스키마 구조 분석 후 결정. job-level 키워드 allowlist만으로도 80% 가치 달성 가능 |

### 엣지 케이스

| 항목 | 상태 | 발견 내용 | 보완 내용 |
|------|------|----------|----------|
| hidden job 커스텀 키 | ● 명확 | `.template`의 커스텀 키 무시 — 적절 | — |
| anchor/alias | ○ 누락 | YAML anchor(`&`)/alias(`*`) 사용 시 js-yaml이 해석한 결과에서 원본 키가 사라짐. 스키마 검증에 영향? | [보완] js-yaml이 이미 해석하므로 영향 없음. 단 `<<` merge key 사용 시 추가 키가 나타날 수 있음 — 테스트 추가 |
| 커스텀 변수 키 | ○ 누락 | `variables` 내부의 키는 사용자 정의이므로 스키마 검증 대상 아님. 하지만 `variables.MY_VAR.value`의 타입은 검증 대상 | [보완] variables 내부 값의 구조만 검증 (value/description/options), 키 이름은 무시 |
| `pages` 키 | ○ 누락 | `pages`는 job이면서 동시에 특수 키워드. GLOBAL_KEYWORDS에 포함되어 있어 job으로 파싱 안 됨 — 스키마 검증에서도 특수 처리 필요 | [보완] pages는 현재대로 글로벌 키워드 처리 유지 |

### 우려 사항

| 항목 | 상태 | 발견 내용 | 보완 내용 |
|------|------|----------|----------|
| false positive 비율 | ◐ 모호 | 스키마 검증의 가장 큰 리스크. extends/include 전 raw data에서 검증하므로 아직 존재하지 않는 참조 키가 오류로 나올 수 있음 | [보완] 안전 장치: (1) hidden job은 skip, (2) extends가 있는 job은 additionalProperties 검증 완화, (3) include가 있으면 severity를 error→warning으로 downgrade |
| 유지보수 복잡성 | ◐ 모호 | GitLab 버전마다 새 키워드 추가됨 (예: inputs, components). 스키마 업데이트를 안 하면 false positive 증가 | [보완] 스키마 업데이트 주기를 RELEASING.md에 포함. "알 수 없는 키" 경고에 "이 키가 최신 GitLab 버전에서 지원되는 키일 수 있습니다" 안내 문구 추가 |

## 열린 질문 (해결 불가)

- 없음 (모든 질문을 코드베이스 분석으로 해결)

## 요약

- 발견된 모호함: 7건
- 보완된 항목: 7건
- 열린 질문: 0건
- **핵심 보완**: ajv PoC 우선 접근, 스키마 스냅샷 커밋, false positive 안전 장치 3종, AP 규칙 중복 매핑
