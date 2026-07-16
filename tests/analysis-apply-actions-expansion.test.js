/**
 * AnalysisApplicator apply cases added for the expanded bulk actions:
 * nat_shadowed (Remove All / Keep All), orphan_ref (Remove All / Keep All Report
 * Only), zones_no_policy (Remove All / Keep All Report Only). Advisory findings
 * (Warning Flag / Ignore) must remain config no-ops.
 */

import { describe, it, expect } from 'vitest';
import { AnalysisEngine, AnalysisApplicator } from '../src/analysis/config-analyzer.js';

describe('AnalysisApplicator: nat_shadowed', () => {
  function makeConfig() {
    return {
      security_policies: [],
      nat_rules: [
        { _rule_index: 1, name: 'broad', type: 'source', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['any'], dst_addresses: ['any'], service: 'any' },
        { _rule_index: 2, name: 'narrow-dup', type: 'source', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['10.0.0.0/8'], dst_addresses: ['any'], service: 'any' },
      ],
      zones: [], address_objects: [], address_groups: [], service_objects: [], service_groups: [],
    };
  }

  it('removes the shadowed NAT rule on Remove All, keeps the earlier broad rule', () => {
    const config = makeConfig();
    const finding = { ...AnalysisEngine._shadowedNat(config), selected: 'exclude' };
    expect(finding.count).toBe(1);
    AnalysisApplicator.apply(config, [finding]);
    const names = config.nat_rules.map(r => r.name);
    expect(names).toContain('broad');
    expect(names).not.toContain('narrow-dup');
  });

  it('keeps and annotates the shadowed NAT rule on Keep All', () => {
    const config = makeConfig();
    const finding = { ...AnalysisEngine._shadowedNat(config), selected: 'include' };
    AnalysisApplicator.apply(config, [finding]);
    const dup = config.nat_rules.find(r => r.name === 'narrow-dup');
    expect(dup).toBeTruthy();
    expect(dup._note || '').toMatch(/shadow/i);
  });
});

describe('AnalysisApplicator: orphan_ref', () => {
  function makeConfig() {
    return {
      security_policies: [
        { _rule_index: 1, name: 'good', action: 'allow', src_zones: ['t'], dst_zones: ['u'], src_addresses: ['any'], dst_addresses: ['any'], services: ['any'], applications: [] },
        { _rule_index: 2, name: 'bad-ref', action: 'allow', src_zones: ['t'], dst_zones: ['u'], src_addresses: ['NOPE_ADDR'], dst_addresses: ['any'], services: ['any'], applications: [] },
      ],
      address_objects: [], address_groups: [], service_objects: [], service_groups: [], nat_rules: [], zones: [],
    };
  }

  it('removes the policy with an undefined reference on Remove All', () => {
    const config = makeConfig();
    const finding = { ...AnalysisEngine._orphanReferences(config), selected: 'exclude' };
    expect(finding.count).toBe(1);
    AnalysisApplicator.apply(config, [finding]);
    const names = config.security_policies.map(p => p.name);
    expect(names).toContain('good');
    expect(names).not.toContain('bad-ref');
  });

  it('keeps and annotates the referencing policy on Keep All (Report Only)', () => {
    const config = makeConfig();
    const finding = { ...AnalysisEngine._orphanReferences(config), selected: 'include' };
    AnalysisApplicator.apply(config, [finding]);
    const bad = config.security_policies.find(p => p.name === 'bad-ref');
    expect(bad).toBeTruthy();
    expect(bad._note || '').toMatch(/undefined/i);
  });
});

describe('AnalysisApplicator: zones_no_policy', () => {
  function makeConfig() {
    return {
      security_policies: [
        { _rule_index: 1, name: 'p', action: 'allow', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['any'], dst_addresses: ['any'], services: ['any'], applications: [] },
      ],
      zones: [{ name: 'trust' }, { name: 'untrust' }, { name: 'orphan-zone' }],
      nat_rules: [], address_objects: [], address_groups: [], service_objects: [], service_groups: [],
    };
  }

  it('removes zones with no policy on Remove All', () => {
    const config = makeConfig();
    const finding = { ...AnalysisEngine._zonesWithoutPolicy(config), selected: 'exclude' };
    expect(finding.count).toBe(1);
    AnalysisApplicator.apply(config, [finding]);
    const names = config.zones.map(z => z.name);
    expect(names).toContain('trust');
    expect(names).not.toContain('orphan-zone');
  });

  it('keeps and annotates the unused zone on Keep All (Report Only)', () => {
    const config = makeConfig();
    const finding = { ...AnalysisEngine._zonesWithoutPolicy(config), selected: 'include' };
    AnalysisApplicator.apply(config, [finding]);
    const orphan = config.zones.find(z => z.name === 'orphan-zone');
    expect(orphan).toBeTruthy();
    expect(orphan._note || '').toMatch(/polic/i);
  });
});

describe('AnalysisApplicator: advisory findings are config no-ops', () => {
  it('ignore/flag on weak_ike does not mutate policies or zones', () => {
    const config = {
      security_policies: [{ _rule_index: 1, name: 'p', action: 'allow', src_zones: ['t'], dst_zones: ['u'], src_addresses: ['any'], dst_addresses: ['any'], services: ['any'], applications: [] }],
      zones: [{ name: 't' }], nat_rules: [], address_objects: [], address_groups: [], service_objects: [], service_groups: [],
      vpn_tunnels: [{ name: 'v', ike_proposal: { encryption: 'des', dh_group: 'group2' } }],
    };
    const before = JSON.stringify(config.security_policies) + JSON.stringify(config.zones);
    const finding = { id: 'weak_ike', count: 1, items: [{ key: 'v', label: 'v' }], selected: 'ignore' };
    AnalysisApplicator.apply(config, [finding]);
    expect(JSON.stringify(config.security_policies) + JSON.stringify(config.zones)).toBe(before);
  });
});
