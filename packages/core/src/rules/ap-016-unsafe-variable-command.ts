import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

const DANGEROUS_COMMANDS = [
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*)?\s*.*\$[{(A-Z_]/,
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*)?\s*.*\$[{(A-Z_]/,
  /\brsync\s+.*--delete.*\$[{(A-Z_]/,
  /\brsync\s+.*\$[{(A-Z_].*--delete/,
  /\bmv\s+.*\$[{(A-Z_]/,
  /\bcp\s+(-[a-zA-Z]*r[a-zA-Z]*)?\s*.*\$[{(A-Z_]/,
  /\bchmod\s+-R\s+.*\$[{(A-Z_]/,
  /\bchown\s+-R\s+.*\$[{(A-Z_]/,
];

const SAFE_GUARDS = [
  /\$\{[A-Z_]+:[\?-]/,       // ${VAR:?error} or ${VAR:-default}
  /\[ -[nz] "\$[A-Z_]+"/,    // [ -n "$VAR" ] or [ -z "$VAR" ]
  /\[\[ -[nz] "\$[A-Z_]+"/,  // [[ -n "$VAR" ]]
  /test -[nz] "\$[A-Z_]+"/,  // test -n "$VAR"
  /if \[ .* \]; then/,       // if block before the command
];

/** AP-016: 파괴적 명령에서 미검증 변수 사용 */
export const ap016: Rule = {
  id: 'AP-016',
  severity: 'warning',
  meta: {
    name: '파괴적 명령 + 미검증 변수',
    description: 'rm, rsync --delete 등 파괴적 명령이 변수를 참조하지만, 변수가 비어있을 때의 방어 코드가 없습니다. 변수가 빈 값이면 의도치 않은 경로가 삭제될 수 있습니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;

      const allScripts = [
        ...(job.before_script ?? []),
        ...(job.script ?? []),
        ...(job.after_script ?? []),
      ];

      const fullScript = allScripts.join('\n');

      // Check if any dangerous command pattern exists
      const hasDanger = allScripts.some(line =>
        DANGEROUS_COMMANDS.some(p => p.test(line))
      );
      if (!hasDanger) continue;

      // Check if there's a safe guard anywhere in the script
      const hasSafeGuard = SAFE_GUARDS.some(p => p.test(fullScript));
      if (hasSafeGuard) continue;

      warnings.push({
        ruleId: 'AP-016',
        severity: 'warning',
        message: `'${name}'에 파괴적 명령(rm/rsync 등)이 변수를 참조하지만 변수 검증이 없습니다.`,
        description: ap016.meta.description,
        location: { jobName: name, key: 'script' },
      });
    }

    return warnings;
  },
};
