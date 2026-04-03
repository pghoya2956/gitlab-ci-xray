import { describe, it, expect } from 'vitest';
import { validateSchema } from '../schema/validator.js';
import { levenshtein, findClosest } from '../schema/levenshtein.js';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('script', 'script')).toBe(0);
  });

  it('returns correct distance for typos', () => {
    expect(levenshtein('scrpit', 'script')).toBe(2);
    expect(levenshtein('scirpt', 'script')).toBe(2);
    expect(levenshtein('scipt', 'script')).toBe(1);
  });

  it('findClosest returns best match within threshold', () => {
    const keywords = new Set(['script', 'stage', 'image', 'artifacts']);
    expect(findClosest('scrpit', keywords)).toBe('script');
    expect(findClosest('stag', keywords)).toBe('stage');
    expect(findClosest('xxxxxxx', keywords)).toBeNull();
  });
});

describe('validateSchema', () => {
  it('returns no warnings for valid config', () => {
    const data = {
      stages: ['build', 'test'],
      build: {
        stage: 'build',
        script: ['npm run build'],
        image: 'node:18',
      },
      test: {
        stage: 'test',
        script: ['npm test'],
      },
    };
    const warnings = validateSchema(data);
    expect(warnings).toHaveLength(0);
  });

  describe('SC-001: unknown job-level key', () => {
    it('detects typo with suggestion', () => {
      const data = {
        stages: ['build'],
        build: {
          stage: 'build',
          scrpit: ['echo hi'],
        },
      };
      const warnings = validateSchema(data);
      const sc001 = warnings.filter((w) => w.ruleId === 'SC-001');
      expect(sc001).toHaveLength(1);
      expect(sc001[0].message).toContain('scrpit');
      expect(sc001[0].message).toContain('script');
      expect(sc001[0].severity).toBe('error');
    });

    it('detects unknown key without suggestion', () => {
      const data = {
        stages: ['build'],
        build: {
          stage: 'build',
          script: ['echo hi'],
          completely_unknown_key: true,
        },
      };
      const warnings = validateSchema(data);
      const sc001 = warnings.filter((w) => w.ruleId === 'SC-001');
      expect(sc001).toHaveLength(1);
      expect(sc001[0].message).toContain('completely_unknown_key');
    });

    it('skips hidden jobs', () => {
      const data = {
        stages: ['build'],
        '.template': {
          custom_key: 'value',
        },
      };
      const warnings = validateSchema(data);
      expect(warnings.filter((w) => w.ruleId === 'SC-001')).toHaveLength(0);
    });

    it('skips jobs with extends', () => {
      const data = {
        stages: ['build'],
        build: {
          extends: '.template',
          stage: 'build',
          custom_from_parent: true,
        },
      };
      const warnings = validateSchema(data);
      expect(warnings.filter((w) => w.ruleId === 'SC-001')).toHaveLength(0);
    });

    it('downgrades severity when includes exist', () => {
      const data = {
        stages: ['build'],
        build: {
          stage: 'build',
          scrpit: ['echo hi'],
        },
      };
      const warnings = validateSchema(data, { hasIncludes: true });
      const sc001 = warnings.filter((w) => w.ruleId === 'SC-001');
      expect(sc001[0].severity).toBe('warning');
    });
  });

  describe('SC-002: type mismatch', () => {
    it('detects string where boolean expected', () => {
      const data = {
        stages: ['test'],
        test: {
          stage: 'test',
          script: ['npm test'],
          allow_failure: 'yes',
        },
      };
      const warnings = validateSchema(data);
      const sc002 = warnings.filter((w) => w.ruleId === 'SC-002');
      expect(sc002).toHaveLength(1);
      expect(sc002[0].message).toContain('allow_failure');
      expect(sc002[0].message).toContain('boolean');
    });

    it('detects string where array expected', () => {
      const data = {
        stages: ['test'],
        test: {
          stage: 'test',
          script: ['npm test'],
          needs: 'build',
        },
      };
      const warnings = validateSchema(data);
      const sc002 = warnings.filter((w) => w.ruleId === 'SC-002');
      expect(sc002).toHaveLength(1);
      expect(sc002[0].message).toContain('needs');
    });

    it('allows valid types', () => {
      const data = {
        stages: ['test'],
        test: {
          stage: 'test',
          script: ['npm test'],
          allow_failure: true,
          retry: { max: 2 },
          image: 'node:18',
          needs: ['build'],
        },
      };
      const warnings = validateSchema(data);
      expect(warnings.filter((w) => w.ruleId === 'SC-002')).toHaveLength(0);
    });
  });

  describe('SC-003: unknown top-level key', () => {
    it('detects non-object top-level value', () => {
      const data = {
        stages: ['build'],
        unknowntop: 'value',
        build: {
          stage: 'build',
          script: ['echo hi'],
        },
      };
      const warnings = validateSchema(data);
      const sc003 = warnings.filter((w) => w.ruleId === 'SC-003');
      expect(sc003).toHaveLength(1);
      expect(sc003[0].message).toContain('unknowntop');
    });

    it('does not flag job definitions (objects)', () => {
      const data = {
        stages: ['build'],
        my_custom_job: {
          stage: 'build',
          script: ['echo hi'],
        },
      };
      const warnings = validateSchema(data);
      expect(warnings.filter((w) => w.ruleId === 'SC-003')).toHaveLength(0);
    });
  });
});
