/**
 * AnalysisApplicator: redundant_rule apply parity with shadowed.
 *
 * The Redundant Rules finding gains a Keep All / Remove All Redundant bulk
 * action, so the applicator must actually remove the redundant (exact-duplicate)
 * rules when `exclude` is selected, and annotate them (keep the earlier
 * original) when kept — mirroring the `shadowed` case.
 */

import { describe, it, expect } from 'vitest';
import { AnalysisEngine, AnalysisApplicator } from '../src/analysis/config-analyzer.js';

/** Two exact-duplicate allow rules + one distinct rule. */
function makeConfig() {
  return {
    security_policies: [
      { _rule_index: 1, name: 'web-a', action: 'allow', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['any'], dst_addresses: ['any'], applications: [], services: ['tcp-443'] },
      { _rule_index: 2, name: 'other', action: 'allow', src_zones: ['trust'], dst_zones: ['dmz'], src_addresses: ['any'], dst_addresses: ['any'], applications: [], services: ['tcp-22'] },
      { _rule_index: 3, name: 'web-dup', action: 'allow', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['any'], dst_addresses: ['any'], applications: [], services: ['tcp-443'] },
    ],
    address_objects: [], address_groups: [], service_objects: [], service_groups: [], nat_rules: [],
  };
}

describe('AnalysisApplicator redundant_rule', () => {
  it('removes the redundant duplicate when Remove All is selected, keeping the original', () => {
    const config = makeConfig();
    const finding = { ...AnalysisEngine._redundantRules(config), selected: 'exclude' };
    expect(finding.count).toBe(1); // rule #3 duplicates #1

    AnalysisApplicator.apply(config, [finding]);

    const names = config.security_policies.map(p => p.name);
    expect(names).toContain('web-a');   // original kept
    expect(names).toContain('other');   // untouched
    expect(names).not.toContain('web-dup'); // redundant removed
  });

  it('keeps and annotates the redundant rule when Keep All is selected', () => {
    const config = makeConfig();
    const finding = { ...AnalysisEngine._redundantRules(config), selected: 'include' };

    AnalysisApplicator.apply(config, [finding]);

    const dup = config.security_policies.find(p => p.name === 'web-dup');
    expect(dup).toBeTruthy();               // not removed
    expect(dup._note || '').toMatch(/redundant/i); // annotated
  });

  it('honors a per-item Keep override even when bulk is Remove All', () => {
    const config = makeConfig();
    const base = AnalysisEngine._redundantRules(config);
    const dupKey = base.items[0].key;
    const finding = { ...base, selected: 'exclude', itemOverrides: { [dupKey]: 'include' } };

    AnalysisApplicator.apply(config, [finding]);

    expect(config.security_policies.map(p => p.name)).toContain('web-dup');
  });
});
