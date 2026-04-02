# GitLab CI X-Ray

`.gitlab-ci.yml` 파일을 실시간으로 분석하여 DAG 시각화, 안티패턴 탐지, 최적화 제안을 제공하는 VS Code 확장입니다.

## 기능

### DAG 시각화
파이프라인의 stage 구조와 `needs` 의존 관계를 그래프로 시각화합니다. 줌 인/아웃, 스크롤을 지원합니다.

### 안티패턴 탐지 (17개 규칙)
GitLab 공식 문서와 커뮤니티 best practice에 기반한 17개 규칙으로 잠재적 문제를 탐지합니다:
- `only/except` 대신 `rules` 사용 권장 (AP-001)
- `artifacts.expire_in` 미설정 (AP-002)
- `needs` 순환 의존 감지 (AP-009)
- 파괴적 명령 + 미검증 변수 (AP-016)
- 그 외 13개 규칙

### 최적화 제안
artifacts 범위 축소, 캐시 키 설정 등 실행 가능한 개선안을 제시합니다.

### Copy for AI
분석 결과를 마크다운 형식으로 클립보드에 복사하여 AI 도구에 바로 붙여넣을 수 있습니다.

## 사용 방법

`.gitlab-ci.yml` 파일을 열면 자동으로 분석이 시작됩니다.

- **DAG 패널 열기**: 에디터 우측 상단 그래프 아이콘 클릭 또는 Command Palette → `GitLab CI X-Ray: Open Preview`
- **인라인 경고**: Problems 패널에서 확인
- **호버**: GitLab CI 키워드 위에 마우스를 올리면 설명과 공식 문서 링크 표시
- **빠른 수정**: CodeLens를 통해 제안된 수정사항 적용

## 개인정보

모든 데이터는 로컬에서 처리됩니다. 서버로 전송되는 정보는 없습니다.

## 라이선스

MIT
