# Changelog

## v0.1.0 (2026-04-02)

첫 번째 릴리스.

### 코어

- YAML 파서: js-yaml 기반, `!reference` 커스텀 태그, anchor/alias, duplicate key 허용
- 스키마 해석: stages, jobs, variables, default, workflow, include
- Resolver: extends (deep merge, cycle detection), `!reference` (lenient mode), include (local/remote/template)
- include:template 번들링: 21개 GitLab 공식 CI 템플릿 embed
- DAG 생성: stage 기반 + needs 기반 의존 그래프, 위상 정렬
- 안티패턴 규칙 엔진: 15개 규칙 (AP-001 ~ AP-015)
- 최적화 엔진: 병렬화, 캐시, artifacts, 보안 제안
- applyFix: 텍스트 수준 YAML 자동 수정
- formatForAI: AI 채팅용 구조화 마크다운 출력
- 보안: path traversal 방어, prototype pollution 방어

### VS Code 확장

- DiagnosticsProvider: 안티패턴 밑줄 + Problems 패널
- CodeActionProvider: Quick Fix 전구
- HoverProvider: GitLab CI 키워드 설명
- CodeLensProvider: job별 warning 수 + DAG 링크
- WebView 패널: DAG 시각화 + Warnings + Suggestions (탭 UI)
- Copy for AI 버튼: 클립보드 복사
- 실시간 갱신: 300ms 디바운스
- 내보내기: Markdown, JSON

### CLI

- `npx gitlab-ci-xray [file]` — 기본 텍스트 출력
- `--json` — JSON 출력
- `--ai` — AI 전달 포맷

### 안티패턴 규칙

| ID | 이름 |
|----|------|
| AP-001 | only/except 사용 |
| AP-002 | artifacts expire_in 미설정 |
| AP-003 | 병렬화 가능한 job |
| AP-004 | cache key 미설정 |
| AP-005 | script/trigger 누락 |
| AP-006 | 과도한 artifacts 범위 |
| AP-007 | retry 미설정 (네트워크) |
| AP-008 | resource_group 미설정 |
| AP-009 | needs 순환 의존 |
| AP-010 | interruptible 미설정 |
| AP-011 | script 중복 |
| AP-012 | rules 빈 배열 |
| AP-013 | image 미설정 |
| AP-014 | 정의되지 않은 stage |
| AP-015 | allow_failure + rules 혼용 |
