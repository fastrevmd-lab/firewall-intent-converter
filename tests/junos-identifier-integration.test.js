import { describe, expect, it } from 'vitest';

import { convertToSrxSetCommands } from '../src/converters/srx-converter.js';
import { setMapVendorApp } from '../src/parsers/parser-utils.js';
import {
  JunosIdentifierPlanningError,
  planJunosIdentifiers,
  planMergedJunosIdentifiers,
} from '../src/security/junos-identifiers.js';
import { getJunosEmission, loadAppMappings, mapVendorApp } from '../src/utils/app-mappings.js';

const storage = {};
global.localStorage = {
  getItem: key => storage[key] || null,
  setItem: (key, value) => { storage[key] = value; },
  removeItem: key => { delete storage[key]; },
};

await loadAppMappings();
setMapVendorApp(mapVendorApp);

function baseConfig(overrides = {}) {
  return {
    metadata: { source_vendor: 'panos' },
    zones: [],
    address_objects: [],
    address_groups: [],
    service_objects: [],
    service_groups: [],
    applications: [],
    application_groups: [],
    schedules: [],
    security_policies: [],
    nat_rules: [],
    ...overrides,
  };
}

function policy(name, fromZone, toZone, destination, extra = {}) {
  return {
    name,
    src_zones: [fromZone],
    dst_zones: [toZone],
    src_addresses: ['any'],
    dst_addresses: [destination],
    applications: ['junos-https'],
    services: [],
    action: 'allow',
    ...extra,
  };
}

function collisionConfig() {
  return baseConfig({
    zones: [
      { name: 'trust', interfaces: [] },
      { name: 'untrust', interfaces: [] },
    ],
    address_objects: [
      { name: 'Web Server', type: 'host', value: '192.0.2.10/32' },
      { name: 'Web@Server', type: 'host', value: '192.0.2.11/32' },
    ],
    address_groups: [{
      name: 'Web Farm',
      members: ['Web Server', 'Web@Server'],
    }],
    security_policies: [
      policy('Allow Web One', 'trust', 'untrust', 'Web Server'),
      policy('Allow Web Two', 'trust', 'untrust', 'Web@Server'),
    ],
  });
}

describe('Set identifier-plan integration', () => {
  it('uses collision-safe address names for definitions, groups, and policies', () => {
    const result = convertToSrxSetCommands(collisionConfig());
    const addressEntries = result.identifierMappings.entries.filter(
      entry => entry.namespace === 'address-book-entry' && entry.kind === 'address',
    );

    expect(new Set(addressEntries.map(entry => entry.outputName)).size).toBe(2);
    for (const entry of addressEntries) {
      const value = entry.sourceName === 'Web Server' ? '192.0.2.10/32' : '192.0.2.11/32';
      expect(result.commands).toContain(
        `set security address-book global address ${entry.outputName} ${value}`,
      );
      expect(result.commands.some(command => command.endsWith(` ${entry.outputName}`))).toBe(true);
    }
    expect(result.summary.identifier_collisions_resolved).toBe(2);
    expect(result.warnings.filter(item => item.subType === 'identifier_collision')).toHaveLength(2);
  });

  it('rejects duplicate policy names within one zone pair', () => {
    const config = baseConfig({
      security_policies: [
        policy('Repeated Policy', 'trust', 'untrust', 'any'),
        policy('Repeated Policy', 'trust', 'untrust', 'any'),
      ],
    });

    expect(() => convertToSrxSetCommands(config)).toThrow(expect.objectContaining({
      name: 'JunosIdentifierPlanningError',
      code: 'duplicate_definition',
    }));
  });

  it('allows the same policy name in different zone pairs', () => {
    const config = baseConfig({
      security_policies: [
        policy('Repeated Policy', 'trust', 'untrust', 'any'),
        policy('Repeated Policy', 'dmz', 'untrust', 'any'),
      ],
    });

    const result = convertToSrxSetCommands(config);
    const policies = result.identifierMappings.entries.filter(
      entry => entry.namespace === 'security-policy',
    );

    expect(policies).toHaveLength(2);
    expect(policies.map(entry => entry.outputName)).toEqual(['Repeated-Policy', 'Repeated-Policy']);
    expect(result.commands).toContain(
      'set security policies from-zone trust to-zone untrust policy Repeated-Policy then permit',
    );
    expect(result.commands).toContain(
      'set security policies from-zone dmz to-zone untrust policy Repeated-Policy then permit',
    );
  });

  it('uses collision-safe NAT rule and pool names for definitions and references', () => {
    const config = baseConfig({
      zones: [
        { name: 'trust', interfaces: [] },
        { name: 'untrust', interfaces: [] },
      ],
      address_objects: [
        { name: 'Pool-One', type: 'host', value: '198.51.100.10/32' },
        { name: 'Pool-Two', type: 'host', value: '198.51.100.11/32' },
      ],
      nat_rules: [
        {
          name: 'Outbound NAT', type: 'source',
          src_zones: ['trust'], dst_zones: ['untrust'],
          src_addresses: ['any'], dst_addresses: ['any'],
          translated_src: { type: 'dynamic-ip-pool', addresses: ['Pool-One'] },
        },
        {
          name: 'Outbound@NAT', type: 'source',
          src_zones: ['trust'], dst_zones: ['untrust'],
          src_addresses: ['any'], dst_addresses: ['any'],
          translated_src: { type: 'dynamic-ip-pool', addresses: ['Pool-Two'] },
        },
      ],
    });

    const result = convertToSrxSetCommands(config);
    const rules = result.identifierMappings.entries.filter(entry => entry.namespace === 'nat-rule');
    const pools = result.identifierMappings.entries.filter(
      entry => entry.namespace === 'source-nat-pool',
    );

    expect(new Set(rules.map(entry => entry.outputName)).size).toBe(2);
    expect(new Set(pools.map(entry => entry.outputName)).size).toBe(2);
    for (const rule of rules) {
      expect(result.commands.some(command => command.includes(` rule ${rule.outputName} `))).toBe(true);
    }
    for (const pool of pools) {
      expect(result.commands.some(command => (
        command.startsWith(`set security nat source pool ${pool.outputName} address `)
      ))).toBe(true);
      expect(result.commands.some(command => command.endsWith(` source-nat pool ${pool.outputName}`)))
        .toBe(true);
    }
  });

  it('keeps predefined applications as literals without allocating custom definitions', () => {
    const config = baseConfig({
      service_objects: [{ name: 'HTTPS', protocol: 'tcp', port_range: '443' }],
      security_policies: [policy('Allow HTTPS', 'trust', 'untrust', 'any', {
        applications: ['junos-https'],
        services: ['HTTPS'],
      })],
    });

    const result = convertToSrxSetCommands(config);
    const applicationEntries = result.identifierMappings.entries.filter(
      entry => entry.namespace === 'application-entry',
    );

    expect(applicationEntries).toHaveLength(0);
    expect(result.commands).toContain(
      'set security policies from-zone trust to-zone untrust policy Allow-HTTPS match application junos-https',
    );
    expect(result.commands.some(command => command.startsWith('set applications application HTTPS ')))
      .toBe(false);
  });

  it('uses planned target, zone, service, application, and schedule names end to end', () => {
    const config = baseConfig({
      zones: [
        { name: 'Inside Zone', interfaces: [] },
        { name: 'Inside@Zone', interfaces: [] },
        { name: 'Outside', interfaces: [] },
      ],
      service_objects: [
        { name: 'Service One', protocol: 'tcp', port_range: '8080' },
        { name: 'Service@One', protocol: 'tcp', port_range: '8081' },
      ],
      service_groups: [{
        name: 'Service Bundle',
        members: ['Service One', 'Service@One'],
      }],
      applications: [
        { name: 'Application One', protocol: 'tcp', port: '9000' },
        { name: 'Application@One', protocol: 'tcp', port: '9001' },
      ],
      schedules: [
        { name: 'Night Window', type: 'recurring', days: ['mon'], start: '20:00', end: '21:00' },
        { name: 'Night@Window', type: 'recurring', days: ['tue'], start: '20:00', end: '21:00' },
      ],
      security_policies: [
        policy('First Core', 'Inside Zone', 'Outside', 'any', {
          applications: ['Application One'],
          services: ['Service Bundle'],
          schedule: 'Night Window',
        }),
        policy('Second Core', 'Inside@Zone', 'Outside', 'any', {
          applications: ['Application@One'],
          services: ['Service@One'],
          schedule: 'Night@Window',
        }),
      ],
    });

    const result = convertToSrxSetCommands(
      config,
      {},
      { type: 'logical-system', name: 'Branch Office' },
    );
    const entries = result.identifierMappings.entries;
    const targetName = entries.find(entry => entry.namespace === 'target-context').outputName;

    expect(result.commands.filter(command => command.startsWith('set ')).every(command => (
      command.startsWith(`set logical-systems ${targetName} `)
    ))).toBe(true);
    for (const namespace of ['zone', 'application-entry', 'scheduler']) {
      for (const entry of entries.filter(item => item.namespace === namespace && item.definitionPath)) {
        expect(result.commands.some(command => command.includes(` ${entry.outputName}`))).toBe(true);
      }
    }
    for (const entry of entries.filter(item => item.referencePaths.length > 0)) {
      expect(result.commands.some(command => command.includes(` ${entry.outputName}`))).toBe(true);
    }
  });

  it('honors injected path prefixes and target paths without replanning output names', () => {
    const first = baseConfig({ zones: [{ name: 'Inside Zone', interfaces: [] }] });
    const second = baseConfig({ zones: [{ name: 'Inside@Zone', interfaces: [] }] });
    const slots = [
      { lsName: 'Branch Office', intermediateConfig: first },
      { lsName: 'Branch@Office', intermediateConfig: second },
    ];
    const identifierPlan = planMergedJunosIdentifiers(slots);
    const result = convertToSrxSetCommands(
      first,
      {},
      { type: 'logical-system', name: slots[0].lsName },
      {
        identifierPlan,
        pathPrefix: 'configSlots[0].intermediateConfig.',
        targetContextPath: 'configSlots[0].lsName',
      },
    );
    const targetName = identifierPlan.nameForDefinition('configSlots[0].lsName');
    const zoneName = identifierPlan.nameForDefinition(
      'configSlots[0].intermediateConfig.zones[0].name',
    );

    expect(result.commands).toContain(
      `set logical-systems ${targetName} security zones security-zone ${zoneName}`,
    );
    expect(targetName).not.toBe(identifierPlan.nameForDefinition('configSlots[1].lsName'));
  });

  it('uses planned generated names for multi-port, custom, and unmapped applications', () => {
    const config = baseConfig({
      service_objects: [{ name: 'Discrete Service', protocol: 'tcp', port_range: '8443,9443' }],
      applications: [{ name: 'Discrete App', protocol: 'udp', port: '5000,5001' }],
      security_policies: [policy('Generated Apps', 'trust', 'untrust', 'any', {
        applications: ['Discrete App', 'adobe-cloud', 'foo bar', 'foo@bar'],
        services: ['Discrete Service'],
      })],
    });

    const result = convertToSrxSetCommands(config);
    const generated = result.identifierMappings.entries.filter(entry => (
      entry.namespace === 'application-entry' && entry.resolution.startsWith('generated')
    ));

    expect(generated.length).toBeGreaterThanOrEqual(9);
    for (const entry of generated) {
      expect(result.commands.some(command => command.includes(` ${entry.outputName}`))).toBe(true);
    }
    const unmapped = generated.filter(entry => ['foo bar', 'foo@bar'].includes(entry.sourceName));
    expect(new Set(unmapped.map(entry => entry.outputName)).size).toBe(2);
    for (const entry of unmapped) {
      expect(result.commands.some(command => command.endsWith(` application ${entry.outputName}`)))
        .toBe(true);
    }
  });

  it('emits planned generated applications discovered through expanded application groups', () => {
    const config = baseConfig({
      application_groups: [{
        name: 'Expanded Group',
        members: ['adobe-cloud', 'group-only unknown'],
      }],
    });

    const result = convertToSrxSetCommands(config);
    const generated = result.identifierMappings.entries.filter(entry => (
      entry.namespace === 'application-entry' && entry.resolution.startsWith('generated')
    ));

    expect(generated.length).toBeGreaterThanOrEqual(2);
    for (const entry of generated) {
      expect(result.commands.some(command => command.includes(` ${entry.outputName} `)))
        .toBe(true);
    }
  });

  it('uses planned security-profile and generated policy names in definitions and attachments', () => {
    const config = baseConfig({
      security_policies: [
        policy('Profile One', 'trust', 'untrust', 'any', {
          security_profiles: { virus: 'Strict AV' },
        }),
        policy('Profile Two', 'trust', 'untrust', 'any', {
          security_profiles: { virus: 'Strict@AV' },
        }),
      ],
    });

    const result = convertToSrxSetCommands(config);
    const profiles = result.identifierMappings.entries.filter(
      entry => entry.namespace === 'utm-anti-virus-profile',
    );
    const utmPolicies = result.identifierMappings.entries.filter(
      entry => entry.namespace === 'utm-policy',
    );

    expect(new Set(profiles.map(entry => entry.outputName)).size).toBe(2);
    for (const profile of profiles) {
      expect(result.commands.some(command => command.includes(` profile ${profile.outputName} `)))
        .toBe(true);
      expect(result.commands.some(command => command.endsWith(`-profile ${profile.outputName}`)))
        .toBe(true);
    }
    for (const utmPolicy of utmPolicies) {
      expect(result.commands.some(command => command.includes(` utm-policy ${utmPolicy.outputName} `)))
        .toBe(true);
      expect(result.commands.some(command => command.endsWith(` utm-policy ${utmPolicy.outputName}`)))
        .toBe(true);
    }
  });

  it('does not emit placeholder applications for explicit multi-port definitions', () => {
    const config = baseConfig({
      service_objects: [{ name: 'Explicit Service', protocol: 'tcp', port_range: '8080,8081' }],
      applications: [{ name: 'Explicit App', protocol: 'udp', port: '9000,9001' }],
      security_policies: [policy('Explicit Multi', 'trust', 'untrust', 'any', {
        applications: ['Explicit App'],
        services: ['Explicit Service'],
      })],
    });
    const result = convertToSrxSetCommands(config);
    const setEntries = result.identifierMappings.entries.filter(entry => (
      entry.namespace === 'application-entry'
      && entry.kind === 'application-set'
    ));

    expect(setEntries).toHaveLength(2);
    for (const entry of setEntries) {
      expect(result.commands.some(command => (
        command.startsWith(`set applications application-set ${entry.outputName} application `)
      ))).toBe(true);
      expect(result.commands.some(command => (
        command.startsWith(`set applications application ${entry.outputName} `)
      ))).toBe(false);
    }
    expect(result.commands.join('\n')).not.toContain('INTERVIEW REQUIRED: Explicit App');
  });

  it('uses exact generated child lookups in an injected multi-context plan', () => {
    const customName = 'apple-push-notifications';
    const ports = getJunosEmission(customName, 'panos').ports.map(String);
    const collidingApplications = ports.map(port => ({
      name: `${customName}-p${port}`,
      protocol: 'tcp',
      port: '65000',
    }));
    const configFor = applications => baseConfig({
      applications,
      security_policies: [policy('Apple Push', 'trust', 'untrust', 'any', {
        applications: [customName],
      })],
    });
    const first = configFor(collidingApplications);
    const second = configFor([]);
    const slots = [
      { lsName: 'branch-a', intermediateConfig: first },
      { lsName: 'branch-b', intermediateConfig: second },
    ];
    const identifierPlan = planMergedJunosIdentifiers(slots);
    const result = convertToSrxSetCommands(
      second,
      {},
      { type: 'logical-system', name: 'branch-b' },
      {
        identifierPlan,
        pathPrefix: 'configSlots[1].intermediateConfig.',
        targetContextPath: 'configSlots[1].lsName',
      },
    );
    const firstOwner = 'configSlots[0].intermediateConfig.security_policies[0].applications[0]';
    const secondOwner = 'configSlots[1].intermediateConfig.security_policies[0].applications[0]';

    for (const port of ports) {
      const role = `custom-application-port:${port}`;
      const firstName = identifierPlan.nameForGenerated(firstOwner, role);
      const secondName = identifierPlan.nameForGenerated(secondOwner, role);
      expect(secondName).not.toBe(firstName);
      expect(result.commands.some(command => command.includes(` application ${secondName}`)))
        .toBe(true);
      expect(result.commands.some(command => command.includes(` application ${firstName}`)))
        .toBe(false);
    }
  });

  it('preserves planned mysql literals beside colliding custom names', () => {
    const config = baseConfig({
      applications: [{ name: 'custom-mysql', protocol: 'tcp', port: '13306' }],
      security_policies: [policy('Database', 'trust', 'untrust', 'any', {
        applications: ['mysql'],
      })],
    });
    const result = convertToSrxSetCommands(config);

    expect(result.commands).toContain(
      'set security policies from-zone trust to-zone untrust policy Database match application junos-mysql',
    );
    expect(result.commands).toContain('set applications application custom-mysql destination-port 13306');
    expect(result.commands).not.toContain('set applications application custom-mysql destination-port 3306');
    expect(result.commands.join('\n')).not.toContain('Auto-generated Missing Application Definitions');
  });

  it('catalogs and emits DNS-security rule names through exact profile references', () => {
    const config = baseConfig({
      security_policies: [policy('DNS Security', 'trust', 'untrust', 'any', {
        security_profiles: { 'dns-security': 'Strict DNS' },
      })],
      security_profile_definitions: {
        'dns-security:Strict DNS': { blockedDomains: ['bad.example'] },
      },
    });
    const result = convertToSrxSetCommands(config);
    const dnsRule = result.identifierMappings.entries.find(
      entry => entry.namespace === 'dns-filtering-rule',
    );

    expect(dnsRule.referencePaths).toContain(
      'security_policies[0].security_profiles.dns-security',
    );
    expect(result.commands).toContain(
      `set services dns-filtering dns-filtering-rule ${dnsRule.outputName} match-name bad.example`,
    );
  });

  it('keeps NAT zone pairs structured when a zone contains the old delimiter', () => {
    const config = baseConfig({
      zones: [
        { name: 'a->b', interfaces: [] },
        { name: 'outside', interfaces: [] },
      ],
      nat_rules: [{
        name: 'Arrow NAT', type: 'source',
        src_zones: ['a->b'], dst_zones: ['outside'],
        src_addresses: ['any'], dst_addresses: ['any'],
        translated_src: { type: 'interface' },
      }],
    });
    const result = convertToSrxSetCommands(config);
    const fromZone = result.identifierMappings.entries.find(entry => (
      entry.namespace === 'zone' && entry.sourceName === 'a->b'
    )).outputName;
    const ruleSet = result.identifierMappings.entries.find(
      entry => entry.namespace === 'nat-rule-set',
    ).outputName;
    const rule = result.identifierMappings.entries.find(
      entry => entry.namespace === 'nat-rule',
    ).outputName;

    expect(result.commands).toContain(`set security nat source rule-set ${ruleSet} from zone ${fromZone}`);
    expect(result.commands.some(command => command.includes(
      `security nat source rule-set ${ruleSet} rule ${rule} `,
    ))).toBe(true);
  });

  it('uses alias-form NAT zone fields and effective paths for empty arrays', () => {
    const config = baseConfig({
      zones: [
        { name: 'inside', interfaces: [] },
        { name: 'outside', interfaces: [] },
      ],
      nat_rules: [
        {
          name: 'Alias NAT', type: 'source',
          source_zones: ['inside'], destination_zones: ['outside'],
          src_addresses: ['any'], dst_addresses: ['any'],
          translated_src: { type: 'interface' },
        },
        {
          name: 'Empty Alias NAT', type: 'source',
          source_zones: [], destination_zones: [],
          src_addresses: ['any'], dst_addresses: ['any'],
          translated_src: { type: 'interface' },
        },
      ],
    });
    const plan = planJunosIdentifiers(config);
    const referenceLookups = [];
    const identifierPlan = {
      ...plan,
      nameForReference(path) {
        referenceLookups.push(path);
        return plan.nameForReference(path);
      },
    };
    const result = convertToSrxSetCommands(config, {}, null, { identifierPlan });

    expect(referenceLookups).toEqual(expect.arrayContaining([
      'nat_rules[0].source_zones[0]',
      'nat_rules[0].destination_zones[0]',
      'nat_rules[1]#effective-source-zone',
      'nat_rules[1]#effective-destination-zone',
    ]));
    const aliasRuleSet = result.identifierMappings.entries.find(entry => (
      entry.namespace === 'nat-rule-set' && entry.sourceName === 'inside-to-outside'
    )).outputName;
    expect(result.commands).toContain(`set security nat source rule-set ${aliasRuleSet} from zone inside`);
    expect(result.commands).toContain(`set security nat source rule-set ${aliasRuleSet} to zone outside`);
  });

  it('preserves periods in explicit multi-port preferred names', () => {
    const config = baseConfig({
      service_objects: [{ name: 'Foo.Bar', protocol: 'tcp', port_range: '8080,8081' }],
      applications: [{ name: 'Baz.Qux', protocol: 'udp', port: '9000,9001' }],
    });
    const result = convertToSrxSetCommands(config);

    expect(result.commands).toContain('set applications application-set Foo.Bar-set application Foo.Bar-8080');
    expect(result.commands).toContain('set applications application-set Baz.Qux-set application Baz.Qux-9000');
  });

  it('fails closed when an injected plan does not cover a core definition path', () => {
    const config = collisionConfig();
    const emptyPlan = {
      warnings: [],
      collisionCount: 0,
      mapping: { version: 1, entries: [] },
      nameForDefinition: path => { throw new JunosIdentifierPlanningError('missing_catalog_coverage', { definitionPaths: [path] }); },
      nameForReference: path => { throw new JunosIdentifierPlanningError('missing_catalog_coverage', { referencePaths: [path] }); },
      nameForGenerated: path => { throw new JunosIdentifierPlanningError('missing_catalog_coverage', { definitionPaths: [path] }); },
    };

    expect(() => convertToSrxSetCommands(config, {}, null, { identifierPlan: emptyPlan }))
      .toThrow(expect.objectContaining({ code: 'missing_catalog_coverage' }));
  });
});
