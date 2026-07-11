# Junos Configuration Injection Defense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent every imported, project-supplied, or LLM-generated value from injecting Junos set commands or XML structure, and reject unsafe payloads before browser output or any PyEZ device connection.

**Architecture:** A shared JavaScript security boundary validates intermediate data, serializes values by syntactic type, and validates complete set/XML artifacts. Both single and merged converters call that boundary, the UI clears stale output on typed failures, and the Python bridge independently validates the supported configuration subset before opening NETCONF.

**Tech Stack:** JavaScript ES modules, React 18, Vitest 4, fast-xml-parser 5.8, Python 3 unittest, Flask, lxml, Juniper PyEZ, GitHub Actions.

## Global Constraints

- Preserve normal printable punctuation, quotes, backslashes, ampersands, and Unicode in free-text fields through correct escaping.
- Reject C0/C1 controls, CR/LF, NUL, DEL, U+2028, and U+2029; never silently strip them.
- Never include a rejected value in a user-facing or bridge error.
- Every invalid field error identifies the exact intermediate path and a safe reason.
- One set-command array entry produces at most one `set` or `deactivate` command.
- XML data cannot create elements, attributes, comments, processing instructions, entities, siblings, or ancestors.
- Dynamic XML element names come only from explicit allowlists.
- Both single and merged set/XML output must pass completed-artifact validation before return.
- Bridge validation happens before `_connect`, locking, or PyEZ object construction.
- Browser bridge configuration load supports only `set` and `xml`; brace-format `text` load is disabled.
- Do not change valid firewall policy semantics or address normalized-name collisions tracked by issue #10.
- Do not replace PyEZ with RustEZ in this issue.

---

### Task 1: Typed Junos scalar serializers

**Files:**
- Create: `src/security/junos-serialization.js`
- Create: `tests/junos-serialization.test.js`

**Interfaces:**
- Consumes: `sanitizeJunosName(value)` from `src/parsers/parser-utils.js`.
- Produces: `JunosSerializationError`, `assertSafeScalar`, `setToken`, `setIdentifier`, `setQuoted`, `setEnum`, `setInteger`, `setPort`, `setAddressOrPrefix`, `setCommand`, `setComment`, `xmlText`, `xmlAttribute`, `xmlElementName`, and `xmlComment`.
- Error shape: `new JunosSerializationError(fieldPath, valueKind, reason)` with `.name`, `.fieldPath`, `.valueKind`, `.reason`, and a message that never contains the rejected value.

- [ ] **Step 1: Write failing serializer tests**

```js
import { describe, expect, it } from 'vitest';
import {
  JunosSerializationError, assertSafeScalar, setToken, setIdentifier,
  setQuoted, setEnum, setInteger, setPort, setAddressOrPrefix, setCommand,
  setComment, xmlText, xmlAttribute, xmlElementName, xmlComment,
} from '../src/security/junos-serialization.js';

describe('Junos serializers', () => {
  it.each(['x\ny', 'x\ry', 'x\0y', 'x\u001fy', 'x\u007fy', 'x\u0085y', 'x\u2028y', 'x\u2029y'])(
    'rejects controls without reflecting input: %j', value => {
      expect(() => assertSafeScalar(value, 'metadata.siteName')).toThrow(JunosSerializationError);
      try { assertSafeScalar(value, 'metadata.siteName'); } catch (error) {
        expect(error.fieldPath).toBe('metadata.siteName');
        expect(error.message).not.toContain(value);
      }
    },
  );
  it('preserves printable free text with Junos and XML escaping', () => {
    expect(setQuoted('Ops "A" \\ 東京 & <x>', 'system_config.login_banner'))
      .toBe('"Ops \\"A\\" \\\\ 東京 & <x>"');
    expect(xmlText('Ops "A" \\ 東京 & <x>', 'system_config.login_banner'))
      .toBe('Ops &quot;A&quot; \\ 東京 &amp; &lt;x&gt;');
  });
  it('enforces token, identifier, enum, numeric, port, and address domains', () => {
    expect(setToken('ge-0/0/0.0', 'interfaces[0].name', /^[A-Za-z0-9_.:/-]+$/)).toBe('ge-0/0/0.0');
    expect(setIdentifier('Allow Web', 'security_policies[0].name')).toBe('Allow-Web');
    expect(setEnum('permit', ['permit', 'deny'], 'security_policies[0].action')).toBe('permit');
    expect(setInteger('4094', { min: 1, max: 4094 }, 'vlans[0].vlan_id')).toBe('4094');
    expect(setPort('443', 'service_objects[0].dst_port')).toBe('443');
    expect(setAddressOrPrefix('2001:db8::/64', 'address_objects[0].value')).toBe('2001:db8::/64');
    expect(() => setInteger('1</name>', { min: 0 }, 'metric')).toThrow(JunosSerializationError);
    expect(() => setAddressOrPrefix('192.0.2.1 set system root-authentication', 'next_hop')).toThrow(JunosSerializationError);
  });
  it('builds one command and safe comments only', () => {
    expect(setCommand('set', ['system', 'host-name', 'edge-1'])).toBe('set system host-name edge-1');
    expect(() => setCommand('set', ['system', 'host-name', 'edge-1\nset system services ssh'])).toThrow(JunosSerializationError);
    expect(setComment('site --> set system services telnet', 'metadata.siteName')).not.toContain('\n');
    expect(xmlComment('site --> sibling', 'metadata.siteName')).not.toContain('--');
  });
  it('allows only explicit XML element names', () => {
    expect(xmlElementName('permit', ['permit', 'deny'], 'security_policies[0].action')).toBe('permit');
    expect(() => xmlElementName('permit/><system>', ['permit', 'deny'], 'security_policies[0].action')).toThrow(JunosSerializationError);
    expect(xmlAttribute('"<&', 'field')).toBe('&quot;&lt;&amp;');
  });
});
```

- [ ] **Step 2: Run the serializer test and verify the missing-module failure**

Run: `npx vitest run tests/junos-serialization.test.js`

Expected: FAIL because `src/security/junos-serialization.js` does not exist.

- [ ] **Step 3: Implement the serializer module**

```js
import { sanitizeJunosName } from '../parsers/parser-utils.js';

const UNSAFE_CONTROL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/;

export class JunosSerializationError extends Error {
  constructor(fieldPath, valueKind, reason) {
    super(`Invalid ${valueKind} at ${fieldPath}: ${reason}`);
    this.name = 'JunosSerializationError';
    this.fieldPath = fieldPath;
    this.valueKind = valueKind;
    this.reason = reason;
  }
}

const fail = (path, kind, reason) => { throw new JunosSerializationError(path, kind, reason); };

export function assertSafeScalar(value, fieldPath) {
  if (!['string', 'number', 'boolean'].includes(typeof value) || !Number.isFinite(value === '' ? 0 : Number(value)) && typeof value === 'number') {
    fail(fieldPath, 'scalar', 'expected a string, finite number, or boolean');
  }
  const text = String(value);
  if (UNSAFE_CONTROL.test(text)) fail(fieldPath, 'scalar', 'control or line-separator characters are not allowed');
  return text;
}

export function setToken(value, fieldPath, pattern = IDENTIFIER) {
  const text = assertSafeScalar(value, fieldPath);
  if (!pattern.test(text) || /[\s;`$"'\\]/u.test(text)) fail(fieldPath, 'token', 'value is outside the allowed token domain');
  return text;
}

export function setIdentifier(value, fieldPath) {
  const normalized = sanitizeJunosName(assertSafeScalar(value, fieldPath));
  if (!normalized || !IDENTIFIER.test(normalized)) fail(fieldPath, 'identifier', 'value cannot form a Junos identifier');
  return normalized;
}

export function setQuoted(value, fieldPath) {
  return `"${assertSafeScalar(value, fieldPath).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function setEnum(value, allowed, fieldPath) {
  const text = assertSafeScalar(value, fieldPath);
  if (!allowed.includes(text)) fail(fieldPath, 'enum', `expected one of: ${allowed.join(', ')}`);
  return text;
}

export function setInteger(value, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}, fieldPath) {
  const text = assertSafeScalar(value, fieldPath);
  if (!/^-?\d+$/.test(text)) fail(fieldPath, 'integer', 'expected a base-10 integer');
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < min || number > max) fail(fieldPath, 'integer', `expected ${min} through ${max}`);
  return text;
}

export const setPort = (value, fieldPath) => setInteger(value, { min: 0, max: 65535 }, fieldPath);

function isIpv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}

function isIpv6(value) {
  if (!/^[0-9A-Fa-f:.]+$/.test(value) || !value.includes(':') || (value.match(/::/g) || []).length > 1) return false;
  const [left, right = ''] = value.split('::');
  const groups = part => part ? part.split(':') : [];
  const all = [...groups(left), ...groups(right)];
  const ipv4Tail = all.length > 0 && all[all.length - 1].includes('.');
  const hex = ipv4Tail ? all.slice(0, -1) : all;
  if (!hex.every(group => /^[0-9A-Fa-f]{1,4}$/.test(group))) return false;
  if (ipv4Tail && !isIpv4(all[all.length - 1])) return false;
  const width = hex.length + (ipv4Tail ? 2 : 0);
  return value.includes('::') ? width < 8 : width === 8;
}

export function setAddressOrPrefix(value, fieldPath) {
  const text = assertSafeScalar(value, fieldPath);
  const [address, prefix, extra] = text.split('/');
  const family = isIpv4(address) ? 4 : isIpv6(address) ? 6 : 0;
  if (!family || extra !== undefined) fail(fieldPath, 'address', 'expected an IPv4/IPv6 address or prefix');
  if (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128))) fail(fieldPath, 'prefix', 'prefix length is outside the address-family range');
  return text;
}

export function setCommand(verb, hierarchy) {
  if (!['set', 'deactivate'].includes(verb)) fail('output', 'command', 'unsupported command verb');
  for (const token of hierarchy) {
    const text = assertSafeScalar(token, 'output');
    if (!text || UNSAFE_CONTROL.test(text) || (/\s/.test(text) && !(text.startsWith('"') && text.endsWith('"')))) fail('output', 'command', 'hierarchy contains an unserialized token');
  }
  return `${verb} ${hierarchy.join(' ')}`;
}

export function setComment(value, fieldPath) {
  return `# ${assertSafeScalar(value, fieldPath).replace(/#/g, '\\#')}`;
}

const escapeXml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export const xmlText = (value, fieldPath) => escapeXml(assertSafeScalar(value, fieldPath));
export const xmlAttribute = (value, fieldPath) => escapeXml(assertSafeScalar(value, fieldPath));

export function xmlElementName(value, allowed, fieldPath) {
  return setEnum(value, allowed, fieldPath);
}

export function xmlComment(value, fieldPath) {
  let text = assertSafeScalar(value, fieldPath).replace(/--/g, '- -');
  if (text.endsWith('-')) text += ' ';
  return `<!-- ${text} -->`;
}
```

Keep this browser-safe IP parser local to the module; Vite must not acquire a Node built-in dependency.

- [ ] **Step 4: Run serializer tests and the Vite build**

Run: `npx vitest run tests/junos-serialization.test.js && npm run build`

Expected: serializer test PASS and Vite build completes without Node built-in resolution warnings.

- [ ] **Step 5: Commit the serializer unit**

```bash
git add src/security/junos-serialization.js tests/junos-serialization.test.js
git commit -m "feat: add typed Junos serializers"
```

### Task 2: Intermediate input and completed-output validators

**Files:**
- Create: `src/security/junos-input-validation.js`
- Create: `src/security/junos-output-validation.js`
- Create: `tests/junos-validation.test.js`

**Interfaces:**
- Consumes: `JunosSerializationError`, `assertSafeScalar`, `setEnum`, `setInteger`, `setPort`, and `setAddressOrPrefix` from Task 1; `XMLValidator` and `XMLParser` from `fast-xml-parser`.
- Produces: `validateJunosInput(config, rootPath = 'config')`, `validateSetOutput(commands)`, and `validateXmlOutput(xml)`; each returns its original argument on success and throws `JunosSerializationError` on failure.
- Supported top-level set/XML hierarchies: `system`, `interfaces`, `chassis`, `security`, `applications`, `services`, `routing-options`, `protocols`, `policy-options`, `class-of-service`, `switch-options`, `vlans`, `forwarding-options`, `access`, `snmp`, `event-options`, `logical-systems`, and `tenants` except paths explicitly denied below.
- Denied paths: root authentication changes, clear-text system services, extension-service, scripts, event scripts/policies, commit scripts, op scripts, shell/CLI execution, and credential/key material not emitted by this converter.

- [ ] **Step 1: Write failing validator tests**

```js
import { describe, expect, it } from 'vitest';
import { validateJunosInput } from '../src/security/junos-input-validation.js';
import { validateSetOutput, validateXmlOutput } from '../src/security/junos-output-validation.js';

describe('input validation', () => {
  it.each([
    [{ metadata: { siteName: 'A\nset system services telnet' } }, 'metadata.siteName'],
    [{ security_policies: [{ action: 'permit/><system>' }] }, 'security_policies[0].action'],
    [{ address_objects: [{ value: '192.0.2.1 set system services telnet' }] }, 'address_objects[0].value'],
    [{ service_objects: [{ dst_port: '443</name>' }] }, 'service_objects[0].dst_port'],
    [{ static_routes: [{ next_hop: '192.0.2.1\u2028set system services telnet' }] }, 'static_routes[0].next_hop'],
  ])('rejects invalid field at its safe path', (config, path) => {
    expect(() => validateJunosInput(config)).toThrow(expect.objectContaining({ fieldPath: path }));
  });
  it('accepts punctuation and Unicode free text', () => {
    const config = { system_config: { login_banner: 'Ops "A" — 東京 & <notice>' } };
    expect(validateJunosInput(config)).toBe(config);
  });
});

describe('set output validation', () => {
  it('accepts the converter subset', () => {
    const commands = ['# Site: safe', '', 'set system host-name edge-1', 'deactivate security policies from-zone trust to-zone untrust policy old'];
    expect(validateSetOutput(commands)).toBe(commands);
  });
  it.each([
    ['set system host-name edge\nset system services telnet'],
    ['set system host-name "unterminated'],
    ['set system host-name edge; set system services telnet'],
    ['set system host-name $(request system reboot)'],
    ['delete security policies'],
    ['set system root-authentication plain-text-password-value secret'],
    ['set system services telnet'],
  ])('rejects injected or denied commands', commands => {
    expect(() => validateSetOutput(commands)).toThrow();
  });
});

describe('XML output validation', () => {
  it('accepts one supported configuration root', () => {
    const xml = '<?xml version="1.0"?><configuration><system><host-name>edge-1</host-name></system></configuration>';
    expect(validateXmlOutput(xml)).toBe(xml);
  });
  it.each([
    '<!DOCTYPE configuration [<!ENTITY x SYSTEM "file:///etc/passwd">]><configuration>&x;</configuration>',
    '<configuration/><configuration/>',
    '<configuration><system><services><telnet/></services></system></configuration>',
    '<configuration><system><scripts><commit><file>x</file></commit></scripts></system></configuration>',
    '<configuration><![CDATA[<system/>]]></configuration>',
    '<?evil data?><configuration/>',
  ])('rejects malformed or denied XML', xml => {
    expect(() => validateXmlOutput(xml)).toThrow();
  });
});
```

- [ ] **Step 2: Run validator tests and verify both modules are missing**

Run: `npx vitest run tests/junos-validation.test.js`

Expected: FAIL because both validation modules do not exist.

- [ ] **Step 3: Implement recursive input validation with path classification**

```js
import { assertSafeScalar, setAddressOrPrefix, setEnum, setInteger, setPort } from './junos-serialization.js';

const ENUMS = new Map([
  ['action', ['allow', 'permit', 'accept', 'deny', 'reject', 'drop', 'discard']],
  ['protocol', ['tcp', 'udp', 'icmp', 'icmp6', 'gre', 'esp', 'ah', 'any']],
  ['auth_method', ['pre-shared-keys', 'rsa-signatures', 'ecdsa-signatures']],
  ['encryption', ['aes-128-cbc', 'aes-192-cbc', 'aes-256-cbc', 'aes-128-gcm', 'aes-256-gcm', '3des-cbc']],
]);
const INTEGER_KEYS = /(?:^|_)(?:id|unit|vlan|vni|asn|metric|preference|priority|cost|timer|timeout|threshold|count|weight|mtu|bandwidth|rate|burst|interval|lifetime)$/i;
const PORT_KEYS = /(?:^|_)(?:port|src_port|dst_port|source_port|destination_port)$/i;
const ADDRESS_KEYS = /(?:^|_)(?:address|prefix|next_hop|peer_ip|gateway)$/i;

function walk(value, path, key = '') {
  if (Array.isArray(value)) return value.forEach((item, index) => walk(item, `${path}[${index}]`, key));
  if (value && typeof value === 'object') return Object.entries(value).forEach(([childKey, child]) => walk(child, `${path}.${childKey}`, childKey));
  if (value == null) return;
  assertSafeScalar(value, path.replace(/^config\./, ''));
  const fieldPath = path.replace(/^config\./, '');
  if (ENUMS.has(key)) setEnum(String(value).toLowerCase(), ENUMS.get(key), fieldPath);
  if (PORT_KEYS.test(key) && String(value) !== 'any' && !String(value).includes('-')) setPort(value, fieldPath);
  if (ADDRESS_KEYS.test(key) && value !== 'any' && !/^[A-Za-z][A-Za-z0-9.-]*$/.test(String(value))) setAddressOrPrefix(value, fieldPath);
  if (INTEGER_KEYS.test(key) && !PORT_KEYS.test(key)) setInteger(value, { min: 0 }, fieldPath);
}

export function validateJunosInput(config, rootPath = 'config') {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('config must be an object');
  walk(config, rootPath);
  return config;
}
```

Expand the enum maps with the exact existing values observed in converter conditionals. Add explicit range maps for VLAN 1–4094, VNI 1–16777215, ports 0–65535, IPv4 prefixes 0–32, IPv6 prefixes 0–128, and safe integers. Apply domain checks only to fields the converter interprets in that domain; arbitrary descriptions and notes remain free text.

- [ ] **Step 4: Implement lexical set validation and structural XML validation**

```js
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { JunosSerializationError, assertSafeScalar } from './junos-serialization.js';

const TOP_LEVEL = new Set(['system', 'interfaces', 'chassis', 'security', 'applications', 'services', 'routing-options', 'protocols', 'policy-options', 'class-of-service', 'switch-options', 'vlans', 'forwarding-options', 'access', 'snmp', 'event-options', 'logical-systems', 'tenants']);
const FORBIDDEN_SET = [
  /^system root-authentication(?:\s|$)/,
  /^system services (?:telnet|rlogin|finger)(?:\s|$)/,
  /^system (?:scripts|extensions|extension-service)(?:\s|$)/,
  /^event-options (?:event-script|policy)(?:\s|$)/,
];

function fail(kind, reason, fieldPath = 'output') {
  throw new JunosSerializationError(fieldPath, kind, reason);
}

function tokenizeSet(line, lineNumber) {
  const tokens = [];
  let token = '', quoted = false, escaped = false;
  for (const char of line) {
    if (escaped) { token += char; escaped = false; continue; }
    if (quoted && char === '\\') { token += char; escaped = true; continue; }
    if (char === '"') { quoted = !quoted; token += char; continue; }
    if (!quoted && /\s/.test(char)) { if (token) tokens.push(token); token = ''; continue; }
    if (!quoted && (char === ';' || char === '`')) fail('set output', 'command delimiters are not allowed', `line ${lineNumber}`);
    token += char;
  }
  if (quoted || escaped) fail('set output', 'quoted value is incomplete', `line ${lineNumber}`);
  if (token) tokens.push(token);
  return tokens;
}

export function validateSetOutput(commands) {
  if (!Array.isArray(commands)) fail('set output', 'expected an array of commands');
  commands.forEach((line, index) => {
    const path = `line ${index + 1}`;
    if (typeof line !== 'string') fail('set output', 'expected a string', path);
    assertSafeScalar(line, path);
    if (!line || line.startsWith('#')) return;
    const tokens = tokenizeSet(line, index + 1);
    if (!['set', 'deactivate'].includes(tokens[0])) fail('set output', 'unsupported command verb', path);
    const hierarchy = tokens.slice(1).join(' ');
    if (!TOP_LEVEL.has(tokens[1]) || /\$\(/.test(line)) fail('set output', 'unsupported hierarchy or substitution syntax', path);
    if (FORBIDDEN_SET.some(pattern => pattern.test(hierarchy))) fail('set output', 'forbidden configuration hierarchy', path);
  });
  return commands;
}

export function validateXmlOutput(xml) {
  if (typeof xml !== 'string') fail('XML output', 'expected a string');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/u.test(xml)) fail('XML output', 'forbidden control characters are not allowed');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?(?!xml\s)/i.test(xml)) fail('XML output', 'DTD, entities, CDATA, and processing instructions are not allowed');
  const result = XMLValidator.validate(xml, { allowBooleanAttributes: false });
  if (result !== true) fail('XML output', 'document is not well formed');
  const parsed = new XMLParser({ preserveOrder: true, ignoreAttributes: false, processEntities: false }).parse(xml);
  const roots = parsed.filter(node => node.configuration);
  if (roots.length !== 1 || parsed.some(node => !node.configuration && !node['?xml'])) fail('XML output', 'exactly one configuration root is required');
  inspectConfigurationTree(roots[0].configuration, TOP_LEVEL, fail);
  return xml;
}
```

Implement `inspectConfigurationTree` in the same module: collect the root element's immediate child keys, reject keys outside `TOP_LEVEL`, recursively build slash-separated paths, and reject `/system/root-authentication`, `/system/services/telnet`, `/system/services/rlogin`, `/system/scripts`, `/system/extensions`, `/event-options/event-script`, and `/event-options/policy`. For `logical-systems` and `tenants`, find nested configuration children and apply the same supported/forbidden checks below their `<name>` field.

- [ ] **Step 5: Run the validator and serializer suites**

Run: `npx vitest run tests/junos-serialization.test.js tests/junos-validation.test.js`

Expected: both files PASS; attack cases throw safe typed errors.

- [ ] **Step 6: Commit both validation boundaries**

```bash
git add src/security/junos-input-validation.js src/security/junos-output-validation.js tests/junos-validation.test.js
git commit -m "feat: validate Junos inputs and artifacts"
```

### Task 3: Set converter serialization and final validation

**Files:**
- Modify: `src/converters/srx-converter.js:18-4351`
- Create: `tests/srx-injection-defense.test.js`

**Interfaces:**
- Consumes: `validateJunosInput`, all set serializers, and `validateSetOutput` from Tasks 1–2.
- Produces: unchanged public return shapes from `convertToSrxSetCommands(config, interfaceMappings, targetContext)` and `convertMergedToSrxSetCommands(configSlots, crossLsLinks, globalConfig)`.
- Rule: every dynamic free-text value uses `setQuoted` or `setComment`; every identifier/reference uses `setIdentifier`; every enum, integer, port, address/prefix, interface token, and hostname uses its typed serializer before interpolation.

- [ ] **Step 1: Write failing adversarial set-converter tests**

```js
import { describe, expect, it } from 'vitest';
import { convertMergedToSrxSetCommands, convertToSrxSetCommands } from '../src/converters/srx-converter.js';
import { JunosSerializationError } from '../src/security/junos-serialization.js';

const base = () => ({
  metadata: { source_vendor: 'panos' },
  system_config: { hostname: 'edge-1', login_banner: 'Authorized "Ops" — 東京' },
  zones: [{ name: 'trust', interfaces: [] }, { name: 'untrust', interfaces: [] }],
  address_objects: [{ name: 'web', type: 'ip-netmask', value: '192.0.2.10/32', description: 'Web & API' }],
  security_policies: [{ name: 'allow-web', description: 'Owner: "Blue Team"', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['any'], dst_addresses: ['web'], applications: ['junos-https'], services: [], action: 'permit' }],
});

describe('set converter injection defense', () => {
  it('escapes printable quoted text and returns structurally valid output', () => {
    const joined = convertToSrxSetCommands(base()).commands.join('\n');
    expect(joined).toContain('login-message "Authorized \\"Ops\\" — 東京"');
    expect(joined).toContain('description "Owner: \\"Blue Team\\""');
  });
  it.each([
    ['metadata.siteName', config => { config.metadata.siteName = 'HQ\nset system services telnet'; }],
    ['system_config.hostname', config => { config.system_config.hostname = 'edge set system services telnet'; }],
    ['address_objects[0].description', config => { config.address_objects[0].description = 'x\u2028set system services telnet'; }],
    ['security_policies[0].action', config => { config.security_policies[0].action = 'permit deactivate system'; }],
    ['security_policies[0].name', config => { config.security_policies[0].name = 'p\rset system root-authentication'; }],
  ])('blocks attack at %s', (path, mutate) => {
    const config = base(); mutate(config);
    expect(() => convertToSrxSetCommands(config)).toThrow(expect.objectContaining({ name: 'JunosSerializationError', fieldPath: path }));
  });
  it('validates merged slot names, cross-links, and completed output', () => {
    const slots = [{ lsName: 'tenant\nset system services telnet', intermediateConfig: base(), interfaceMappings: {} }];
    expect(() => convertMergedToSrxSetCommands(slots)).toThrow(JunosSerializationError);
    const safe = [{ lsName: 'tenant-a', intermediateConfig: base(), interfaceMappings: {} }];
    expect(convertMergedToSrxSetCommands(safe).commands.some(line => line.startsWith('set logical-systems tenant-a'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the set regression and verify it fails on raw output**

Run: `npx vitest run tests/srx-injection-defense.test.js`

Expected: FAIL because raw values are interpolated and converters do not call validation.

- [ ] **Step 3: Add entry/exit validation and serialization imports**

```js
import {
  setAddressOrPrefix, setComment, setEnum, setIdentifier, setInteger,
  setPort, setQuoted, setToken,
} from '../security/junos-serialization.js';
import { validateJunosInput } from '../security/junos-input-validation.js';
import { validateSetOutput } from '../security/junos-output-validation.js';

export function convertToSrxSetCommands(config, interfaceMappings = {}, targetContext = null) {
  validateJunosInput(config);
  validateJunosInput(interfaceMappings, 'interfaceMappings');
  if (targetContext) validateJunosInput(targetContext, 'targetContext');
  // existing conversion body
  validateSetOutput(commands);
  return { commands, warnings, summary };
}
```

At the merged entry, call `validateJunosInput` for each `slot.intermediateConfig`, each `slot.interfaceMappings`, `globalConfig`, and a synthetic object containing `lsName` and each cross-link. Call `validateSetOutput(allCommands)` immediately before the merged return.

- [ ] **Step 4: Migrate core and security emission sites**

Use these exact mappings throughout `convertSystemConfig`, `convertZones`, `convertInterfaceAddresses`, `ensureZoneInterfaceFamilies`, `convertLagInterfaces`, `convertAddressObjects`, `convertAddressGroups`, `convertServiceObjects`, `convertServiceGroups`, `convertApplications`, `convertUtmPolicies`, `convertIdpPolicies`, `convertSecIntel`, `convertSchedules`, `convertUserIdentification`, `convertSecurityPolicies`, and `convertNatRules`:

```js
const name = setIdentifier(item.name, `${path}.name`);
const description = setQuoted(item.description, `${path}.description`);
const address = setAddressOrPrefix(item.value, `${path}.value`);
const port = setPort(item.dst_port, `${path}.dst_port`);
const action = setEnum(mappedAction, ['permit', 'deny', 'reject'], `${path}.action`);
commands.push(`set security address-book global address ${name} ${address}`);
commands.push(`set security address-book global address ${name} description ${description}`);
commands.push(setComment(`Site: ${config.metadata.siteName}`, 'metadata.siteName'));
```

All loop paths must include indices, for example `security_policies[${pIdx}].description`, `nat_rules[${rIdx}].translated_dst.address`, and `service_objects[${sIdx}].dst_port`. Never pass a generic path such as `policy.description` when the array index is available.

- [ ] **Step 5: Migrate routing, platform, and merged emission sites**

Apply the same typed mapping to `convertStaticRoutes`, `convertBgpConfig`, `convertOspfConfig`, `convertOspf3Config`, `convertEvpnConfig`, `convertVxlanConfig`, `convertHaConfig`, `convertMnhaConfig`, `convertScreenConfig`, `convertVpnTunnels`, `convertSyslogConfig`, `convertAaaConfig`, `convertSnmpConfig`, `convertDhcpConfig`, `convertQosConfig`, `convertL2Config`, `convertPbfConfig`, `convertSslProxyConfig`, `convertFlowMonitoringConfig`, and `convertMergedToSrxSetCommands`.

```js
const nextHop = setAddressOrPrefix(route.next_hop, `static_routes[${rIdx}].next_hop`);
const metric = setInteger(route.metric, { min: 0, max: 4294967295 }, `static_routes[${rIdx}].metric`);
const peer = setAddressOrPrefix(neighbor.peer_ip, `bgp_config.neighbors[${nIdx}].peer_ip`);
const asn = setInteger(neighbor.peer_as, { min: 1, max: 4294967295 }, `bgp_config.neighbors[${nIdx}].peer_as`);
const tunnelName = setIdentifier(tunnel.name, `vpn_tunnels[${tIdx}].name`);
const unit = setInteger(link.lt1Unit, { min: 0, max: 16385 }, `crossLsLinks[${linkIdx}].lt1Unit`);
```

Use `setToken` with explicit patterns for interface names and DNS hostnames. Use `setQuoted` for syslog filenames, SNMP contact/location, AAA prompts, DHCP descriptions, LLM notes, and every other free-text field. Use `setComment` for all comments that include metadata, names, source values, unsupported values, or rule-group labels.

- [ ] **Step 6: Add a source-contract test for protected set sites**

Append to `tests/srx-injection-defense.test.js`:

```js
import fs from 'node:fs';

it('does not directly interpolate dynamic data into protected set free-text sites', () => {
  const source = fs.readFileSync(new URL('../src/converters/srx-converter.js', import.meta.url), 'utf8');
  expect(source).not.toMatch(/description \"\$\{[^}]*(?:description|comment|note|banner)/);
  expect(source).not.toMatch(/# (?:Site|Logical-System|Source|Rule Group): \$\{/);
  expect(source).not.toMatch(/login-message \"\$\{/);
  expect(source).toContain('validateSetOutput(commands)');
  expect(source).toContain('validateSetOutput(allCommands)');
});
```

- [ ] **Step 7: Run all set and legacy converter tests**

Run: `npx vitest run tests/junos-serialization.test.js tests/junos-validation.test.js tests/srx-injection-defense.test.js && for f in tests/*.test.js; do node "$f"; done`

Expected: new security tests PASS and every legacy self-running test exits 0.

- [ ] **Step 8: Commit the set converter migration**

```bash
git add src/converters/srx-converter.js tests/srx-injection-defense.test.js
git commit -m "fix: prevent injection in Junos set output"
```

### Task 4: XML builder serialization and final validation

**Files:**
- Modify: `src/converters/srx-xml-builder.js:16-2695`
- Modify: `tests/srx-injection-defense.test.js`

**Interfaces:**
- Consumes: `validateJunosInput`, `xmlText`, `xmlAttribute`, `xmlElementName`, `xmlComment`, typed domain serializers, and `validateXmlOutput`.
- Produces: unchanged return shapes from `buildSrxXml(config, interfaceMappings, targetContext, options)` and `buildMergedSrxXml(configSlots, crossLsLinks, globalConfig)`.
- Rule: XML text/attributes always use XML serializers; dynamic tags use explicit allowlists; completed documents are structurally validated.

- [ ] **Step 1: Add failing adversarial XML tests**

```js
import { buildMergedSrxXml, buildSrxXml } from '../src/converters/srx-xml-builder.js';

describe('XML converter injection defense', () => {
  it('encodes printable text without creating structure', () => {
    const config = base();
    config.metadata.siteName = 'HQ --> <system><services><telnet/></services></system>';
    config.security_policies[0].description = 'Owner & <Blue> "Team"';
    const { xml } = buildSrxXml(config);
    expect(xml).not.toContain('<telnet/>');
    expect(xml).toContain('Owner &amp; &lt;Blue&gt; &quot;Team&quot;');
  });
  it.each([
    ['security_policies[0].action', config => { config.security_policies[0].action = 'permit/><system>'; }],
    ['system_config.hostname', config => { config.system_config.hostname = 'edge\0evil'; }],
    ['address_objects[0].value', config => { config.address_objects[0].value = '192.0.2.1</name><name>evil'; }],
  ])('rejects invalid XML-bound field at %s', (path, mutate) => {
    const config = base(); mutate(config);
    expect(() => buildSrxXml(config)).toThrow(expect.objectContaining({ fieldPath: path }));
  });
  it('rejects malicious merged logical-system and numeric link fields', () => {
    expect(() => buildMergedSrxXml([{ lsName: 'a--> <system/>', intermediateConfig: base() }])).toThrow();
    expect(() => buildMergedSrxXml([{ lsName: 'a', intermediateConfig: base() }], [{ ls1: 'a', ls2: 'b', sharedZone: 'x', lt1Unit: '1</name>', lt2Unit: 2 }])).toThrow();
  });
});
```

- [ ] **Step 2: Run the XML regression and verify it fails**

Run: `npx vitest run tests/srx-injection-defense.test.js -t "XML converter"`

Expected: FAIL on raw comments/dynamic tags or missing completed-output validation.

- [ ] **Step 3: Add XML entry/exit validation and imports**

```js
import {
  setAddressOrPrefix, setInteger, xmlAttribute, xmlComment,
  xmlElementName, xmlText,
} from '../security/junos-serialization.js';
import { validateJunosInput } from '../security/junos-input-validation.js';
import { validateXmlOutput } from '../security/junos-output-validation.js';

export function buildSrxXml(config, interfaceMappings = {}, targetContext = null, options = {}) {
  validateJunosInput(config);
  validateJunosInput(interfaceMappings, 'interfaceMappings');
  if (targetContext) validateJunosInput(targetContext, 'targetContext');
  // existing builder body
  const xml = lines.join('\n');
  if (!options.omitConfigurationWrapper) validateXmlOutput(xml);
  return { xml, warnings };
}
```

The fragment returned with `omitConfigurationWrapper` is validated only as part of the final merged document. `buildMergedSrxXml` validates all slot/cross-link/global input and calls `validateXmlOutput(xml)` immediately before return.

- [ ] **Step 4: Replace text, attribute, comment, and tag emission across every builder**

Use these exact patterns in all XML builders from `buildZonesXml` through `buildSystemConfigXml`:

```js
const policyPath = `security_policies[${pIdx}]`;
lines.push(`          <name>${xmlText(sanitizeJunosName(policy.name), `${policyPath}.name`)}</name>`);
lines.push(`          <description>${xmlText(policy.description, `${policyPath}.description`)}</description>`);
const actionTag = xmlElementName(actionMap[policy.action], ['permit', 'deny', 'reject'], `${policyPath}.action`);
lines.push(`            <${actionTag}/>`);
lines.push(xmlComment(`Source rule: ${policy.name}`, `${policyPath}.name`));
const metric = setInteger(route.metric, { min: 0, max: 4294967295 }, `static_routes[${rIdx}].metric`);
lines.push(`              <metric>${xmlText(metric, `static_routes[${rIdx}].metric`)}</metric>`);
```

Explicitly migrate dynamic tags at policy action, IDP action, schedule day, category, and context wrapper. Explicitly migrate comments at site identification, unsupported values, source annotations, logical systems, merge headers, and rule groups. Remove the file-local `escapeXml`; no emission site may bypass `xmlText`, `xmlAttribute`, or `xmlComment`.

- [ ] **Step 5: Add XML source-contract assertions**

Append:

```js
it('does not retain raw XML interpolation helpers or unvalidated dynamic tags', () => {
  const source = fs.readFileSync(new URL('../src/converters/srx-xml-builder.js', import.meta.url), 'utf8');
  expect(source).not.toMatch(/function escapeXml/);
  expect(source).not.toMatch(/<!--[^\n]*\$\{/);
  expect(source).not.toMatch(/<\$\{(?:action|day|category|ctxTag)/);
  expect(source).toContain('validateXmlOutput(xml)');
});
```

- [ ] **Step 6: Run security, round-trip, and build tests**

Run: `npx vitest run tests/junos-serialization.test.js tests/junos-validation.test.js tests/srx-injection-defense.test.js && for f in tests/*.test.js; do node "$f"; done && npm run build`

Expected: all tests PASS, valid XML is well formed, and Vite builds all modules.

- [ ] **Step 7: Commit the XML builder migration**

```bash
git add src/converters/srx-xml-builder.js tests/srx-injection-defense.test.js
git commit -m "fix: prevent injection in Junos XML output"
```

### Task 5: Fail-closed engine and UI behavior

**Files:**
- Modify: `public/utils/engine.js:45-108`
- Modify: `public/hooks/useConversion.js:38-163`
- Create: `tests/conversion-security.test.js`

**Interfaces:**
- Consumes: typed serialization errors from Tasks 1–4 and `CLEAR_OUTPUT` from `ConversionContext`.
- Produces: `formatJunosSerializationError(error, prefix)` returning a safe UI message; single and merged handlers clear prior output before conversion and again on failure.

- [ ] **Step 1: Write failing UI-safety helper and engine tests**

```js
import { describe, expect, it } from 'vitest';
import { JunosSerializationError } from '../src/security/junos-serialization.js';
import { formatJunosSerializationError } from '../public/hooks/useConversion.js';
import { convertConfig, mergeConvert } from '../public/utils/engine.js';

describe('conversion fail-closed behavior', () => {
  it('formats a typed error without reflecting attacker input', () => {
    const error = new JunosSerializationError('metadata.siteName', 'scalar', 'control characters are not allowed');
    const message = formatJunosSerializationError(error, 'Conversion');
    expect(message).toBe('Conversion blocked: metadata.siteName — control characters are not allowed');
    expect(message).not.toContain('attacker');
  });
  it('blocks both engine paths before returning output', async () => {
    await expect(convertConfig({ metadata: { siteName: 'x\nset system services telnet' } }, 'set')).rejects.toMatchObject({ fieldPath: 'metadata.siteName' });
    await expect(mergeConvert([{ lsName: 'x\nset system services telnet', intermediateConfig: {} }], [], 'xml')).rejects.toHaveProperty('name', 'JunosSerializationError');
  });
});
```

- [ ] **Step 2: Run the test and verify the helper is missing**

Run: `npx vitest run tests/conversion-security.test.js`

Expected: FAIL because `formatJunosSerializationError` is not exported.

- [ ] **Step 3: Export the safe formatter and clear stale output**

```js
import { JunosSerializationError } from '../../src/security/junos-serialization.js';

export function formatJunosSerializationError(error, prefix) {
  if (error instanceof JunosSerializationError) {
    return `${prefix} blocked: ${error.fieldPath} — ${error.reason}`;
  }
  return `${prefix} error: ${error instanceof Error ? error.message : 'Unexpected conversion failure'}`;
}
```

In both `handleConvert` and `handleMergeConvert`, dispatch `{ type: 'CLEAR_OUTPUT' }` immediately before the `try`. In each `catch`, dispatch it again and use `formatJunosSerializationError(err, 'Conversion')` or `formatJunosSerializationError(err, 'Merge conversion')`. This guarantees copy, export, download, validation, and push controls cannot retain a previous valid payload after the current input fails.

- [ ] **Step 4: Keep final validation at the public engine boundary**

After the selected converter returns in `convertConfig` and `mergeConvert`, call `validateSetOutput(output.commands)` or `validateXmlOutput(output.xml)` based on `format`. This is deliberately redundant with converter entry points and protects future converter replacements.

```js
const { validateSetOutput, validateXmlOutput } = await import('../../src/security/junos-output-validation.js');
if (format === 'xml') validateXmlOutput(output.xml);
else validateSetOutput(output.commands);
```

- [ ] **Step 5: Run context, engine, and build verification**

Run: `npx vitest run tests/conversion-security.test.js tests/context-reducers.test.js tests/srx-injection-defense.test.js && npm run build`

Expected: all tests PASS; stale output clearing uses the existing reducer action; build succeeds.

- [ ] **Step 6: Commit fail-closed browser behavior**

```bash
git add public/utils/engine.js public/hooks/useConversion.js tests/conversion-security.test.js
git commit -m "fix: fail closed on unsafe conversion input"
```

### Task 6: PyEZ bridge validation before connection

**Files:**
- Create: `tools/pyez-bridge/config_validation.py`
- Create: `tools/pyez-bridge/tests/test_config_validation.py`
- Modify: `tools/pyez-bridge/app.py:337-367`
- Modify: `tools/pyez-bridge/tests/test_app_security.py:24-130`

**Interfaces:**
- Produces: `ConfigurationValidationError(message, line=None, path=None)`, `validate_config_payload(config_text, fmt) -> str`, `validate_set_config(config_text) -> str`, and `validate_xml_config(config_text) -> str`.
- `validate_config_payload` returns normalized set text or the original XML on success and raises a safe typed error on rejection.
- The route returns HTTP 400 `{ "ok": false, "error": "Configuration validation failed.", "details": { "line": N?, "path": "..."?, "reason": "..." } }` without echoing configuration content.

- [ ] **Step 1: Write failing Python validator unit tests**

```python
import unittest

from config_validation import ConfigurationValidationError, validate_config_payload


class ConfigValidationTests(unittest.TestCase):
    def test_accepts_supported_set_and_xml(self):
        self.assertEqual(validate_config_payload("# note\nset system host-name edge-1\n", "set"), "set system host-name edge-1")
        xml = "<configuration><system><host-name>edge-1</host-name></system></configuration>"
        self.assertEqual(validate_config_payload(xml, "xml"), xml)

    def test_rejects_set_injection_and_forbidden_hierarchies(self):
        for text in (
            "set system host-name edge-1\nset system services telnet",
            "set system host-name \"unterminated",
            "set system host-name edge; set system services telnet",
            "set system host-name $(request system reboot)",
            "delete security policies",
            "set system root-authentication plain-text-password-value secret",
        ):
            with self.subTest(text=text), self.assertRaises(ConfigurationValidationError):
                validate_config_payload(text, "set")

    def test_rejects_xml_entities_multiple_roots_and_dangerous_paths(self):
        payloads = (
            '<!DOCTYPE configuration [<!ENTITY x SYSTEM "file:///etc/passwd">]><configuration>&x;</configuration>',
            '<configuration/><configuration/>',
            '<configuration><system><services><telnet/></services></system></configuration>',
            '<?evil x?><configuration/>',
        )
        for text in payloads:
            with self.subTest(text=text), self.assertRaises(ConfigurationValidationError):
                validate_config_payload(text, "xml")

    def test_disables_text_load(self):
        with self.assertRaises(ConfigurationValidationError):
            validate_config_payload("system { host-name edge-1; }", "text")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run unit tests and verify the module is missing**

Run: `venv/bin/python -m unittest tools/pyez-bridge/tests/test_config_validation.py -v`

Expected: FAIL with `ModuleNotFoundError: config_validation`.

- [ ] **Step 3: Implement Python set/XML validation**

```python
import re
from dataclasses import dataclass
from lxml import etree

SUPPORTED_TOP = frozenset({"system", "interfaces", "chassis", "security", "applications", "services", "routing-options", "protocols", "policy-options", "class-of-service", "switch-options", "vlans", "forwarding-options", "access", "snmp", "event-options", "logical-systems", "tenants"})
FORBIDDEN_PATHS = ("system/root-authentication", "system/services/telnet", "system/services/rlogin", "system/scripts", "system/extensions", "event-options/event-script", "event-options/policy")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f-\x9f\u2028\u2029]")

@dataclass
class ConfigurationValidationError(ValueError):
    message: str
    line: int | None = None
    path: str | None = None
    def __str__(self):
        return self.message

def validate_config_payload(config_text, fmt):
    if not isinstance(config_text, str):
        raise ConfigurationValidationError("Configuration must be text.")
    if fmt == "set": return validate_set_config(config_text)
    if fmt == "xml": return validate_xml_config(config_text)
    raise ConfigurationValidationError("Only set and XML configuration loads are supported.")

def validate_set_config(config_text):
    accepted = []
    for line_number, raw in enumerate(config_text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"): continue
        if CONTROL_RE.search(line): raise ConfigurationValidationError("Control characters are not allowed.", line=line_number)
        tokens = _tokenize_set_line(line, line_number)
        if tokens[0] not in {"set", "deactivate"}: raise ConfigurationValidationError("Unsupported command verb.", line=line_number)
        hierarchy = " ".join(tokens[1:])
        if tokens[1] not in SUPPORTED_TOP or any(hierarchy.startswith(path.replace("/", " ")) for path in FORBIDDEN_PATHS):
            raise ConfigurationValidationError("Unsupported or forbidden hierarchy.", line=line_number)
        accepted.append(line)
    if not accepted: raise ConfigurationValidationError("Configuration is empty after filtering.")
    return "\n".join(accepted)

def validate_xml_config(config_text):
    if re.search(r"<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?(?!xml\s)", config_text, re.I):
        raise ConfigurationValidationError("DTD, entities, CDATA, and processing instructions are not allowed.")
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False, huge_tree=False, remove_comments=False)
    try: root = etree.fromstring(config_text.encode("utf-8"), parser)
    except (etree.XMLSyntaxError, ValueError, UnicodeError):
        raise ConfigurationValidationError("XML is not well formed.") from None
    if root.tag != "configuration": raise ConfigurationValidationError("The root element must be configuration.", path="/")
    _inspect_xml_tree(root)
    return config_text
```

Implement `_tokenize_set_line` as the same quote/backslash state machine as the JS validator, rejecting `;`, backticks, `$(`, incomplete quotes, and controls outside or inside quoted fields. Implement `_inspect_xml_tree` using local names only after rejecting namespaces; validate immediate top-level children against `SUPPORTED_TOP`, recursively construct `/` paths, and reject every `FORBIDDEN_PATHS` suffix including below logical-system/tenant wrappers.

- [ ] **Step 4: Add route tests proving validation precedes `_connect`**

Append to `BridgeApplicationSecurityTests`:

```python
    def test_load_validation_rejects_before_connect(self):
        self.devices_file.write_text("devices:\n  - name: edge\n    host: 127.0.0.1\n    username: user\n    password: pass\n", encoding="utf-8")
        payloads = (
            {"format": "set", "config": "set system services telnet"},
            {"format": "set", "config": "set system host-name x\nset system root-authentication plain-text-password-value x"},
            {"format": "xml", "config": "<configuration><system><services><telnet/></services></system></configuration>"},
            {"format": "text", "config": "system { host-name edge; }"},
        )
        with patch.object(app_module, "_connect") as connect:
            for payload in payloads:
                with self.subTest(payload=payload):
                    response = self.client.post("/devices/edge/load", headers=self.auth, json=payload)
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(response.get_json()["error"], "Configuration validation failed.")
        connect.assert_not_called()
```

- [ ] **Step 5: Invoke validation at the first safe point in `/load`**

```python
from config_validation import ConfigurationValidationError, validate_config_payload

fmt = data.get("format", "set")
try:
    config_text = validate_config_payload(data["config"], fmt)
except ConfigurationValidationError as exc:
    details = {"reason": exc.message}
    if exc.line is not None: details["line"] = exc.line
    if exc.path is not None: details["path"] = exc.path
    return jsonify({"ok": False, "error": "Configuration validation failed.", "details": details}), 400

dev = None
```

Remove the old three-format allowlist and old set comment filtering because validation now owns both. Do not modify the config retrieval endpoint: its `format=text` is read-only operational output, not a configuration load.

- [ ] **Step 6: Run bridge unit and route suites**

Run: `venv/bin/python -m unittest discover -s tools/pyez-bridge/tests -v`

Expected: all tests PASS, every rejected payload returns 400, and `_connect` is never called.

- [ ] **Step 7: Commit bridge defense-in-depth**

```bash
git add tools/pyez-bridge/config_validation.py tools/pyez-bridge/app.py tools/pyez-bridge/tests/test_config_validation.py tools/pyez-bridge/tests/test_app_security.py
git commit -m "fix: validate configs before PyEZ connection"
```

### Task 7: Full attack matrix, documentation, and CI verification

**Files:**
- Modify: `tests/srx-injection-defense.test.js`
- Modify: `README.md`
- Modify: `tools/pyez-bridge/README.md`
- Modify: `.github/workflows/ci.yml` only if the new test files are not already selected by existing glob/discovery commands.

**Interfaces:**
- Consumes: all browser and bridge security boundaries from Tasks 1–6.
- Produces: a permanent regression matrix for descriptions, metadata, system fields, identifiers, policy/NAT enums, addresses, ports, routing, VPN, HA, dynamic XML tags, merged slots, and LLM-derived notes.

- [ ] **Step 1: Expand the converter attack matrix with table-driven fixtures**

```js
const attacks = [
  ['metadata.siteName', config => { config.metadata.siteName = 'HQ\nset system services telnet'; }],
  ['metadata.siteGroup', config => { config.metadata.siteGroup = 'A\u2028B'; }],
  ['system_config.login_banner', config => { config.system_config.login_banner = 'x\0y'; }],
  ['security_policies[0].description', config => { config.security_policies[0].description = 'x\rdeactivate security policies'; }],
  ['security_policies[0].action', config => { config.security_policies[0].action = 'permit/><system>'; }],
  ['address_objects[0].value', config => { config.address_objects[0].value = '192.0.2.1;set system services telnet'; }],
];

it.each(['set', 'xml'])('blocks the full attack matrix for %s output', format => {
  for (const [path, mutate] of attacks) {
    const config = base(); mutate(config);
    const call = () => format === 'set' ? convertToSrxSetCommands(config) : buildSrxXml(config);
    try { call(); throw new Error(`expected ${path} to fail`); }
    catch (error) {
      expect(error).toMatchObject({ name: 'JunosSerializationError', fieldPath: path });
      expect(error.message).not.toContain('set system services telnet');
    }
  }
});
```

Add valid round-trip cases for ordinary quotes/backslashes, `&<>`, em dashes, Japanese text, valid IPv4/IPv6 prefixes, all supported actions, port bounds, and existing set/XML fixtures. Parse valid XML through `XMLParser` and validate set output through `validateSetOutput`.

- [ ] **Step 2: Document the supported security boundary**

Add to the main README security section:

```markdown
### Safe Junos output

Set and XML conversions treat imported and AI-assisted values as untrusted. Values are validated by field type, serialized for their Junos context, and the completed artifact is structurally validated before it can be displayed or pushed. Invalid values stop conversion and identify the intermediate field path without echoing the rejected value.
```

Add to the bridge README load section:

```markdown
Configuration load accepts the converter's supported `set` and XML subset only. The bridge validates commands/elements before opening NETCONF and rejects text/brace-format loads, control characters, malformed quoting/XML, unsupported hierarchies, scripts, clear-text management services, and credential-changing paths.
```

- [ ] **Step 3: Run focused security verification**

Run: `npx vitest run tests/junos-serialization.test.js tests/junos-validation.test.js tests/srx-injection-defense.test.js tests/conversion-security.test.js && venv/bin/python -m unittest discover -s tools/pyez-bridge/tests -v`

Expected: all security tests PASS with no skipped attack cases.

- [ ] **Step 4: Run the complete repository verification**

Run: `npx vitest run && for f in tests/*.test.js; do node "$f"; done && venv/bin/python -m unittest discover -s tools/pyez-bridge/tests -v && npm run build`

Expected: all Vitest suites PASS, every self-running JavaScript test exits 0, every Python bridge test PASS, and Vite builds successfully.

- [ ] **Step 5: Review the final diff for unsafe interpolation and secrets**

Run: `rg -n 'description "\$\{|login-message "\$\{|<!--.*\$\{|<\$\{' src/converters/srx-converter.js src/converters/srx-xml-builder.js && git diff --check && git status --short`

Expected: `rg` finds no unreviewed protected interpolation; `git diff --check` emits no output; status lists only the intended issue #12 files.

- [ ] **Step 6: Commit regression coverage and documentation**

```bash
git add tests/srx-injection-defense.test.js README.md tools/pyez-bridge/README.md .github/workflows/ci.yml
git commit -m "test: cover Junos injection attack matrix"
```

If `.github/workflows/ci.yml` did not change, omit it from `git add` rather than creating a no-op workflow edit.

### Task 8: Publish, review, CI, and merge issue #12

**Files:**
- No source changes expected; any review fix begins with a new failing regression test and its own commit.

**Interfaces:**
- Consumes: fully verified branch `agent/issue-12-prevent-config-injection`.
- Produces: one GitHub pull request linked to issue #12, green CI, merged main branch, closed issue, and a removed/pruned worktree.

- [ ] **Step 1: Verify branch scope and commit history**

Run: `git status --short && git log --oneline main..HEAD && git diff --stat main...HEAD && git diff --check main...HEAD`

Expected: clean status; only issue #12 design, plan, implementation, tests, and documentation commits; no whitespace errors.

- [ ] **Step 2: Push the isolated branch**

Run: `git push -u origin agent/issue-12-prevent-config-injection`

Expected: branch is created on origin and upstream tracking is configured.

- [ ] **Step 3: Open the pull request**

```bash
gh pr create --base main --head agent/issue-12-prevent-config-injection --title "fix: prevent Junos configuration injection" --body "## Summary
- validate and type-serialize all dynamic Junos set/XML values
- reject malformed or dangerous completed artifacts and clear stale browser output
- revalidate set/XML in the PyEZ bridge before NETCONF; disable text loads
- cover adversarial fields, merged output, and valid Unicode/punctuation

## Verification
- npx vitest run
- all self-running JavaScript tests
- Python bridge unittest discovery
- npm run build

Closes #12"
```

Expected: GitHub returns the new PR URL and issue #12 is linked for automatic closure.

- [ ] **Step 4: Inspect the PR diff and request review**

Run: `gh pr view --web=false && gh pr diff --name-only`

Expected: base is `main`, head is the issue branch, and the changed files match this plan.

- [ ] **Step 5: Watch CI to completion**

Run: `gh pr checks --watch --fail-fast`

Expected: every required GitHub Actions check completes successfully. If a check fails, use `superpowers:systematic-debugging` plus `github:gh-fix-ci`, reproduce locally, add a failing test, commit the minimal fix, push, and watch the replacement run.

- [ ] **Step 6: Merge only after green CI and no unresolved review threads**

Run: `gh pr merge --squash --delete-branch`

Expected: PR reports merged and issue #12 reports closed.

- [ ] **Step 7: Verify post-merge main and clean the worktree**

From the primary checkout run: `git pull --ff-only origin main && gh issue view 12 --json state,url && git worktree remove .worktrees/issue-12-prevent-config-injection && git worktree prune && git worktree list`

Expected: local `main` contains the merge, issue state is `CLOSED`, the issue #12 worktree is absent, and no worktree metadata remains.
