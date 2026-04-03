# GitLab CI Schema Validation 스펙

## 개요

GitLab CI 공식 JSON Schema를 활용하여 `.gitlab-ci.yml`의 문법 오류(오타, 타입 불일치, 알 수 없는 키)를 오프라인으로 탐지한다.

## 목적

- **문제**: X-Ray가 안티패턴은 탐지하지만 문법 오류는 못 잡음. "분석 도구인데 문법 오류도 못 잡아?"가 첫인상에서 약점.
- **참고**: `glab ci lint`은 GitLab 서버 인증 필요. X-Ray는 오프라인 즉시 피드백으로 차별화.
- **성공 기준**: 오타 키워드, 잘못된 값 타입, 알 수 없는 키를 탐지하고 기존 Warnings에 통합 표시.

## 범위

### In Scope

- GitLab 공식 CI JSON Schema (Draft-07) 기반 검증
- Job 레벨 키워드 오타 탐지 + 유사 키 제안 ("scrpit" → "script를 의미하셨나요?")
- 값 타입 검증 (retry에 문자열, allow_failure에 "yes" 등)
- 알 수 없는 top-level/job-level 키 경고
- 기존 Rule 엔진 + Warnings 통합 (별도 UI 없음)
- prebuild 시 스키마 번들링 (템플릿과 동일 패턴)

### Out of Scope

- 런타임 변수 확장 후 검증 (`$CI_COMMIT_BRANCH` 등)
- include/extends 해석 후 최종 config 검증 (현재 resolver 통과 후는 이미 정규화됨)
- 자동 수정 (fix)
- 스키마 버전 자동 업데이트

## 설계

### 접근 방식

GitLab 공식 스키마(`ci.json`)를 prebuild에서 번들링하고, ajv로 검증한 결과를 AntiPatternWarning 형태로 변환한다.

```mermaid
flowchart LR
    A[YAML string] --> B[parseYaml]
    B --> C[raw data object]
    C --> D[schema validator]
    D --> E[SchemaWarning[]]
    E --> F[기존 warnings에 merge]
```

### 규칙 ID 체계

기존 AP-001~017과 구분하기 위해 `SC-001` ~ 시리즈 사용:

| ID | severity | 설명 |
|-----|----------|------|
| SC-001 | error | 알 수 없는 job-level 키 (오타 포함) |
| SC-002 | error | 값 타입 불일치 |
| SC-003 | warning | 알 수 없는 top-level 키 |

### 오타 제안 (Levenshtein distance)

알 수 없는 키가 유효한 키와 Levenshtein distance <= 2이면 "~를 의미하셨나요?" 제안.

```typescript
// 예시 출력
{
  ruleId: 'SC-001',
  severity: 'error',
  message: "'build'에서 'scrpit'는 알 수 없는 키입니다. 'script'를 의미하셨나요?",
  location: { jobName: 'build', key: 'scrpit' }
}
```

### 스키마 번들링

기존 `scripts/bundle-templates.ts`와 동일한 패턴:

```
scripts/bundle-schema.ts
  → src/data/templates/ 에서 ci.json fetch (빌드 시)
  → src/data/bundled-schema.ts 생성 (export const CI_SCHEMA = {...})
```

### 검증 함수 인터페이스

```typescript
// src/schema/validator.ts
import type { AntiPatternWarning } from '../types.js';

export function validateSchema(
  rawData: Record<string, unknown>,
): AntiPatternWarning[];
```

### 통합 지점

`analyze.ts`에서 parseYaml 직후, rule engine 실행 전에 호출:

```typescript
const parsed = parseYaml(source);
const schemaWarnings = validateSchema(parsed.data);  // 추가
// ...
const ruleWarnings = runRules(allRules, config);
const allWarnings = [...schemaWarnings, ...ruleWarnings]; // merge
```

## 구현 계획

### Phase 0: 스키마 번들링

- [ ] GitLab CI JSON Schema 다운로드 스크립트 (`scripts/bundle-schema.ts`)
- [ ] `src/data/bundled-schema.ts` 자동 생성
- [ ] prebuild에 연결

### Phase 1: 검증 엔진

- [ ] ajv 의존성 추가 + validator 모듈 구현
- [ ] ajv 에러 → AntiPatternWarning 변환 매핑
- [ ] Levenshtein distance 기반 오타 제안
- [ ] SC-001, SC-002, SC-003 규칙 구현

### Phase 2: 통합 + 테스트

- [ ] analyze.ts에 validateSchema 통합
- [ ] 단위 테스트 (오타, 타입 불일치, 알 수 없는 키)
- [ ] 기존 115 테스트 깨지지 않는지 확인
- [ ] CLI/VS Code에서 결과 표시 확인

## 영향 분석

| 영역 | 변경 내용 | 위험도 | 완화 방안 |
|------|----------|--------|----------|
| core 번들 크기 | ajv + schema 추가 (~50KB) | 낮음 | tree-shaking, schema는 prebuild로 인라인 |
| 기존 규칙 | 겹치는 규칙 (AP-005 script 누락 등) | 중간 | 스키마 검증에서 AP 규칙과 중복되는 항목은 SC에서 제외 |
| false positive | extends/include 전 raw data 검증 | 중간 | hidden job(`.` prefix), 알려진 글로벌 키워드 allowlist |
| vscode 번들 | esbuild로 ajv 번들링 | 낮음 | 이미 esbuild 사용 중 |

## 테스트 계획

### 단위 테스트

- 오타 키워드 탐지 (`scrpit` → script 제안)
- 타입 불일치 (`retry: "abc"`, `allow_failure: "yes"`)
- 알 수 없는 키 (`custom_key: value`)
- 정상 config에서 경고 0건

### 통합 테스트

- 기존 테스트 샘플에 스키마 검증 추가 후 regression 없음
- analyze() 결과에 schemaWarnings 포함 확인

### 엣지 케이스

- hidden job (`.template`)의 커스텀 키는 무시
- `[key: string]: unknown` 패턴의 유연성 유지
- extends/include로 추가되는 키는 false positive 방지

## 결정 사항

- [ajv 사용]: GitLab 내부에서도 사용하는 JSON Schema Draft-07 호환 검증기. 번들 크기 대비 정확도 우수.
- [SC- 시리즈]: AP- 규칙과 네임스페이스 분리하여 스키마 검증임을 명확히 표시.
- [raw data 검증]: resolver 통과 전 원본 데이터에서 검증. extends/include 해석 전이므로 hidden job 커스텀 키는 관용적 처리.

## 열린 질문

- 스키마 버전 관리: GitLab 버전별로 스키마가 다를 수 있음. 현재는 latest 하나만 번들. 향후 버전 선택 옵션 필요한가?
