/**
 * Tests for operational cleanup checks (GitHub issue #50, Group D).
 *
 * Covers: large groups, nested groups, undescribed objects, undescribed policies.
 */

import { describe, it, expect } from 'vitest';
import { AnalysisEngine } from '../src/analysis/config-analyzer.js';

describe('Operational Cleanup Checks', () => {
  describe('_largeGroups', () => {
    it('flags address groups with 50+ members', () => {
      const config = {
        address_groups: [
          { name: 'huge-addr', members: new Array(50).fill('dummy') },
          { name: 'normal-addr', members: new Array(49).fill('dummy') },
        ],
        service_groups: [],
        application_groups: [],
      };
      const result = AnalysisEngine._largeGroups(config);
      expect(result.id).toBe('large_group');
      expect(result.count).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].key).toBe('huge-addr');
      expect(result.items[0].label).toMatch(/huge-addr \(50 members\)/);
    });

    it('flags service groups with 50+ members', () => {
      const config = {
        address_groups: [],
        service_groups: [
          { name: 'huge-svc', members: new Array(75).fill('x') },
        ],
        application_groups: [],
      };
      const result = AnalysisEngine._largeGroups(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/huge-svc \(75 members\)/);
    });

    it('flags application groups with 50+ members', () => {
      const config = {
        address_groups: [],
        service_groups: [],
        application_groups: [
          { name: 'huge-app', members: new Array(100).fill('app') },
        ],
      };
      const result = AnalysisEngine._largeGroups(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/huge-app \(100 members\)/);
    });

    it('returns empty finding when no large groups', () => {
      const config = {
        address_groups: [{ name: 'small', members: ['a', 'b'] }],
        service_groups: [],
        application_groups: [],
      };
      const result = AnalysisEngine._largeGroups(config);
      expect(result.count).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('handles missing group arrays gracefully', () => {
      const config = {};
      const result = AnalysisEngine._largeGroups(config);
      expect(result.count).toBe(0);
    });
  });

  describe('_nestedGroups', () => {
    it('flags address group with depth 3', () => {
      const config = {
        address_groups: [
          { name: 'leaf', members: ['1.1.1.1'] },
          { name: 'mid', members: ['leaf'] },
          { name: 'top', members: ['mid'] },
        ],
        service_groups: [],
        application_groups: [],
      };
      const result = AnalysisEngine._nestedGroups(config);
      expect(result.id).toBe('nested_group');
      expect(result.count).toBe(1);
      expect(result.items[0].key).toBe('top');
      expect(result.items[0].label).toMatch(/top \(depth 3\)/);
    });

    it('does not flag depth 2', () => {
      const config = {
        address_groups: [
          { name: 'leaf', members: ['1.1.1.1'] },
          { name: 'mid', members: ['leaf'] },
        ],
        service_groups: [],
        application_groups: [],
      };
      const result = AnalysisEngine._nestedGroups(config);
      expect(result.count).toBe(0);
    });

    it('flags service group with depth 3', () => {
      const config = {
        address_groups: [],
        service_groups: [
          { name: 's1', members: ['tcp-80'] },
          { name: 's2', members: ['s1'] },
          { name: 's3', members: ['s2'] },
        ],
        application_groups: [],
      };
      const result = AnalysisEngine._nestedGroups(config);
      expect(result.count).toBe(1);
      expect(result.items[0].key).toBe('s3');
    });

    it('flags application group with depth 3', () => {
      const config = {
        address_groups: [],
        service_groups: [],
        application_groups: [
          { name: 'a1', members: ['http'] },
          { name: 'a2', members: ['a1'] },
          { name: 'a3', members: ['a2'] },
        ],
      };
      const result = AnalysisEngine._nestedGroups(config);
      expect(result.count).toBe(1);
      expect(result.items[0].key).toBe('a3');
    });

    it('handles cycles gracefully without hanging', () => {
      const config = {
        address_groups: [
          { name: 'A', members: ['B'] },
          { name: 'B', members: ['C'] },
          { name: 'C', members: ['A'] },
        ],
        service_groups: [],
        application_groups: [],
      };
      const result = AnalysisEngine._nestedGroups(config);
      // Should not hang; cycle breaks recursion
      expect(result.id).toBe('nested_group');
      // May flag some or none depending on cycle handling; main test is no hang
    });

    it('produces deterministic depth for cycles regardless of array order', () => {
      // Build cyclic address-group set A→B→C→A
      const configForward = {
        address_groups: [
          { name: 'A', members: ['B'] },
          { name: 'B', members: ['C'] },
          { name: 'C', members: ['A'] },
        ],
        service_groups: [],
        application_groups: [],
      };

      const configReverse = {
        address_groups: [
          { name: 'C', members: ['A'] },
          { name: 'B', members: ['C'] },
          { name: 'A', members: ['B'] },
        ],
        service_groups: [],
        application_groups: [],
      };

      const resultForward = AnalysisEngine._nestedGroups(configForward);
      const resultReverse = AnalysisEngine._nestedGroups(configReverse);

      // Extract flagged group names
      const flaggedForward = new Set(resultForward.items.map(i => i.key));
      const flaggedReverse = new Set(resultReverse.items.map(i => i.key));

      // Deterministic: same groups flagged regardless of order
      expect(flaggedForward).toEqual(flaggedReverse);
      expect(resultForward.count).toBe(resultReverse.count);
    });

    it('returns empty finding for shallow groups', () => {
      const config = {
        address_groups: [
          { name: 'flat', members: ['10.0.0.1', '10.0.0.2'] },
        ],
        service_groups: [],
        application_groups: [],
      };
      const result = AnalysisEngine._nestedGroups(config);
      expect(result.count).toBe(0);
    });

    it('handles missing group arrays', () => {
      const config = {};
      const result = AnalysisEngine._nestedGroups(config);
      expect(result.count).toBe(0);
    });
  });

  describe('_undescribedObjects', () => {
    it('flags address objects with no description', () => {
      const config = {
        address_objects: [
          { name: 'obj1', description: '' },
          { name: 'obj2', description: '  ' },
          { name: 'obj3', description: 'documented' },
          { name: 'obj4' },
        ],
        service_objects: [],
        address_groups: [],
        service_groups: [],
      };
      const result = AnalysisEngine._undescribedObjects(config);
      expect(result.id).toBe('undescribed_object');
      expect(result.count).toBe(3); // obj1, obj2, obj4
    });

    it('flags service objects with no description', () => {
      const config = {
        address_objects: [],
        service_objects: [
          { name: 'svc1', description: '' },
          { name: 'svc2', description: 'has desc' },
        ],
        address_groups: [],
        service_groups: [],
      };
      const result = AnalysisEngine._undescribedObjects(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toContain('svc1');
    });

    it('flags address groups with no description', () => {
      const config = {
        address_objects: [],
        service_objects: [],
        address_groups: [
          { name: 'grp1', description: null },
          { name: 'grp2', description: 'desc' },
        ],
        service_groups: [],
      };
      const result = AnalysisEngine._undescribedObjects(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toContain('grp1');
    });

    it('flags service groups with no description', () => {
      const config = {
        address_objects: [],
        service_objects: [],
        address_groups: [],
        service_groups: [
          { name: 'sgrp1' },
          { name: 'sgrp2', description: 'described' },
        ],
      };
      const result = AnalysisEngine._undescribedObjects(config);
      expect(result.count).toBe(1);
    });

    it('returns empty finding when all described', () => {
      const config = {
        address_objects: [{ name: 'o1', description: 'desc' }],
        service_objects: [{ name: 's1', description: 'desc' }],
        address_groups: [{ name: 'ag1', description: 'desc' }],
        service_groups: [{ name: 'sg1', description: 'desc' }],
      };
      const result = AnalysisEngine._undescribedObjects(config);
      expect(result.count).toBe(0);
    });

    it('handles missing arrays', () => {
      const config = {};
      const result = AnalysisEngine._undescribedObjects(config);
      expect(result.count).toBe(0);
    });
  });

  describe('_undescribedPolicies', () => {
    it('flags non-implicit policies with no description', () => {
      const config = {
        security_policies: [
          { name: 'p1', _rule_index: 1, description: '' },
          { name: 'p2', _rule_index: 2, description: '  ' },
          { name: 'p3', _rule_index: 3, description: 'documented' },
          { name: 'p4', _rule_index: 4 },
        ],
      };
      const result = AnalysisEngine._undescribedPolicies(config);
      expect(result.id).toBe('undescribed_policy');
      expect(result.count).toBe(3); // p1, p2, p4
      expect(result.items).toHaveLength(3);
    });

    it('ignores implicit policies', () => {
      const config = {
        security_policies: [
          { name: 'implicit-deny', _implicit: true, description: '' },
          { name: 'regular', _rule_index: 1, description: '' },
        ],
      };
      const result = AnalysisEngine._undescribedPolicies(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toContain('regular');
    });

    it('returns empty finding when all described', () => {
      const config = {
        security_policies: [
          { name: 'p1', _rule_index: 1, description: 'desc' },
        ],
      };
      const result = AnalysisEngine._undescribedPolicies(config);
      expect(result.count).toBe(0);
    });

    it('handles missing policies array', () => {
      const config = {};
      const result = AnalysisEngine._undescribedPolicies(config);
      expect(result.count).toBe(0);
    });

    it('uses pKey and pLabel pattern', () => {
      const config = {
        security_policies: [
          { name: 'rule-one', _rule_index: 42, description: '' },
          { name: 'rule-two', description: '' }, // no _rule_index
        ],
      };
      const result = AnalysisEngine._undescribedPolicies(config);
      expect(result.count).toBe(2);
      expect(result.items[0].label).toBe('#42 rule-one');
      expect(result.items[1].label).toBe('rule-two');
    });
  });
});
