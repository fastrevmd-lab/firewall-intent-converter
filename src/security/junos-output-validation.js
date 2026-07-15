import { XMLParser, XMLValidator } from 'fast-xml-parser';

import {
  JunosSerializationError,
  assertSafeScalar,
} from './junos-serialization.js';

const SUPPORTED_TOP_LEVEL = new Set([
  'system',
  'interfaces',
  'chassis',
  'security',
  'applications',
  'services',
  'routing-options',
  'routing-instances',
  'protocols',
  'policy-options',
  'class-of-service',
  'switch-options',
  'bridge-domains',
  'vlans',
  'forwarding-options',
  'firewall',
  'access',
  'snmp',
  'event-options',
  'schedulers',
  'logical-systems',
  'tenants',
]);

const CONTEXT_WRAPPERS = new Set(['logical-systems', 'tenants']);
const FORBIDDEN_PATHS = [
  ['system', 'root-authentication'],
  ['system', 'services', 'telnet'],
  ['system', 'services', 'rlogin'],
  ['system', 'services', 'finger'],
  ['system', 'scripts'],
  ['system', 'extensions'],
  ['system', 'extension-service'],
  ['event-options', 'event-script'],
  ['event-options', 'policy'],
];
const FORBIDDEN_XML_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/u;

function fail(valueKind, reason, fieldPath = 'output') {
  throw new JunosSerializationError(fieldPath, valueKind, reason);
}

function startsWithPath(tokens, path) {
  return path.every((part, index) => tokens[index] === part);
}

function unwrapSetHierarchy(tokens) {
  if (!CONTEXT_WRAPPERS.has(tokens[0])) return tokens;
  if (tokens.length < 3) return [];
  return tokens.slice(2);
}

function tokenizeSetLine(line, lineNumber) {
  const tokens = [];
  let token = '';
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (quoted && char === '\\') {
      token += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      token += char;
      continue;
    }
    if (!quoted && /\s/u.test(char)) {
      if (token) tokens.push(token);
      token = '';
      continue;
    }
    if (!quoted && [';', '`', '#', '{', '}', '\\'].includes(char)) {
      fail('set output', 'command delimiters are not allowed', `line ${lineNumber}`);
    }
    if (!quoted && char === '$' && line[index + 1] === '(') {
      fail('set output', 'command substitution syntax is not allowed', `line ${lineNumber}`);
    }
    token += char;
  }

  if (quoted || escaped) {
    fail('set output', 'quoted value is incomplete', `line ${lineNumber}`);
  }
  if (token) tokens.push(token);
  return tokens;
}

/**
 * Validates an IPv4-shaped token (four dot-separated numbers, optional /prefix).
 * Checks that all octets are 0-255 and prefix (if present) is 0-32.
 * @param {string} token - token to validate
 * @param {string} fieldPath - context for error reporting
 */
function validateIpv4Token(token, fieldPath) {
  const prefixMatch = token.match(/^([^/]+)(?:\/(\d+))?$/u);
  if (!prefixMatch) return;

  const [, address, prefix] = prefixMatch;
  const octets = address.split('.');

  // Every octet must be 0–255
  for (const octet of octets) {
    const num = parseInt(octet, 10);
    if (num < 0 || num > 255) {
      fail('set output', 'malformed IPv4 address or prefix', fieldPath);
    }
  }

  // Prefix (if present) must be 0–32
  if (prefix !== undefined) {
    const prefixNum = parseInt(prefix, 10);
    if (prefixNum < 0 || prefixNum > 32) {
      fail('set output', 'malformed IPv4 address or prefix', fieldPath);
    }
  }
}

export function validateSetOutput(commands) {
  if (!Array.isArray(commands)) fail('set output', 'expected an array of commands');

  // Fix 2: Track NAT rule completeness (every rule with match must have then)
  const natRuleState = new Map(); // key: 'natType|ruleSet|rule', value: {hasMatch, hasThen}

  commands.forEach((line, index) => {
    const fieldPath = `line ${index + 1}`;
    if (typeof line !== 'string') fail('set output', 'expected a string', fieldPath);
    assertSafeScalar(line, fieldPath);

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const tokens = tokenizeSetLine(trimmed, index + 1);
    if (!['set', 'deactivate'].includes(tokens[0])) {
      fail('set output', 'unsupported command verb', fieldPath);
    }
    if (!SUPPORTED_TOP_LEVEL.has(tokens[1])) {
      fail('set output', 'unsupported top-level hierarchy', fieldPath);
    }

    const hierarchy = unwrapSetHierarchy(tokens.slice(1));
    if (!hierarchy.length || !SUPPORTED_TOP_LEVEL.has(hierarchy[0])) {
      fail('set output', 'context wrapper does not contain a supported hierarchy', fieldPath);
    }
    if (FORBIDDEN_PATHS.some(path => startsWithPath(hierarchy, path))) {
      fail('set output', 'forbidden configuration hierarchy', fieldPath);
    }

    // Validate IPv4-shaped tokens (four dot-separated numeric groups, optional /prefix)
    const ipv4Pattern = /^\d+(?:\.\d+){3}(?:\/\d+)?$/u;
    for (const token of tokens) {
      if (ipv4Pattern.test(token)) {
        validateIpv4Token(token, fieldPath);
      }
    }

    // NAT pool address literal gate (Issue #35): NAT pools must only contain literal IP addresses/prefixes
    // Match: set security nat (source|destination) pool <name> address <X>
    // where <X> is the final token and is NOT the keyword 'port'
    if (hierarchy[0] === 'security' && hierarchy[1] === 'nat' &&
        (hierarchy[2] === 'source' || hierarchy[2] === 'destination') &&
        hierarchy[3] === 'pool' && tokens.length >= 7) {
      // tokens: [set, security, nat, source/destination, pool, <name>, address, ...]
      const addressIdx = tokens.indexOf('address', 6);
      if (addressIdx !== -1 && addressIdx < tokens.length - 1) {
        const addressValueIdx = addressIdx + 1;
        const addressValue = tokens[addressValueIdx];
        // Skip validation if this is an 'address port <N>' line (addressValue === 'port')
        if (addressValue !== 'port') {
          // addressValue must be a valid IPv4/IPv6 address/prefix or range (a-b)
          const isIpv4 = /^\d+\.\d+\.\d+\.\d+(\/\d+)?$/u.test(addressValue);
          const isIpv6 = /^[0-9a-fA-F:]+\/\d+$/u.test(addressValue);
          const isRange = /^\d+\.\d+\.\d+\.\d+-\d+\.\d+\.\d+\.\d+$/u.test(addressValue);
          if (!isIpv4 && !isIpv6 && !isRange) {
            fail('set output', 'NAT pool address must be a literal IP address, prefix, or range', fieldPath);
          }
        }
      }
    }

    // Fix 2: Track NAT rule match/then completeness
    // Match: set security nat (source|destination) rule-set <rs> rule <rule> (match|then) ...
    // Ignore deactivate lines
    if (tokens[0] === 'set' && hierarchy[0] === 'security' && hierarchy[1] === 'nat' &&
        (hierarchy[2] === 'source' || hierarchy[2] === 'destination') &&
        hierarchy[3] === 'rule-set' && tokens.length >= 8) {
      // tokens: [set, security, nat, source/destination, rule-set, <rs>, rule, <rule>, match|then, ...]
      const ruleIdx = tokens.indexOf('rule', 6);
      if (ruleIdx !== -1 && ruleIdx + 1 < tokens.length) {
        const ruleName = tokens[ruleIdx + 1];
        const nextToken = tokens[ruleIdx + 2];
        if (nextToken === 'match' || nextToken === 'then') {
          const natType = hierarchy[2];
          const ruleSet = tokens[5]; // rule-set name
          const key = `${natType}|${ruleSet}|${ruleName}`;
          if (!natRuleState.has(key)) {
            natRuleState.set(key, { hasMatch: false, hasThen: false });
          }
          const state = natRuleState.get(key);
          if (nextToken === 'match') state.hasMatch = true;
          if (nextToken === 'then') state.hasThen = true;
        }
      }
    }
  });

  // Fix 2: Verify every NAT rule with match has then
  for (const [key, state] of natRuleState.entries()) {
    if (state.hasMatch && !state.hasThen) {
      fail('set output', 'NAT rule has match without a then action', `NAT rule ${key}`);
    }
  }

  return commands;
}

function childElements(nodes) {
  if (!Array.isArray(nodes)) return [];
  const children = [];
  for (const node of nodes) {
    for (const [name, value] of Object.entries(node)) {
      if (name === ':@' || name.startsWith('#') || name.startsWith('?')) continue;
      children.push({ name, value });
    }
  }
  return children;
}

function pathEndsWith(path, suffix) {
  if (path.length < suffix.length) return false;
  return suffix.every((part, index) => path[path.length - suffix.length + index] === part);
}

function inspectXmlChildren(nodes, path = []) {
  for (const { name, value } of childElements(nodes)) {
    if (name.includes(':')) fail('XML output', 'XML namespaces are not supported');
    const currentPath = [...path, name];
    if (FORBIDDEN_PATHS.some(forbidden => pathEndsWith(currentPath, forbidden))) {
      fail('XML output', 'forbidden configuration hierarchy', `/${currentPath.join('/')}`);
    }
    inspectXmlChildren(value, currentPath);
  }
}

export function validateXmlOutput(xml) {
  if (typeof xml !== 'string') fail('XML output', 'expected a string');
  if (FORBIDDEN_XML_CONTROL.test(xml)) {
    fail('XML output', 'forbidden control characters are not allowed');
  }
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?(?!xml(?:\s|\?>))/iu.test(xml)) {
    fail('XML output', 'DTD, entities, CDATA, and processing instructions are not allowed');
  }

  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: false });
  if (validation !== true) fail('XML output', 'document is not well formed');

  let parsed;
  try {
    parsed = new XMLParser({
      preserveOrder: true,
      ignoreAttributes: false,
      processEntities: false,
      commentPropName: '#comment',
    }).parse(xml);
  } catch (_error) {
    fail('XML output', 'document is not well formed');
  }

  const roots = parsed.filter(node => Object.hasOwn(node, 'configuration'));
  const outsideRoot = parsed.filter(node => (
    !Object.hasOwn(node, 'configuration') && !Object.hasOwn(node, '?xml')
  ));
  if (roots.length !== 1 || outsideRoot.length > 0) {
    fail('XML output', 'exactly one configuration root with no outside content is required');
  }

  const rootChildren = childElements(roots[0].configuration);
  for (const { name } of rootChildren) {
    if (!SUPPORTED_TOP_LEVEL.has(name)) {
      fail('XML output', 'unsupported top-level hierarchy', `/configuration/${name}`);
    }
  }
  inspectXmlChildren(roots[0].configuration);
  return xml;
}
