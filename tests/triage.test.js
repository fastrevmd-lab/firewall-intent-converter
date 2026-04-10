import { describe, it, expect } from 'vitest';
import { computeTriageBucket, computeTriageCounts } from '../public/utils/triage.js';

const baseConfig = {
  zones: [{ name: 'trust' }, { name: 'untrust' }],
  security_policies: [],
};

describe('computeTriageBucket', () => {
  it('returns safe for a clean rule', () => {
    const rule = {
      name: 'allow-web',
      source_zones: ['trust'],
      destination_zones: ['untrust'],
    };
    expect(computeTriageBucket(rule, baseConfig)).toBe('safe');
  });

  it('returns decision for a rule with _warnings', () => {
    const rule = {
      name: 'warn-rule',
      source_zones: ['trust'],
      destination_zones: ['untrust'],
      _warnings: ['App mapping is approximate'],
    };
    expect(computeTriageBucket(rule, baseConfig)).toBe('decision');
  });

  it('returns decision for a rule with _interview_required', () => {
    const rule = {
      name: 'interview-rule',
      source_zones: ['trust'],
      destination_zones: ['untrust'],
      _interview_required: true,
    };
    expect(computeTriageBucket(rule, baseConfig)).toBe('decision');
  });

  it('returns unsupported for a rule with _unsupported array', () => {
    const rule = {
      name: 'unsupported-rule',
      source_zones: ['trust'],
      destination_zones: ['untrust'],
      _unsupported: ['SSL forward proxy'],
    };
    expect(computeTriageBucket(rule, baseConfig)).toBe('unsupported');
  });

  it('returns blocked for a rule referencing a missing zone', () => {
    const rule = {
      name: 'blocked-rule',
      source_zones: ['trust'],
      destination_zones: ['dmz'],
    };
    expect(computeTriageBucket(rule, baseConfig)).toBe('blocked');
  });

  it('treats "any" as a valid zone reference', () => {
    const rule = {
      name: 'any-rule',
      source_zones: ['any'],
      destination_zones: ['any'],
    };
    expect(computeTriageBucket(rule, baseConfig)).toBe('safe');
  });

  it('prioritizes blocked over unsupported', () => {
    const rule = {
      name: 'both-rule',
      source_zones: ['missing-zone'],
      destination_zones: ['untrust'],
      _unsupported: ['some feature'],
    };
    expect(computeTriageBucket(rule, baseConfig)).toBe('blocked');
  });

  it('prioritizes unsupported over decision', () => {
    const rule = {
      name: 'both-rule',
      source_zones: ['trust'],
      destination_zones: ['untrust'],
      _unsupported: ['some feature'],
      _warnings: ['some warning'],
    };
    expect(computeTriageBucket(rule, baseConfig)).toBe('unsupported');
  });

  it('returns safe for null rule', () => {
    expect(computeTriageBucket(null, baseConfig)).toBe('safe');
  });
});

describe('computeTriageCounts', () => {
  it('counts buckets correctly', () => {
    const policies = [
      { name: 'safe1', source_zones: ['trust'], destination_zones: ['untrust'] },
      { name: 'safe2', source_zones: ['trust'], destination_zones: ['untrust'] },
      { name: 'warn1', source_zones: ['trust'], destination_zones: ['untrust'], _warnings: ['w'] },
      { name: 'unsup1', source_zones: ['trust'], destination_zones: ['untrust'], _unsupported: ['x'] },
      { name: 'accepted1', source_zones: ['trust'], destination_zones: ['untrust'], _review_status: 'accepted' },
      { name: 'blocked1', source_zones: ['missing'], destination_zones: ['untrust'] },
    ];
    const counts = computeTriageCounts(policies, baseConfig);
    expect(counts.safe).toBe(2);
    expect(counts.decision).toBe(1);
    expect(counts.unsupported).toBe(1);
    expect(counts.blocked).toBe(1);
    expect(counts.accepted).toBe(1);
  });

  it('returns zeros for empty policies', () => {
    const counts = computeTriageCounts([], baseConfig);
    expect(counts.safe).toBe(0);
    expect(counts.decision).toBe(0);
    expect(counts.unsupported).toBe(0);
    expect(counts.blocked).toBe(0);
    expect(counts.accepted).toBe(0);
  });
});
