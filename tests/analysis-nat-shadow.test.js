/**
 * NAT shadow detection tests (issue #57).
 * Tests `AnalysisEngine._shadowedNat(config)`.
 */
import { describe, test, expect } from 'vitest';
import { AnalysisEngine } from '../src/analysis/config-analyzer.js';

describe('_shadowedNat', () => {
  test('flags later source NAT shadowed by earlier broad source NAT', () => {
    const config = {
      nat_rules: [
        {
          name: 'broad-nat',
          _rule_index: 0,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
        },
        {
          name: 'narrow-nat',
          _rule_index: 1,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].label).toContain('narrow-nat');
    expect(result.items[0].label).toContain('broad-nat');
    expect(result.description).toContain('shadowed');
  });

  test('does NOT flag when earlier source NAT is constrained to specific src_address', () => {
    const config = {
      nat_rules: [
        {
          name: 'narrow-nat-1',
          _rule_index: 0,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
        {
          name: 'narrow-nat-2',
          _rule_index: 1,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.2.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('No shadowed NAT rules');
  });

  test('does NOT flag when NAT types differ (source vs destination)', () => {
    const config = {
      nat_rules: [
        {
          name: 'source-nat',
          _rule_index: 0,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
        },
        {
          name: 'dest-nat',
          _rule_index: 1,
          type: 'destination',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('No shadowed NAT rules');
  });

  test('does NOT flag when earlier rule has protocol constraint (conservative)', () => {
    const config = {
      nat_rules: [
        {
          name: 'tcp-constrained-nat',
          _rule_index: 0,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
          match_protocol: 'tcp',
        },
        {
          name: 'any-protocol-nat',
          _rule_index: 1,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('No shadowed NAT rules');
  });

  test('does NOT flag when earlier rule has port constraint (conservative)', () => {
    const config = {
      nat_rules: [
        {
          name: 'port-constrained-nat',
          _rule_index: 0,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
          match_port: 443,
        },
        {
          name: 'any-port-nat',
          _rule_index: 1,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('No shadowed NAT rules');
  });

  test('does NOT flag when zones do not overlap', () => {
    const config = {
      nat_rules: [
        {
          name: 'dmz-nat',
          _rule_index: 0,
          type: 'source',
          src_zones: ['dmz'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
        },
        {
          name: 'trust-nat',
          _rule_index: 1,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('No shadowed NAT rules');
  });

  test('handles empty nat_rules array without crashing', () => {
    const config = { nat_rules: [] };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('No shadowed NAT rules');
  });

  test('handles single NAT rule without crashing', () => {
    const config = {
      nat_rules: [
        {
          name: 'only-nat',
          _rule_index: 0,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('No shadowed NAT rules');
  });

  test('handles missing nat_rules property without crashing', () => {
    const config = {};

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('No shadowed NAT rules');
  });

  test('skips shadow detection for over 2000 NAT rules', () => {
    const largeRuleSet = Array.from({ length: 2001 }, (_, i) => ({
      name: `nat-${i}`,
      _rule_index: i,
      type: 'source',
      src_zones: ['trust'],
      dst_zones: ['untrust'],
      src_addresses: ['any'],
      dst_addresses: ['any'],
    }));

    const config = { nat_rules: largeRuleSet };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.description).toContain('over 2000 rules');
  });

  test('uses source_zones and destination_zones as fallback zone fields', () => {
    const config = {
      nat_rules: [
        {
          name: 'broad-nat',
          _rule_index: 0,
          type: 'source',
          source_zones: ['trust'],
          destination_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
        },
        {
          name: 'narrow-nat',
          _rule_index: 1,
          type: 'source',
          source_zones: ['trust'],
          destination_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].label).toContain('narrow-nat');
    expect(result.items[0].label).toContain('broad-nat');
  });

  test('formats rule labels using _rule_index when available', () => {
    const config = {
      nat_rules: [
        {
          name: 'broad-nat',
          _rule_index: 5,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
        },
        {
          name: 'narrow-nat',
          _rule_index: 10,
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(1);
    expect(result.items[0].label).toContain('#10');
    expect(result.items[0].label).toContain('#5');
  });

  test('formats rule labels using name when _rule_index is missing', () => {
    const config = {
      nat_rules: [
        {
          name: 'broad-nat',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['any'],
        },
        {
          name: 'narrow-nat',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
        },
      ],
    };

    const result = AnalysisEngine._shadowedNat(config);

    expect(result.id).toBe('nat_shadowed');
    expect(result.count).toBe(1);
    expect(result.items[0].label).toContain('narrow-nat');
    expect(result.items[0].label).toContain('broad-nat');
    expect(result.items[0].label).not.toContain('#');
  });
});
