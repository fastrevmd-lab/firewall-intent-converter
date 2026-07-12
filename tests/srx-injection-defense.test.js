import fs from 'node:fs';

import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

import {
  convertMergedToSrxSetCommands,
  convertToSrxSetCommands,
} from '../src/converters/srx-converter.js';
import {
  buildMergedSrxXml,
  buildSrxXml,
} from '../src/converters/srx-xml-builder.js';
import { parseSrxConfig } from '../src/parsers/srx-parser.js';
import { JunosSerializationError } from '../src/security/junos-serialization.js';
import {
  validateSetOutput,
  validateXmlOutput,
} from '../src/security/junos-output-validation.js';

function baseConfig() {
  return {
    metadata: { source_vendor: 'panos' },
    system_config: {
      hostname: 'edge-1',
      login_banner: 'Authorized "Ops" \\ 東京',
    },
    zones: [
      { name: 'trust', interfaces: [] },
      { name: 'untrust', interfaces: [] },
    ],
    address_objects: [{
      name: 'web',
      type: 'ip-netmask',
      value: '192.0.2.10/32',
      description: 'Web & API',
    }],
    security_policies: [{
      name: 'allow-web',
      description: 'Owner: "Blue Team" \\ primary',
      src_zones: ['trust'],
      dst_zones: ['untrust'],
      src_addresses: ['any'],
      dst_addresses: ['web'],
      applications: ['junos-https'],
      services: [],
      action: 'permit',
    }],
  };
}

const CATALOG_FUNCTIONS = new Set(['sanitizeJunosName', 'setIdentifier']);
const APPROVED_NON_SYMBOL_REASONS = new Set([
  'application-firewall dynamic-application-group match value',
  'content-filtering block-extension match value',
  'security-policy source-identity match value',
  'security-policy source-identity element value',
]);
const MARKER_STEM = 'identifier-catalog: non-symbol';

function walkAst(root, visit) {
  const seen = new Set();
  function walk(node, parent = null) {
    if (!node || typeof node.type !== 'string' || seen.has(node)) return;
    seen.add(node);
    visit(node, parent);
    for (const [key, value] of Object.entries(node)) {
      if (['end', 'loc', 'range', 'start', 'type'].includes(key)) continue;
      if (Array.isArray(value)) {
        for (const child of value) walk(child, node);
      } else {
        walk(value, node);
      }
    }
  }
  walk(root);
}

function staticStringValue(node) {
  if (node?.type === 'ParenthesizedExpression') return staticStringValue(node.expression);
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return null;
}

function identifierCatalogFindings(source, relativePath) {
  const comments = [];
  const ast = parse(source, {
    ecmaVersion: 'latest',
    locations: true,
    onComment: comments,
    preserveParens: true,
    sourceType: 'module',
  });
  const nodes = [];
  walkAst(ast, node => nodes.push(node));
  const findings = [];
  const directCalls = [];
  const allowedIdentifiers = new Set();

  for (const node of nodes) {
    if (node.type === 'ImportSpecifier') {
      const importedName = node.imported.type === 'Identifier'
        ? node.imported.name
        : staticStringValue(node.imported);
      const localName = node.local.name;
      if (CATALOG_FUNCTIONS.has(importedName) || CATALOG_FUNCTIONS.has(localName)) {
        const exact = node.imported.type === 'Identifier'
          && importedName === localName
          && CATALOG_FUNCTIONS.has(importedName)
          && source.slice(node.imported.start, node.imported.end) === importedName
          && source.slice(node.local.start, node.local.end) === localName;
        if (exact) {
          allowedIdentifiers.add(node.imported);
          allowedIdentifiers.add(node.local);
        } else if (node.imported.type !== 'Identifier' && CATALOG_FUNCTIONS.has(importedName)) {
          findings.push(
            `${relativePath}:${node.loc.start.line} forbidden string-named ${importedName} import`,
          );
        }
      }
    }

    if (node.type === 'CallExpression'
        && node.optional !== true
        && node.callee.type === 'Identifier'
        && CATALOG_FUNCTIONS.has(node.callee.name)
        && source.slice(node.callee.start, node.callee.end) === node.callee.name) {
      allowedIdentifiers.add(node.callee);
      directCalls.push({ line: node.callee.loc.start.line, node });
    }

    if ((node.type === 'MemberExpression' || node.type === 'Property') && node.computed) {
      const propertyName = staticStringValue(node.property ?? node.key);
      if (CATALOG_FUNCTIONS.has(propertyName)) {
        findings.push(
          `${relativePath}:${node.loc.start.line} forbidden computed ${propertyName} access`,
        );
      }
    }

    const literalText = node.type === 'TemplateElement'
      ? (node.value.cooked ?? node.value.raw)
      : node.type === 'Literal' ? staticStringValue(node) : null;
    if (typeof literalText === 'string' && literalText.includes(MARKER_STEM)) {
      findings.push(`${relativePath}:${node.loc.start.line} marker must be a line comment`);
    }
  }

  const reportedIdentifiers = new Set();
  for (const node of nodes) {
    if (node.type === 'Identifier'
        && CATALOG_FUNCTIONS.has(node.name)
        && !allowedIdentifiers.has(node)) {
      const occurrenceKey = `${node.start}:${node.end}:${node.name}`;
      if (reportedIdentifiers.has(occurrenceKey)) continue;
      reportedIdentifiers.add(occurrenceKey);
      findings.push(`${relativePath}:${node.loc.start.line} forbidden ${node.name} occurrence`);
    }
  }

  const approvedMarkers = [];
  for (const comment of comments) {
    const markerText = comment.value.trim();
    if (!markerText.includes(MARKER_STEM)) continue;
    if (comment.type !== 'Line') {
      findings.push(`${relativePath}:${comment.loc.start.line} marker must be a line comment`);
      continue;
    }
    const exactPrefix = `${MARKER_STEM} `;
    const reason = markerText.startsWith(exactPrefix)
      ? markerText.slice(exactPrefix.length)
      : '';
    if (!APPROVED_NON_SYMBOL_REASONS.has(reason)) {
      findings.push(`${relativePath}:${comment.loc.start.line} unknown marker`);
      continue;
    }
    approvedMarkers.push({
      key: `${comment.start}:${approvedMarkers.length}`,
      line: comment.loc.start.line,
    });
  }

  const callsByLine = new Map();
  for (const call of directCalls) {
    const calls = callsByLine.get(call.line) || [];
    calls.push(call);
    callsByLine.set(call.line, calls);
  }
  const usedMarkers = new Set();
  for (const [callLine, calls] of callsByLine) {
    if (calls.length !== 1) {
      findings.push(`${relativePath}:${callLine} multiple direct calls`);
      continue;
    }
    const candidates = approvedMarkers.filter(marker => (
      marker.line === callLine - 1 || marker.line === callLine
    ));
    if (candidates.length !== 1) {
      findings.push(`${relativePath}:${callLine} missing or ambiguous marker`);
      continue;
    }
    if (usedMarkers.has(candidates[0].key)) {
      findings.push(`${relativePath}:${callLine} shared marker`);
      continue;
    }
    usedMarkers.add(candidates[0].key);
  }
  for (const marker of approvedMarkers) {
    if (!usedMarkers.has(marker.key)) {
      findings.push(`${relativePath}:${marker.line} orphan marker`);
    }
  }
  return findings;
}

describe('set converter injection defense', () => {
  it('requires identifier catalog coverage for every direct sanitizer call', () => {
    const findings = [];
    for (const relativePath of [
      '../src/converters/srx-converter.js',
      '../src/converters/srx-xml-builder.js',
    ]) {
      const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      findings.push(...identifierCatalogFindings(source, relativePath));
    }
    expect(findings).toEqual([]);
  });

  it.each([
    [
      'whitespace/newline call',
      'sanitizeJunosName \n(value);',
      ['fixture.js:1 missing or ambiguous marker'],
    ],
    [
      'aliased import',
      "import { sanitizeJunosName as normalize } from './parser-utils.js';",
      ['fixture.js:1 forbidden sanitizeJunosName occurrence'],
    ],
    [
      'assigned alias',
      'const normalize = setIdentifier;',
      ['fixture.js:1 forbidden setIdentifier occurrence'],
    ],
    [
      'two calls sharing one marker',
      '// identifier-catalog: non-symbol content-filtering block-extension match value\nsanitizeJunosName(a); setIdentifier(b);',
      ['fixture.js:2 multiple direct calls', 'fixture.js:1 orphan marker'],
    ],
  ])('rejects identifier catalog scanner bypass via %s', (_label, source, expected) => {
    expect(identifierCatalogFindings(source, 'fixture.js')).toEqual(expected);
  });

  it.each([
    [
      'qualified property access',
      '// identifier-catalog: non-symbol content-filtering block-extension match value\nobj.sanitizeJunosName(value);',
      ['fixture.js:2 forbidden sanitizeJunosName occurrence', 'fixture.js:1 orphan marker'],
    ],
    [
      'parenthesized call',
      '// identifier-catalog: non-symbol content-filtering block-extension match value\n(sanitizeJunosName)(value);',
      ['fixture.js:2 forbidden sanitizeJunosName occurrence', 'fixture.js:1 orphan marker'],
    ],
    [
      'optional call',
      '// identifier-catalog: non-symbol content-filtering block-extension match value\nsanitizeJunosName?.(value);',
      ['fixture.js:2 forbidden sanitizeJunosName occurrence', 'fixture.js:1 orphan marker'],
    ],
    [
      'direct rebinding',
      'sanitizeJunosName = replacement;',
      ['fixture.js:1 forbidden sanitizeJunosName occurrence'],
    ],
    [
      'computed property access',
      "obj['sanitizeJunosName'](value);",
      ['fixture.js:1 forbidden computed sanitizeJunosName access'],
    ],
    [
      'escaped computed property access',
      'obj["sanitizeJunos\\x4eame"](value);',
      ['fixture.js:1 forbidden computed sanitizeJunosName access'],
    ],
    [
      'Unicode-escaped identifier call',
      '// identifier-catalog: non-symbol content-filtering block-extension match value\nsanitizeJunos\\u004eame(value);',
      ['fixture.js:2 forbidden sanitizeJunosName occurrence', 'fixture.js:1 orphan marker'],
    ],
    [
      'template-literal computed property access',
      'obj[`sanitizeJunosName`](value);',
      ['fixture.js:1 forbidden computed sanitizeJunosName access'],
    ],
    [
      'line-continuation computed property access',
      'obj["sanitizeJunos\\\nName"](value);',
      ['fixture.js:1 forbidden computed sanitizeJunosName access'],
    ],
    [
      'parenthesized computed property access',
      "obj[('sanitizeJunosName')](value);",
      ['fixture.js:1 forbidden computed sanitizeJunosName access'],
    ],
    [
      'parenthesized computed destructuring alias',
      "const { [('setIdentifier')]: validate } = helpers;",
      ['fixture.js:1 forbidden computed setIdentifier access'],
    ],
    [
      'nested parenthesized template computed access',
      'obj[((`sanitizeJunosName`))](value);',
      ['fixture.js:1 forbidden computed sanitizeJunosName access'],
    ],
    [
      'computed destructuring alias',
      "const { ['setIdentifier']: validate } = helpers;",
      ['fixture.js:1 forbidden computed setIdentifier access'],
    ],
    [
      'basic destructuring alias',
      'const { sanitizeJunosName: normalize } = helpers;',
      ['fixture.js:1 forbidden sanitizeJunosName occurrence'],
    ],
    [
      'ASI after side-effect import',
      "import './side.js'\nconst { sanitizeJunosName } = helpers;",
      ['fixture.js:2 forbidden sanitizeJunosName occurrence'],
    ],
    [
      'string-named aliased import',
      "import { 'sanitizeJunosName' as normalize } from './parser-utils.js';",
      ['fixture.js:1 forbidden string-named sanitizeJunosName import'],
    ],
    [
      'marker text inside a string',
      "const note = '// identifier-catalog: non-symbol content-filtering block-extension match value'; sanitizeJunosName(value);",
      ['fixture.js:1 marker must be a line comment', 'fixture.js:1 missing or ambiguous marker'],
    ],
    [
      'orphan marker text inside a string',
      "const note = '// identifier-catalog: non-symbol content-filtering block-extension match value';",
      ['fixture.js:1 marker must be a line comment'],
    ],
    [
      'generic marker reason',
      '// identifier-catalog: non-symbol scalar validation\nsanitizeJunosName(value);',
      ['fixture.js:1 unknown marker', 'fixture.js:2 missing or ambiguous marker'],
    ],
    [
      'empty marker reason',
      '// identifier-catalog: non-symbol \nsanitizeJunosName(value);',
      ['fixture.js:1 unknown marker', 'fixture.js:2 missing or ambiguous marker'],
    ],
    [
      'orphan approved marker',
      '// identifier-catalog: non-symbol content-filtering block-extension match value\nconst value = 1;',
      ['fixture.js:1 orphan marker'],
    ],
    [
      'block-comment marker',
      '/* identifier-catalog: non-symbol content-filtering block-extension match value */\nsanitizeJunosName(value);',
      ['fixture.js:1 marker must be a line comment', 'fixture.js:2 missing or ambiguous marker'],
    ],
    [
      'one marker shared by adjacent calls',
      'sanitizeJunosName(first); // identifier-catalog: non-symbol content-filtering block-extension match value\nsetIdentifier(second);',
      ['fixture.js:2 shared marker'],
    ],
    [
      'two markers for one call',
      '// identifier-catalog: non-symbol content-filtering block-extension match value\nsanitizeJunosName(value); // identifier-catalog: non-symbol security-policy source-identity match value',
      [
        'fixture.js:2 missing or ambiguous marker',
        'fixture.js:1 orphan marker',
        'fixture.js:2 orphan marker',
      ],
    ],
  ])('rejects formal identifier catalog mutation: %s', (_label, source, expected) => {
    expect(identifierCatalogFindings(source, 'fixture.js')).toEqual(expected);
  });

  it('allows names in ordinary strings and comments but rejects string-literal computed access', () => {
    const safeText = [
      "const first = 'sanitizeJunosName';",
      '// setIdentifier is discussed here without being called.',
      "const second = ['setIdentifier'];",
      'const third = /sanitizeJunosName|setIdentifier/;',
      'const fourth = `sanitizeJunosName and setIdentifier`;',
      'if (ready) /sanitizeJunosName|setIdentifier/.test(value);',
    ].join('\n');
    expect(identifierCatalogFindings(safeText, 'fixture.js')).toEqual([]);
  });

  it('allows only unaliased static imports and marked direct calls', () => {
    const allowed = [
      "import { sanitizeJunosName } from './parser-utils.js';",
      '// identifier-catalog: non-symbol content-filtering block-extension match value',
      'const value = `${sanitizeJunosName(input)}`;',
    ].join('\n');
    expect(identifierCatalogFindings(allowed, 'fixture.js')).toEqual([]);
  });

  it('escapes printable quoted text and returns structurally valid output', () => {
    const { commands } = convertToSrxSetCommands(baseConfig());
    const joined = commands.join('\n');

    expect(joined).toContain('login message "Authorized \\"Ops\\" \\\\ 東京"');
    expect(joined).toContain('description "Owner: \\"Blue Team\\" \\\\ primary"');
    expect(validateSetOutput(commands)).toBe(commands);
  });

  it.each([
    ['metadata.siteName', config => { config.metadata.siteName = 'HQ\nset system services telnet'; }],
    ['system_config.hostname', config => { config.system_config.hostname = 'edge set system services telnet'; }],
    ['address_objects[0].description', config => { config.address_objects[0].description = 'x\u2028set system services telnet'; }],
    ['security_policies[0].action', config => { config.security_policies[0].action = 'permit deactivate system'; }],
    ['security_policies[0].name', config => { config.security_policies[0].name = 'p\rset system root-authentication'; }],
    ['address_objects[0].value', config => { config.address_objects[0].value = '192.0.2.1 set system services telnet'; }],
    ['interfaces[0].ip', config => { config.interfaces = [{ name: 'ethernet1/1', ip: '192.0.2.1/24 set system services telnet' }]; }],
    ['service_objects[0].protocol', config => { config.service_objects = [{ name: 'web', protocol: 'tcp set system services telnet', port_range: '443' }]; }],
    ['bgp_config[0].peer_groups[0].neighbors[0].address', config => {
      config.bgp_config = [{ peer_groups: [{ name: 'upstream', type: 'external', neighbors: [{ address: '192.0.2.1 set system services telnet' }] }] }];
    }],
    ['vpn_tunnels[0].ike_gateway.address', config => {
      config.vpn_tunnels = [{ name: 'branch', ike_gateway: { external_interface: 'ge-0/0/0.0', address: '192.0.2.1 set system services telnet' } }];
    }],
    ['ha_config.group_id', config => { config.ha_config = { enabled: true, group_id: '1 set system services telnet' }; }],
    ['nat_rules[0].match_port', config => {
      config.nat_rules = [{ name: 'dnat', type: 'destination', src_zones: ['untrust'], dst_zones: ['trust'], dst_addresses: ['any'], match_port: '443 set system services telnet' }];
    }],
    ['flow_monitoring_config.collectors[0].address', config => {
      config.flow_monitoring_config = { collectors: [{ address: '192.0.2.1 set system services telnet', port: 2055 }] };
    }],
    ['system_config.domain_name', config => { config.system_config.domain_name = 'example.com set system services telnet'; }],
    ['schedules[0].days[0]', config => { config.schedules = [{ name: 'hours', type: 'recurring', days: ['monday set system services telnet'], start: '08:00', end: '17:00' }]; }],
    ['ospf_config[0].router_id', config => { config.ospf_config = [{ router_id: '192.0.2.1 set system services telnet', areas: [] }]; }],
    ['syslog_config[0].server', config => { config.syslog_config = [{ server: 'logs.example.com set system services telnet', transport: 'udp' }]; }],
    ['aaa_config[0].server', config => { config.aaa_config = [{ type: 'radius', server: '192.0.2.1 set system services telnet', port: 1812 }]; }],
    ['snmp_config[0].clients[0]', config => { config.snmp_config = [{ type: 'community', name: 'monitor', clients: ['192.0.2.1/32 set system services telnet'] }]; }],
    ['dhcp_config[0].network', config => { config.dhcp_config = [{ type: 'pool', name: 'lan', network: '192.0.2.0/24 set system services telnet' }]; }],
    ['qos_config[0].transmit_rate', config => { config.qos_config = [{ type: 'scheduler', name: 'gold', transmit_rate: '1g set system services telnet' }]; }],
    ['bridge_domains[0].vlan_id', config => { config.bridge_domains = [{ name: 'users', vlan_id: '10 set system services telnet' }]; }],
    ['pbf_rules[0].next_hop_value', config => { config.pbf_rules = [{ name: 'route', action: 'forward', next_hop_value: '192.0.2.1 set system services telnet' }]; }],
    ['evpn_config[0].route_distinguisher', config => { config.evpn_config = [{ route_distinguisher: '192.0.2.1:1 set system services telnet' }]; }],
    ['vxlan_config[0].vtep_source_interface', config => { config.vxlan_config = [{ vtep_source_interface: 'lo0.0 set system services telnet', vnis: [] }]; }],
    ['ha_config.local_ip', config => { config.ha_config = { enabled: true, ha_type: 'mnha', local_ip: '192.0.2.1 set system services telnet' }; }],
    ['screen_config[0].tcp.syn_flood_threshold', config => { config.screen_config = [{ name: 'edge', tcp: { syn_flood_threshold: '10 set system services telnet' } }]; }],
    ['l2_interfaces[0].name', config => { config.l2_interfaces = [{ name: 'ge-0/0/0.10 set system services telnet' }]; }],
    ['nat_rules[0].translated_src.address', config => {
      config.nat_rules = [{ name: 'snat', type: 'source', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['any'], dst_addresses: ['any'], translated_src: { type: 'static', address: '192.0.2.1 set system services telnet' } }];
    }],
    ['security_profile_definitions.dns-security:strict.blockedDomains[0]', config => {
      config.security_policies[0].security_profiles = { 'dns-security': 'strict' };
      config.security_profile_definitions = { 'dns-security:strict': { blockedDomains: ['bad.example set system services telnet'] } };
    }],
    ['vpn_tunnels[0].ike_proposal.encryption', config => {
      config.vpn_tunnels = [{ name: 'branch', ike_gateway: { external_interface: 'ge-0/0/0.0' }, ike_proposal: { name: 'ike', encryption: 'aes-256-cbc set system services telnet' } }];
    }],
    ['bgp_config[0].peer_groups[0].neighbors[0].import_policy', config => {
      config.bgp_config = [{ peer_groups: [{ name: 'upstream', type: 'external', neighbors: [{ address: '192.0.2.1', import_policy: 'IMPORT set system services telnet' }] }] }];
    }],
    ['dhcp_config[0].ranges[0].low', config => {
      config.dhcp_config = [{ type: 'pool', name: 'lan', network: '192.0.2.0/24', ranges: [{ name: 'users', low: '192.0.2.10 set system services telnet', high: '192.0.2.20' }] }];
    }],
    ['flow_monitoring_config.instance_name', config => {
      config.flow_monitoring_config = { instance_name: 'FLOW set system services telnet', collectors: [{ address: '192.0.2.1', port: 2055 }] };
    }],
    ['vpn_tunnels[0].ike_gateway.external_interface', config => {
      config.vpn_tunnels = [{ name: 'branch', ike_gateway: { external_interface: 'ge-0/0/0.0 set system services telnet' } }];
    }],
    ['qos_config[0].priority', config => { config.qos_config = [{ type: 'scheduler', name: 'gold', priority: 'high set system services telnet' }]; }],
    ['pbf_rules[0].src_addresses[0]', config => {
      config.pbf_rules = [{ name: 'bad-address', action: 'discard', src_addresses: ['999.999.999.999/99'] }];
    }],
    ['pbf_rules[0].services[0]', config => {
      config.pbf_rules = [{ name: 'bad-protocol', action: 'discard', services: ['icmp/80'] }];
    }],
    ['pbf_rules[0].services[0]', config => {
      config.pbf_rules = [{ name: 'bad-port', action: 'discard', services: ['tcp/99999'] }];
    }],
    ['ospf_config[0].redistribute[0].protocol', config => { config.ospf_config = [{ areas: [], redistribute: [{ protocol: 'static set system services telnet' }] }]; }],
    ['bgp_config[0].networks[0].policy', config => { config.bgp_config = [{ peer_groups: [], networks: [{ policy: 'EXPORT set system services telnet' }] }]; }],
  ])('blocks an attack at %s without reflecting its value', (fieldPath, mutate) => {
    const config = baseConfig();
    mutate(config);

    try {
      convertToSrxSetCommands(config);
      throw new Error('expected conversion to fail');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'JunosSerializationError',
        fieldPath,
      });
      expect(error.message).not.toContain('set system');
    }
  });

  it('validates target context before adding a hierarchy wrapper', () => {
    expect(() => convertToSrxSetCommands(
      baseConfig(),
      {},
      { type: 'logical-system', name: 'tenant\nset system services telnet' },
    )).toThrow(expect.objectContaining({ fieldPath: 'targetContext.name' }));
    expect(() => convertToSrxSetCommands(
      baseConfig(),
      {},
      { type: 'logical-system set system services telnet', name: 'tenant-a' },
    )).toThrow(expect.objectContaining({ fieldPath: 'targetContext.type' }));
  });

  it('rejects invalid embedded target-context types consistently in Set and XML', () => {
    const config = baseConfig();
    config.target_context = { type: 'evil', name: 'tenant-a' };
    for (const convert of [convertToSrxSetCommands, buildSrxXml]) {
      expect(() => convert(config)).toThrow(expect.objectContaining({
        name: 'JunosSerializationError',
        fieldPath: 'targetContext.type',
      }));
    }
  });

  it.each([
    ['absent', {}],
    ['null', { name: null }],
    ['non-string', { name: 42 }],
    ['blank', { name: '   ' }],
  ])('fails closed for an active %s target-context name in Set and XML', (_label, nameFields) => {
    const targetContext = { type: 'logical-system', ...nameFields };
    for (const convert of [convertToSrxSetCommands, buildSrxXml]) {
      expect(() => convert(baseConfig(), {}, targetContext)).toThrow(expect.objectContaining({
        name: 'JunosIdentifierPlanningError',
        code: 'missing_catalog_coverage',
        definitionPaths: ['targetContext.name'],
        reason: 'active target context requires a non-blank string name',
      }));
    }
  });

  it('fails closed for an active target context supplied by the config', () => {
    const config = baseConfig();
    config.target_context = { type: 'tenant', name: '  ' };
    for (const convert of [convertToSrxSetCommands, buildSrxXml]) {
      expect(() => convert(config)).toThrow(expect.objectContaining({
        name: 'JunosIdentifierPlanningError',
        code: 'missing_catalog_coverage',
        definitionPaths: ['targetContext.name'],
      }));
    }
  });

  it.each([
    ['absent', {}],
    ['null', { lsName: null }],
    ['non-string', { lsName: 42 }],
    ['blank', { lsName: '   ' }],
  ])('fails closed for a merged %s logical-system name in Set and XML', (_label, nameFields) => {
    const slots = [{
      ...nameFields,
      intermediateConfig: baseConfig(),
      interfaceMappings: {},
    }];
    for (const convert of [convertMergedToSrxSetCommands, buildMergedSrxXml]) {
      expect(() => convert(slots)).toThrow(expect.objectContaining({
        name: 'JunosIdentifierPlanningError',
        code: 'missing_catalog_coverage',
        definitionPaths: ['configSlots[0].lsName'],
        reason: 'active target context requires a non-blank string name',
      }));
    }
  });

  it('validates user-supplied SRX interface mappings', () => {
    expect(() => convertToSrxSetCommands(
      baseConfig(),
      { 'ethernet1/1': 'ge-0/0/0.0 set system services telnet' },
    )).toThrow(expect.objectContaining({ fieldPath: 'interfaceMappings.ethernet1/1' }));
  });

  it('validates merged slot names and cross-link numeric fields', () => {
    const unsafeSlots = [{
      lsName: 'tenant\nset system services telnet',
      intermediateConfig: baseConfig(),
      interfaceMappings: {},
    }];
    expect(() => convertMergedToSrxSetCommands(unsafeSlots))
      .toThrow(JunosSerializationError);

    const safeSlots = [{
      lsName: 'tenant-a',
      intermediateConfig: baseConfig(),
      interfaceMappings: {},
    }];
    const unsafeLinks = [{
      ls1: 'tenant-a',
      ls2: 'tenant-b',
      sharedZone: 'shared',
      lt1Unit: '1 set system services telnet',
      lt2Unit: 2,
    }];
    expect(() => convertMergedToSrxSetCommands(safeSlots, unsafeLinks))
      .toThrow(expect.objectContaining({ fieldPath: 'crossLsLinks[0].lt1Unit' }));

    const unsafeZoneLinks = [{
      ls1: 'tenant-a',
      ls2: 'tenant-a',
      sharedZone: 'any\nset system services telnet',
      lt1Unit: 'not-an-integer',
      lt2Unit: 2,
    }];
    expect(() => convertMergedToSrxSetCommands(safeSlots, unsafeZoneLinks))
      .toThrow(expect.objectContaining({ fieldPath: 'merge.crossLsLinks[0].sharedZone' }));
  });

  it('keeps valid advanced converter domains compatible with final validation', () => {
    const config = baseConfig();
    Object.assign(config, {
      system_config: {
        ...config.system_config,
        domain_name: 'example.com',
        dns_servers: ['192.0.2.53'],
        ntp_servers: ['time.example.com'],
        timezone: 'America/New_York',
      },
      interfaces: [{ name: 'ethernet1/1', ip: '192.0.2.1/24' }],
      service_objects: [{ name: 'flow', protocol: 'netflow-v9', port_range: '2055' }],
      schedules: [{ name: 'hours', type: 'recurring', days: ['Mon'], start: '08:00', end: '17:00' }],
      static_routes: [{ destination: '0.0.0.0/0', next_hop: '192.0.2.254', metric: 10 }],
      bgp_config: [{
        local_as: 64512,
        router_id: '192.0.2.1',
        peer_groups: [{ type: 'external', name: 'upstream', neighbors: [{ address: '198.51.100.1', peer_as: 64496, description: 'Transit "A"' }] }],
      }],
      ospf_config: [{
        router_id: '192.0.2.1',
        areas: [{ area_id: '0.0.0.0', area_type: 'normal', interfaces: [{ name: 'ethernet1/1', cost: 10 }] }],
      }],
      evpn_config: [{
        instance: 'fabric',
        instance_type: 'virtual-switch',
        encapsulation: 'vxlan',
        route_distinguisher: '192.0.2.1:1',
        vrf_target: 'target:64512:1',
        vtep_source_interface: 'lo0.0',
        extended_vni_list: [10010],
      }],
      vxlan_config: [{ vtep_source_interface: 'lo0.0', udp_port: 4789, vnis: [{ vni: 10010, vlan_id: 10, remote_vteps: ['198.51.100.10'] }] }],
      ha_config: { enabled: true, group_id: 1, priority: 200, ha_interfaces: [] },
      screen_config: [{ name: 'edge', tcp: { syn_flood_threshold: 1000 } }],
      vpn_tunnels: [{
        name: 'branch',
        tunnel_interface: 'st0.1',
        ike_gateway: { name: 'branch', external_interface: 'ge-0/0/0.0', address: '198.51.100.2', ike_version: 'v2' },
        ike_proposal: { name: 'ike', auth_method: 'pre-shared-keys', dh_group: 'group14', encryption: 'aes-256-cbc', authentication: 'sha-256', lifetime: 28800 },
        ipsec_proposal: { name: 'ipsec', protocol: 'esp', encryption: 'aes-256-cbc', authentication: 'hmac-sha-256-128', lifetime: 3600 },
        proxy_id: [{ local: '192.0.2.0/24', remote: '198.51.100.0/24' }],
      }],
      syslog_config: [{ server: 'logs.example.com', port: 514, transport: 'udp', source_address: '192.0.2.1' }],
      aaa_config: [{ type: 'radius', server: '192.0.2.20', port: 1812, timeout: 5 }],
      snmp_config: [{ type: 'community', name: 'monitor', clients: ['192.0.2.0/24'] }],
      dhcp_config: [{ type: 'pool', name: 'lan', network: '192.0.2.0/24', gateway: '192.0.2.1', dns_servers: ['192.0.2.53'] }],
      qos_config: [{ type: 'scheduler', name: 'gold', transmit_rate: '10 percent', buffer_size: '20%' }],
      bridge_domains: [{ name: 'users', vlan_id: 10, irb_interface: 'irb.10' }],
      l2_interfaces: [{ name: 'ge-0/0/1.10', bridge_domain: 'users', vlan: 10 }],
      pbf_rules: [{ name: 'route', action: 'forward', next_hop_value: '192.0.2.254', src_addresses: ['any'], dst_addresses: ['any'], services: [], from_type: 'zone', from_value: [] }],
      flow_monitoring_config: { collectors: [{ address: '192.0.2.30', port: 2055, protocol: 'ipfix', source_address: '192.0.2.1' }], templates: [] },
    });

    const { commands } = convertToSrxSetCommands(config);
    expect(commands.length).toBeGreaterThan(50);
    expect(validateSetOutput(commands)).toBe(commands);
  });

  it('round-trips a valid generated security policy through the SRX parser', () => {
    const config = baseConfig();
    config.zones = [];
    config.address_objects = [];
    config.security_policies[0].dst_addresses = ['any'];
    config.security_policies[0].action = 'allow';

    const generated = convertToSrxSetCommands(config).commands
      .filter(line => line.startsWith('set ') || line.startsWith('deactivate '))
      .join('\n');
    const reparsed = parseSrxConfig(generated).intermediateConfig;
    const policy = reparsed.security_policies.find(item => item.name === 'allow-web');

    expect(policy).toMatchObject({
      src_zones: ['trust'],
      dst_zones: ['untrust'],
      action: 'allow',
      applications: ['junos-https'],
    });
  });

  it('does not directly interpolate protected set free-text sites', () => {
    const source = fs.readFileSync(
      new URL('../src/converters/srx-converter.js', import.meta.url),
      'utf8',
    );

    expect(source).not.toMatch(/description \"\$\{[^}]*(?:description|comment|note|banner)/);
    expect(source).not.toMatch(/login message \"\$\{/);
    expect(source).toContain('validateSetOutput(commands)');
    expect(source).toContain('validateSetOutput(allCommands)');
  });
});

describe('XML converter injection defense', () => {
  it('encodes printable text and safely contains XML-comment terminators', () => {
    const config = baseConfig();
    config.metadata.siteName = 'HQ --> <system><services><telnet/></services></system>';
    config.security_policies[0].description = 'Owner & </description><system> "Blue"';

    const { xml } = buildSrxXml(config);
    expect(xml).toContain('HQ - ->');
    expect(xml).toContain('Owner &amp; &lt;/description&gt;&lt;system&gt; &quot;Blue&quot;');
    expect(validateXmlOutput(xml)).toBe(xml);
  });

  it.each([
    ['security_policies[0].action', config => { config.security_policies[0].action = 'permit/><system>'; }],
    ['system_config.hostname', config => { config.system_config.hostname = 'edge\0evil'; }],
    ['address_objects[0].value', config => { config.address_objects[0].value = '192.0.2.1</name><name>evil'; }],
    ['service_objects[0].port_range', config => { config.service_objects = [{ name: 'web', protocol: 'tcp', port_range: '443</destination-port>' }]; }],
    ['screen_config[0].tcp.syn_flood_threshold', config => { config.screen_config = [{ name: 'edge', tcp: { syn_flood_threshold: '1</alarm-threshold>' } }]; }],
  ])('rejects an invalid XML-bound field at %s', (fieldPath, mutate) => {
    const config = baseConfig();
    mutate(config);

    expect(() => buildSrxXml(config)).toThrow(expect.objectContaining({
      name: 'JunosSerializationError',
      fieldPath,
    }));
  });

  it('uses explicit maps for all dynamic XML element names', () => {
    const config = baseConfig();
    config.schedules = [{ name: 'hours', type: 'recurring', days: ['Mon'], start: '08:00', end: '17:00' }];
    config.snmp_config = [{ type: 'trap-group', name: 'ops', categories: ['link'] }];

    const { xml } = buildSrxXml(config);
    expect(xml).toContain('<monday>');
    expect(xml).toContain('<categories><link/></categories>');
    expect(validateXmlOutput(xml)).toBe(xml);
  });

  it('validates merged XML names, cross-link values, and the final document', () => {
    const slots = [{ lsName: 'tenant --> <system/>', intermediateConfig: baseConfig(), interfaceMappings: {} }];
    const safe = buildMergedSrxXml(slots);
    expect(safe.xml).not.toContain('<!-- Logical-System: tenant -->');
    expect(validateXmlOutput(safe.xml)).toBe(safe.xml);

    const links = [{
      ls1: 'tenant-a',
      ls2: 'tenant-b',
      sharedZone: 'shared',
      lt1Unit: '1</name>',
      lt2Unit: 2,
    }];
    expect(() => buildMergedSrxXml([
      { lsName: 'tenant-a', intermediateConfig: baseConfig(), interfaceMappings: {} },
    ], links)).toThrow(expect.objectContaining({ fieldPath: 'crossLsLinks[0].lt1Unit' }));

    expect(() => buildMergedSrxXml([
      { lsName: 'tenant-a', intermediateConfig: baseConfig(), interfaceMappings: {} },
    ], [{
      ls1: 'tenant-a',
      ls2: 'tenant-a',
      sharedZone: 'any\nset system services telnet',
      lt1Unit: 'not-an-integer',
      lt2Unit: 2,
    }])).toThrow(expect.objectContaining({ fieldPath: 'merge.crossLsLinks[0].sharedZone' }));
  });

  it('keeps a feature-rich XML document well formed and inside supported roots', () => {
    const config = baseConfig();
    Object.assign(config, {
      interfaces: [{ name: 'ethernet1/1', ip: '192.0.2.1/24', description: 'Inside & "LAN"' }],
      schedules: [{ name: 'hours', type: 'recurring', days: ['Mon'], start: '08:00', end: '17:00' }],
      static_routes: [{ destination: '0.0.0.0/0', next_hop: '192.0.2.254', metric: 10 }],
      bgp_config: [{ local_as: 64512, router_id: '192.0.2.1', peer_groups: [{ name: 'upstream', type: 'external', neighbors: [{ address: '198.51.100.1', peer_as: 64496 }] }] }],
      ospf_config: [{ router_id: '192.0.2.1', areas: [{ area_id: '0.0.0.0', area_type: 'normal', interfaces: [{ name: 'ge-0/0/0.0', cost: 10 }] }] }],
      evpn_config: [{ encapsulation: 'vxlan', route_distinguisher: '192.0.2.1:1', vrf_target: 'target:64512:1', vtep_source_interface: 'lo0.0', extended_vni_list: [10010] }],
      ha_config: { enabled: true, group_id: 1, priority: 200, ha_interfaces: [] },
      screen_config: [{ name: 'edge', tcp: { syn_flood_threshold: 1000 } }],
      vpn_tunnels: [{ name: 'branch', tunnel_interface: 'st0.1', ike_gateway: { name: 'branch', external_interface: 'ge-0/0/0.0', address: '198.51.100.2' }, ike_proposal: { name: 'ike', auth_method: 'pre-shared-keys', dh_group: 'group14', encryption: 'aes-256-cbc', authentication: 'sha-256', lifetime: 28800 }, ipsec_proposal: { name: 'ipsec', protocol: 'esp', encryption: 'aes-256-cbc', authentication: 'hmac-sha-256-128', lifetime: 3600 }, proxy_id: [{ local: '192.0.2.0/24', remote: '198.51.100.0/24' }] }],
      syslog_config: [{ server: 'logs.example.com', port: 514, transport: 'udp' }],
      snmp_config: [{ type: 'trap-group', name: 'ops', targets: ['192.0.2.40'], categories: ['link'] }],
      aaa_config: [{ type: 'radius', server: '192.0.2.20', port: 1812, secret: 'quote " & <safe>' }],
      dhcp_config: [{ type: 'pool', name: 'lan', network: '192.0.2.0/24', ranges: [{ name: 'users', low: '192.0.2.10', high: '192.0.2.20' }] }],
      qos_config: [{ type: 'scheduler', name: 'gold', transmit_rate: '10 percent', buffer_size: '20%' }],
      bridge_domains: [{ name: 'users', vlan_id: 10, irb_interface: 'irb.10' }],
      l2_interfaces: [{ name: 'ge-0/0/1.10', bridge_domain: 'users', vlan: 10 }],
      pbf_rules: [{ name: 'route', action: 'forward', next_hop_value: '192.0.2.254', src_addresses: ['any'], dst_addresses: ['any'] }],
      flow_monitoring_config: { instance_name: 'FLOW-SAMPLE', collectors: [{ address: '192.0.2.30', port: 2055, protocol: 'ipfix' }], templates: [] },
    });

    const { xml } = buildSrxXml(config);
    expect(xml).toContain('<routing-options>');
    expect(xml).toContain('<security>');
    expect(xml).toContain('<forwarding-options>');
    expect(xml).toContain('quote &quot; &amp; &lt;safe&gt;');
    expect(validateXmlOutput(xml)).toBe(xml);
  });

  it('does not retain raw XML interpolation helpers or unvalidated dynamic tags', () => {
    const source = fs.readFileSync(
      new URL('../src/converters/srx-xml-builder.js', import.meta.url),
      'utf8',
    );

    expect(source).not.toMatch(/function escapeXml/);
    expect(source).not.toMatch(/<\$\{(?:action|day|idpAction|ctxTag)/);
    expect(source).toContain('validateXmlOutput(xml)');
  });
});
