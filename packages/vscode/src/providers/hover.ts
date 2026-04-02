import * as vscode from 'vscode';

const KEYWORDS: Record<string, string> = {
  stages: '파이프라인 실행 순서를 정의합니다. 각 stage는 순서대로 실행되며, 같은 stage의 job은 병렬 실행됩니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#stages)',
  variables: '파이프라인 전역 환경 변수를 정의합니다. job 레벨에서 재정의할 수 있습니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#variables)',
  default: '모든 job에 적용되는 기본 설정입니다. image, before_script, cache 등을 지정할 수 있습니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#default)',
  workflow: '전체 파이프라인의 실행 조건을 정의합니다. rules로 파이프라인 생성 여부를 제어합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#workflow)',
  include: '외부 CI 설정 파일을 포함합니다. local, template, remote, project, component 타입을 지원합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#include)',
  script: 'job에서 실행할 셸 명령어 목록입니다. 필수 키워드입니다 (trigger job 제외).\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#script)',
  before_script: 'script 실행 전에 실행할 명령어입니다. 의존성 설치 등에 사용합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#before_script)',
  after_script: 'script 실행 후에 항상 실행할 명령어입니다. 정리 작업에 사용합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#after_script)',
  image: 'job을 실행할 Docker 이미지를 지정합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#image)',
  services: 'job 실행 시 함께 시작할 서비스 컨테이너입니다. 데이터베이스, Redis 등에 사용합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#services)',
  stage: 'job이 속한 stage를 지정합니다. 기본값은 `test`입니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#stage)',
  extends: '다른 job의 설정을 상속합니다. 공통 설정을 hidden job에 정의하고 상속하면 중복을 줄일 수 있습니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#extends)',
  rules: 'job 실행 조건을 정의합니다. `only`/`except`보다 유연하며, 권장됩니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#rules)',
  needs: '명시적 의존성을 정의합니다. stage 순서를 무시하고 특정 job이 완료되면 바로 실행합니다 (DAG).\n\n⚠ `needs: []`은 모든 의존성을 제거하여 즉시 실행합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#needs)',
  artifacts: 'job의 산출물을 정의합니다. 다음 stage의 job에 자동으로 전달됩니다.\n\n⚠ `expire_in`을 설정하지 않으면 기본 30일간 보관됩니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#artifacts)',
  cache: 'job 간 공유할 캐시를 정의합니다. 의존성 파일 캐싱으로 파이프라인 속도를 높일 수 있습니다.\n\n⚠ 반드시 `key`를 설정하세요.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#cache)',
  dependencies: 'artifacts를 다운로드할 이전 job을 명시합니다. 미지정 시 같은 stage 이전의 모든 artifacts가 다운로드됩니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#dependencies)',
  environment: '배포 환경을 정의합니다. GitLab Environments 페이지에서 추적됩니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#environment)',
  trigger: '다른 프로젝트의 파이프라인을 트리거합니다. Multi-project 파이프라인에 사용합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#trigger)',
  tags: 'job을 실행할 러너의 태그를 지정합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#tags)',
  when: 'job 실행 시점을 제어합니다. `on_success` (기본), `manual`, `always`, `on_failure`, `delayed`, `never`.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#when)',
  allow_failure: 'true로 설정하면 job이 실패해도 파이프라인은 계속 진행됩니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#allow_failure)',
  retry: 'job 실패 시 재시도 횟수입니다. 네트워크 의존 job에 권장됩니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#retry)',
  timeout: 'job 최대 실행 시간입니다. 기본값은 프로젝트 설정에 따릅니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#timeout)',
  parallel: 'job을 병렬로 여러 인스턴스 실행합니다. matrix와 함께 사용하면 조합 테스트가 가능합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#parallel)',
  interruptible: 'true로 설정하면 새 파이프라인 시작 시 이 job이 자동 취소됩니다. 러너 자원을 절약합니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#interruptible)',
  resource_group: '동시 실행을 방지합니다. 같은 resource_group의 job은 한 번에 하나만 실행됩니다.\n\n[공식 문서](https://docs.gitlab.com/ee/ci/yaml/#resource_group)',
};

export class XRayHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | null {
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!wordRange) return null;

    const word = document.getText(wordRange);
    const line = document.lineAt(position.line).text;

    // Only provide hover for YAML keys (word followed by colon)
    const keyPattern = new RegExp(`^\\s*${word}\\s*:`);
    if (!keyPattern.test(line)) return null;

    const description = KEYWORDS[word];
    if (!description) return null;

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**\`${word}\`**\n\n${description}`);

    return new vscode.Hover(md, wordRange);
  }
}
