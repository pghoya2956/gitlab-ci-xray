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
- 스키마 스냅샷을 git에 커밋 (prebuild는 로컬 파일 읽기만)

### Out of Scope

- 런타임 변수 확장 후 검증 (`$CI_COMMIT_BRANCH` 등)
- include/extends 해석 후 최종 config 검증
- 자동 수정 (fix)
- 스키마 버전 자동 업데이트 (수동 스크립트로 분리)

## 설계

### 접근 방식

[보완] **2단계 접근**: Phase 0에서 ajv PoC를 먼저 수행하여 번들 크기와 false positive 비율을 확인한다. 문제가 크면 ajv 대신 자체 allowlist 기반 경량 검증기로 전환한다.

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

### AP 규칙 중복 매핑 [보완]

스키마 검증과 기존 AP 규칙이 겹치는 항목은 SC에서 제외하여 중복 경고 방지:

| SC 검증 항목 | 겹치는 AP 규칙 | 처리 |
|---|---|---|
| script required | AP-005 | SC에서 제외 |
| stage enum | AP-014 | SC에서 제외 |
| rules 빈 배열 | AP-012 | SC에서 제외 |

### 오타 제안 (Levenshtein distance)

알 수 없는 키가 유효한 키와 Levenshtein distance <= 2이면 "~를 의미하셨나요?" 제안.

```typescript
{
  ruleId: 'SC-001',
  severity: 'error',
  message: "'build'에서 'scrpit'는 알 수 없는 키입니다. 'script'를 의미하셨나요?",
  location: { jobName: 'build', key: 'scrpit' }
}
```

### 스키마 관리 [보완]

스키마를 네트워크에서 fetch하지 않고 git에 스냅샷으로 커밋한다:

```
src/data/ci-schema.json          ← GitLab 공식 스키마 스냅샷
scripts/update-schema.ts         ← 수동 실행: 최신 스키마 다운로드 + 커밋
scripts/bundle-schema.ts         ← prebuild: ci-schema.json → bundled-schema.ts
```

업데이트 주기: 릴리스 전 또는 GitLab 메이저 버전 출시 시 수동 실행.

### 검증 함수 인터페이스

```typescript
// src/schema/validator.ts
import type { AntiPatternWarning } from '../types.js';

export interface ValidateSchemaOptions {
  /** include가 있으면 false positive 완화 */
  hasIncludes?: boolean;
}

export function validateSchema(
  rawData: Record<string, unknown>,
  options?: ValidateSchemaOptions,
): AntiPatternWarning[];
```

### 통합 지점

`analyze.ts`에서 parseYaml 직후, resolver 전에 호출:

```typescript
const parsed = parseYaml(source);
const schemaWarnings = validateSchema(parsed.data, {
  hasIncludes: parsed.data.include != null,
});
// ... resolver, rules ...
const allWarnings = [...schemaWarnings, ...ruleWarnings];
```

### false positive 안전 장치 [보완]

1. **hidden job(`.` prefix)**: 커스텀 키 무시 (템플릿용 자유 키)
2. **extends가 있는 job**: additionalProperties 검증 완화 (부모에서 키가 올 수 있음)
3. **include가 있을 때**: "알 수 없는 키" severity를 error→warning으로 downgrade
4. **variables 내부**: 키 이름은 무시, 값의 구조만 검증 (value/description/options)
5. **"알 수 없는 키" 메시지**: "이 키가 최신 GitLab 버전에서 지원되는 키일 수 있습니다" 안내 포함

### GLOBAL_KEYWORDS 공유 [보완]

schema.ts의 기존 `GLOBAL_KEYWORDS` Set을 export하여 validator에서도 재사용. 중복 정의 방지.

## 구현 계획

### Phase 0: PoC + 스키마 준비

- [ ] GitLab CI JSON Schema 다운로드 + `src/data/ci-schema.json`에 커밋
- [ ] ajv로 간단한 검증 PoC (번들 크기, false positive 비율 측정)
- [ ] 결과에 따라 ajv 채택 or 자체 경량 검증기 결정

### Phase 1: 검증 엔진

- [ ] validator 모듈 구현 (결정된 방식)
- [ ] 에러 → AntiPatternWarning 변환 매핑
- [ ] Levenshtein distance 기반 오타 제안
- [ ] SC-001, SC-002, SC-003 규칙 구현
- [ ] false positive 안전 장치 5종 적용

### Phase 2: 통합 + 테스트

- [ ] analyze.ts에 validateSchema 통합
- [ ] 단위 테스트 (오타, 타입 불일치, 알 수 없는 키, anchor/merge key)
- [ ] 기존 115 테스트 regression 없음 확인
- [ ] CLI/VS Code에서 결과 표시 확인
- [ ] 빌드 + 패키징 검증

## 영향 분석

| 영역 | 변경 내용 | 위험도 | 완화 방안 |
|------|----------|--------|----------|
| core 번들 크기 | ajv 채택 시 100KB+, 자체 구현 시 ~5KB | 중간 | Phase 0 PoC에서 측정 후 결정 |
| 기존 규칙 | AP-005, AP-012, AP-014와 중복 가능 | 중간 | 중복 매핑 테이블로 SC에서 제외 |
| false positive | extends/include 전 raw data 검증 | 중간 | 안전 장치 5종 |
| vscode 번들 | esbuild로 ajv 번들링 (크기 증가) | 중간 | 자체 구현 시 영향 없음 |

## 테스트 계획

### 단위 테스트

- 오타 키워드 탐지 (`scrpit` → script 제안)
- 타입 불일치 (`retry: "abc"`, `allow_failure: "yes"`)
- 알 수 없는 키 (`custom_key: value`)
- 정상 config에서 경고 0건
- hidden job 커스텀 키 무시
- extends 있는 job에서 additionalProperties 완화

### 통합 테스트

- analyze() 결과에 schemaWarnings 포함 확인
- 기존 115 테스트 regression 없음
- YAML anchor/alias + `<<` merge key 처리

### 엣지 케이스

- `pages` 키 (글로벌 키워드이자 job)
- variables 내부 키 이름 무시
- include 존재 시 severity downgrade 확인

## 결정 사항

- [ajv PoC 우선]: 번들 크기와 false positive 비율을 실측 후 최종 결정. 문제 시 자체 경량 검증기로 전환.
- [스키마 스냅샷 커밋]: 네트워크 의존 제거. 빌드 안정성 확보.
- [SC- 시리즈]: AP- 규칙과 네임스페이스 분리하여 스키마 검증임을 명확히 표시.
- [raw data 검증]: resolver 통과 전 원본 데이터에서 검증. false positive 안전 장치 5종으로 완화.
- [AP 중복 제외]: SC에서 AP-005, AP-012, AP-014와 겹치는 항목은 제외.

## 열린 질문

- 스키마 버전 관리: 현재는 latest 하나만 번들. 향후 `--gitlab-version` 옵션이 필요해지면 그때 추가. [보완] RELEASING.md에 스키마 업데이트 절차 포함.
