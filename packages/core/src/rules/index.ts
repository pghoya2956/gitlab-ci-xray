import type { Rule } from './engine.js';
import { ap001 } from './ap-001-only-except.js';
import { ap002 } from './ap-002-artifacts-expire.js';
import { ap003 } from './ap-003-parallel-stage.js';
import { ap004 } from './ap-004-cache-key.js';
import { ap005 } from './ap-005-missing-script.js';
import { ap006 } from './ap-006-broad-artifacts.js';
import { ap007 } from './ap-007-retry-network.js';
import { ap008 } from './ap-008-environment-resource-group.js';
import { ap009 } from './ap-009-needs-cycle.js';
import { ap010 } from './ap-010-interruptible.js';
import { ap011 } from './ap-011-duplicate-script.js';
import { ap012 } from './ap-012-empty-rules.js';
import { ap013 } from './ap-013-missing-image.js';
import { ap014 } from './ap-014-undefined-stage.js';
import { ap015 } from './ap-015-allow-failure-rules.js';
import { ap016 } from './ap-016-unsafe-variable-command.js';
import { ap017 } from './ap-017-duplicate-rules-block.js';

export { runRules, type Rule, type RuleEngineOptions } from './engine.js';

/** All built-in anti-pattern rules */
export const allRules: Rule[] = [
  ap001, ap002, ap003, ap004, ap005,
  ap006, ap007, ap008, ap009, ap010,
  ap011, ap012, ap013, ap014, ap015,
  ap016, ap017,
];
