# Config Validation v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand post-conversion SRX output validator with hardware, operational, and compliance checks plus license gating, integrated into the existing WarningsPanel.

**Architecture:** Layered validation engine with three check modules (`hardware-checks.js`, `operational-checks.js`, `compliance-checks.js`) orchestrated by `srx-validation-engine.js`. Findings inject into the existing warning system via `createWarning()`. A "Validate" button in the platform bar triggers the engine on demand. License gating toggle controls whether gated commands are stripped or just warned.

**Tech Stack:** Vanilla JavaScript ES modules, React (hooks + context), existing `createWarning()` from `parser-utils.js`, existing `SRX_CAPACITY_LIMITS` and `SRX_MODELS` from `hardware-db.js`, existing `SRX_LICENSE_TIERS` and `licenseTierCovers()` from `srx-view-transforms.js`.

**Design Spec:** `docs/superpowers/specs/2026-04-08-config-validation-v2-design.md`

---

## File Structure

```
src/validators/
  srx-validator.js              # EXISTING — unchanged
  srx-validation-engine.js      # NEW — orchestrator
  hardware-checks.js            # NEW — tier 1: model limits + interface checks
  operational-checks.js         # NEW — tier 2: operational best practices
  compliance-checks.js          # NEW — tier 3: STIG/hardening

tests/
  validation-engine.test.js     # NEW — tests for all 3 modules + engine

public/
  hooks/useConversion.js        # MODIFY — add handleValidate handler
  components/layout/ContentRouter.jsx  # MODIFY — add Validate button + checkbox to platform bar
  components/WarningsPanel.jsx  # MODIFY — add "Validation" source filter button
  contexts/ConversionContext.jsx # MODIFY — add validationFindings to state
```

---

### Task 1: Hardware Checks Module

**Files:**
- Create: `src/validators/hardware-checks.js`
- Reference: `public/data/hardware-db.js:2358-2422` (existing `SRX_CAPACITY_LIMITS`, `SRX_MODELS`)

- [ ] **Step 1: Create `hardware-checks.js` with the `runHardwareChecks` function**

```js
// src/validators/hardware-checks.js
/**
 * Hardware validation checks — validates SRX output against target model limits.
 * @module hardware-checks
 */

import { createWarning } from '../parsers/parser-utils.js';

/**
 * Model tier limits for checks not covered by SRX_CAPACITY_LIMITS
 * (interface type and throughput are model-specific, handled via SRX_MODELS)
 */

/**
 * Counts unique interface names referenced in SRX set commands.
 * Matches patterns like: set interfaces ge-0/0/0 ...
 * @param {string[]} commands - SRX set command lines
 * @returns {Set<string>} unique interface names
 */
function extractInterfaces(commands) {
  const ifacePattern = /^set interfaces ((?:ge|xe|et|mge|ae|lo|irb|st|reth|fxp)-[\d/:.]+)/;
  const ifaces = new Set();
  for (const cmd of commands) {
    const match = cmd.match(ifacePattern);
    if (match) ifaces.add(match[1]);
  }
  return ifaces;
}

/**
 * Determines which interface speed prefixes a model supports.
 * @param {Object} model - Model entry from SRX_MODELS with `ports` array
 * @returns {Set<string>} speed prefixes supported (e.g., 'ge', 'xe', 'et')
 */
function getModelPortPrefixes(model) {
  const prefixes = new Set();
  for (const port of (model.ports || [])) {
    const match = port.name.match(/^(ge|xe|et|mge)-/);
    if (match) prefixes.add(match[1]);
  }
  return prefixes;
}

/**
 * Parses a throughput string like "12 Gbps" or "500 Mbps" to Mbps number.
 * @param {string} str - Throughput string
 * @returns {number} throughput in Mbps, or 0 if unparseable
 */
function parseThroughputMbps(str) {
  if (!str || str === 'N/A') return 0;
  const match = str.match(/([\d.]+)\s*(Gbps|Mbps)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  return match[2].toLowerCase() === 'gbps' ? val * 1000 : val;
}

/**
 * Runs hardware validation checks against the SRX output.
 *
 * @param {string[]} commands - Array of SRX set command strings
 * @param {string|null} targetModel - Target SRX model name (e.g., 'SRX345')
 * @param {Object} modelDb - SRX_MODELS object from hardware-db.js
 * @param {Object} capacityLimits - SRX_CAPACITY_LIMITS object from hardware-db.js
 * @param {Object} intermediateConfig - Parsed intermediate config (for count checks)
 * @param {Object|null} sourceModel - Source model entry (for throughput comparison)
 * @returns {Object[]} Array of warning objects from createWarning()
 */
export function runHardwareChecks(commands, targetModel, modelDb, capacityLimits, intermediateConfig, sourceModel) {
  const findings = [];

  // H7: No target model selected — skip all checks
  if (!targetModel || !modelDb[targetModel]) {
    findings.push(createWarning(
      'info',
      'hardware/no-model',
      'No target SRX model selected — hardware validation skipped.',
      'Select a target SRX model in Model Selector for hardware validation.'
    ));
    return findings;
  }

  const model = modelDb[targetModel];
  const limits = capacityLimits[targetModel];

  // H1: Interface count vs model ports
  const usedIfaces = extractInterfaces(commands);
  const physicalIfaces = new Set([...usedIfaces].filter(n => !n.startsWith('lo') && !n.startsWith('irb') && !n.startsWith('st') && !n.startsWith('ae')));
  const modelPortCount = (model.ports || []).length;
  if (modelPortCount > 0 && physicalIfaces.size > modelPortCount) {
    findings.push(createWarning(
      'unsupported',
      'hardware/interface-count',
      `Config uses ${physicalIfaces.size} physical interfaces but ${targetModel} only has ${modelPortCount} ports.`,
      `Reduce interface count or select a larger model. Used: ${[...physicalIfaces].slice(0, 5).join(', ')}${physicalIfaces.size > 5 ? '...' : ''}`
    ));
  }

  // H2: Interface type mismatch
  const modelPrefixes = getModelPortPrefixes(model);
  if (modelPrefixes.size > 0) {
    for (const iface of physicalIfaces) {
      const prefix = iface.match(/^(ge|xe|et|mge)-/)?.[1];
      if (prefix && !modelPrefixes.has(prefix)) {
        findings.push(createWarning(
          'warning',
          `hardware/interface-type/${iface}`,
          `Interface ${iface} uses ${prefix} ports not available on ${targetModel}.`,
          `${targetModel} supports: ${[...modelPrefixes].join(', ')}. Remap this interface in Interface Mapper.`
        ));
      }
    }
  }

  // H3-H5: Capacity limits (policy count, zone count, NAT count, address objects)
  if (limits) {
    const capacityChecks = [
      { metric: 'Security Policies', current: intermediateConfig?.security_policies?.length || 0, limit: limits.max_policies, element: 'hardware/policy-count' },
      { metric: 'Security Zones', current: intermediateConfig?.zones?.length || 0, limit: limits.max_zones, element: 'hardware/zone-count' },
      { metric: 'NAT Rules', current: intermediateConfig?.nat_rules?.length || 0, limit: limits.max_nat_rules, element: 'hardware/nat-count' },
      { metric: 'Address Objects', current: (intermediateConfig?.address_objects?.length || 0) + (intermediateConfig?.address_groups?.length || 0), limit: limits.max_address_objects, element: 'hardware/address-count' },
    ];

    for (const check of capacityChecks) {
      if (check.limit === 0 || check.current === 0) continue;
      const pct = Math.round((check.current / check.limit) * 100);
      if (pct >= 100) {
        findings.push(createWarning(
          'unsupported',
          check.element,
          `${check.metric}: ${check.current.toLocaleString()} exceeds ${targetModel} limit of ${check.limit.toLocaleString()} (${pct}%).`,
          `Reduce ${check.metric.toLowerCase()} count or select a higher-capacity model.`
        ));
      } else if (pct >= 80) {
        findings.push(createWarning(
          'warning',
          check.element,
          `${check.metric}: ${check.current.toLocaleString()} of ${check.limit.toLocaleString()} (${pct}%) — approaching ${targetModel} limit.`,
          `Consider a higher-capacity model if config will grow.`
        ));
      }
    }
  }

  // H6: Throughput advisory
  if (sourceModel?.throughput && model.throughput) {
    const srcTp = parseThroughputMbps(sourceModel.throughput.l4);
    const tgtTp = parseThroughputMbps(model.throughput.l4);
    if (srcTp > 0 && tgtTp > 0 && tgtTp < srcTp) {
      findings.push(createWarning(
        'info',
        'hardware/throughput',
        `Target ${targetModel} L4 throughput (${model.throughput.l4}) is lower than source (${sourceModel.throughput.l4}).`,
        'Verify throughput requirements or select a higher-performance model.'
      ));
    }
  }

  return findings;
}
```

- [ ] **Step 2: Verify the module loads**

Run: `node -e "import('./src/validators/hardware-checks.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/validators/hardware-checks.js
git commit -m "feat(validation): add hardware checks module (H1-H7)"
```

---

### Task 2: Operational Checks Module

**Files:**
- Create: `src/validators/operational-checks.js`
- Reference: `src/parsers/parser-utils.js` (for `createWarning`)

- [ ] **Step 1: Create `operational-checks.js` with the `runOperationalChecks` function**

```js
// src/validators/operational-checks.js
/**
 * Operational validation checks — catches configs that are valid but will cause issues.
 * @module operational-checks
 */

import { createWarning } from '../parsers/parser-utils.js';

/**
 * Regex heuristic for internet-facing zone names (matches Rev17 screen best-practice logic).
 */
const INTERNET_ZONE_PATTERN = /untrust|outside|wan|dmz|internet|external/i;

/**
 * Extracts zone pairs that have at least one security policy defined.
 * @param {string[]} commands - SRX set command lines
 * @returns {Set<string>} set of "fromZone>toZone" strings
 */
function extractPolicyZonePairs(commands) {
  const pairs = new Set();
  const pattern = /^set security policies from-zone (\S+) to-zone (\S+)/;
  for (const cmd of commands) {
    const match = cmd.match(pattern);
    if (match) pairs.add(`${match[1]}>${match[2]}`);
  }
  return pairs;
}

/**
 * Extracts zone names from zone definitions in SRX output.
 * @param {string[]} commands
 * @returns {Set<string>}
 */
function extractDefinedZones(commands) {
  const zones = new Set();
  const pattern = /^set security zones security-zone (\S+)/;
  for (const cmd of commands) {
    const match = cmd.match(pattern);
    if (match) zones.add(match[1]);
  }
  return zones;
}

/**
 * Extracts zone pairs referenced by NAT rules.
 * @param {Object} intermediateConfig
 * @returns {Set<string>} set of "fromZone>toZone" strings
 */
function extractNatZonePairs(intermediateConfig) {
  const pairs = new Set();
  for (const nat of (intermediateConfig.nat_rules || [])) {
    const srcZones = nat.src_zones || nat.from_zone ? [nat.from_zone] : [];
    const dstZones = nat.dst_zones || nat.to_zone ? [nat.to_zone] : [];
    for (const sz of srcZones) {
      for (const dz of dstZones) {
        if (sz && dz) pairs.add(`${sz}>${dz}`);
      }
    }
  }
  return pairs;
}

/**
 * Checks if a zone pair has an explicit deny-all policy as its last rule.
 * @param {string[]} commands
 * @param {string} fromZone
 * @param {string} toZone
 * @returns {boolean}
 */
function hasExplicitDenyAll(commands, fromZone, toZone) {
  const prefix = `set security policies from-zone ${fromZone} to-zone ${toZone} policy `;
  const policyCommands = commands.filter(c => c.startsWith(prefix));
  // Find last policy name
  const policyNames = [];
  for (const cmd of policyCommands) {
    const match = cmd.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\S+)`));
    if (match && !policyNames.includes(match[1])) policyNames.push(match[1]);
  }
  if (policyNames.length === 0) return false;
  const lastPolicy = policyNames[policyNames.length - 1];
  // Check if last policy matches any/any/any + deny
  const lastCmds = policyCommands.filter(c => c.includes(` policy ${lastPolicy} `));
  const hasDeny = lastCmds.some(c => /then (deny|reject)/.test(c));
  const hasAnySrc = lastCmds.some(c => /match source-address any/.test(c));
  const hasAnyDst = lastCmds.some(c => /match destination-address any/.test(c));
  const hasAnyApp = lastCmds.some(c => /match application any/.test(c));
  return hasDeny && hasAnySrc && hasAnyDst && hasAnyApp;
}

/**
 * Runs operational validation checks.
 *
 * @param {Object} intermediateConfig - Parsed intermediate config
 * @param {string[]} commands - Array of SRX set command strings
 * @returns {Object[]} Array of warning objects from createWarning()
 */
export function runOperationalChecks(intermediateConfig, commands) {
  const findings = [];
  const policyZonePairs = extractPolicyZonePairs(commands);
  const definedZones = extractDefinedZones(commands);

  // O1: Missing default-deny
  for (const pair of policyZonePairs) {
    const [fromZone, toZone] = pair.split('>');
    if (!hasExplicitDenyAll(commands, fromZone, toZone)) {
      // Only warn for zone pairs that have permit rules
      const hasPermit = commands.some(c =>
        c.startsWith(`set security policies from-zone ${fromZone} to-zone ${toZone}`) &&
        c.includes('then permit')
      );
      if (hasPermit) {
        findings.push(createWarning(
          'warning',
          `operational/missing-deny/${fromZone}>${toZone}`,
          `Zone pair ${fromZone} → ${toZone} has permit rules but no explicit deny-all at end.`,
          'Add a deny-all policy as the last rule for logging visibility on dropped traffic.'
        ));
      }
    }
  }

  // O2: Zone pairs with no policies
  const zoneArray = [...definedZones].filter(z => z !== 'junos-host');
  for (let i = 0; i < zoneArray.length; i++) {
    for (let j = 0; j < zoneArray.length; j++) {
      if (i === j) continue;
      const pair = `${zoneArray[i]}>${zoneArray[j]}`;
      if (!policyZonePairs.has(pair)) {
        // Only report if the zones seem related (at least one is internet-facing)
        if (INTERNET_ZONE_PATTERN.test(zoneArray[i]) || INTERNET_ZONE_PATTERN.test(zoneArray[j])) {
          findings.push(createWarning(
            'info',
            `operational/no-policy/${pair}`,
            `No policies between ${zoneArray[i]} → ${zoneArray[j]} — traffic is silently dropped.`,
            'Add explicit policies or a deny-all with logging if this zone pair should carry traffic.'
          ));
        }
      }
    }
  }

  // O3: NAT referencing uncovered zone pair
  const natZonePairs = extractNatZonePairs(intermediateConfig);
  for (const pair of natZonePairs) {
    if (!policyZonePairs.has(pair)) {
      const [fromZone, toZone] = pair.split('>');
      findings.push(createWarning(
        'warning',
        `operational/nat-no-policy/${pair}`,
        `NAT rule references zone pair ${fromZone} → ${toZone} but no security policy permits this traffic.`,
        'NAT will never trigger without a matching permit policy. Add a security policy for this zone pair.'
      ));
    }
  }

  // O4: Screen missing on internet-facing zones
  const zonesWithScreen = new Set();
  for (const cmd of commands) {
    const match = cmd.match(/^set security zones security-zone (\S+) screen /);
    if (match) zonesWithScreen.add(match[1]);
  }
  for (const zone of definedZones) {
    if (INTERNET_ZONE_PATTERN.test(zone) && !zonesWithScreen.has(zone)) {
      findings.push(createWarning(
        'warning',
        `operational/no-screen/${zone}`,
        `Internet-facing zone "${zone}" has no screen profile bound.`,
        'Apply a screen profile to protect against SYN floods, port scans, and other DoS attacks.'
      ));
    }
  }

  // O5: Permit rules without logging
  const policyPattern = /^set security policies from-zone \S+ to-zone \S+ policy (\S+) then (permit|log)/;
  const permitPolicies = new Set();
  const loggedPolicies = new Set();
  const countPolicies = new Set();
  for (const cmd of commands) {
    const permitMatch = cmd.match(/^set security policies from-zone \S+ to-zone \S+ policy (\S+) then permit/);
    if (permitMatch) permitPolicies.add(permitMatch[1]);
    const logMatch = cmd.match(/^set security policies from-zone \S+ to-zone \S+ policy (\S+) then log /);
    if (logMatch) loggedPolicies.add(logMatch[1]);
    const countMatch = cmd.match(/^set security policies from-zone \S+ to-zone \S+ policy (\S+) then count/);
    if (countMatch) countPolicies.add(countMatch[1]);
  }
  for (const policy of permitPolicies) {
    if (!loggedPolicies.has(policy)) {
      findings.push(createWarning(
        'warning',
        `operational/no-logging/${policy}`,
        `Permit policy "${policy}" has no session logging enabled.`,
        'Add "then log session-close" for traffic visibility and audit compliance.'
      ));
    }
  }

  // O6: Duplicate address objects (same value, different names)
  const addrByValue = {};
  for (const obj of (intermediateConfig.address_objects || [])) {
    const key = `${obj.type || ''}:${obj.value || ''}`;
    if (!addrByValue[key]) addrByValue[key] = [];
    addrByValue[key].push(obj.name);
  }
  for (const [key, names] of Object.entries(addrByValue)) {
    if (names.length > 1) {
      findings.push(createWarning(
        'info',
        `operational/duplicate-address/${names[0]}`,
        `Address objects [${names.join(', ')}] resolve to the same value (${key.split(':')[1]}).`,
        'Consider consolidating into a single object to reduce config complexity.'
      ));
    }
  }

  // O7: BGP/OSPF without export policy
  const hasBgp = commands.some(c => c.startsWith('set protocols bgp'));
  const hasOspf = commands.some(c => c.startsWith('set protocols ospf'));
  const hasPolicyStatement = commands.some(c => c.startsWith('set policy-options policy-statement'));
  if ((hasBgp || hasOspf) && !hasPolicyStatement) {
    findings.push(createWarning(
      'warning',
      'operational/routing-no-export',
      `${hasBgp ? 'BGP' : ''}${hasBgp && hasOspf ? ' and ' : ''}${hasOspf ? 'OSPF' : ''} configured but no export policy-statement defined.`,
      'Routes will not be advertised without a policy-statement. Add "set policy-options policy-statement" with appropriate terms.'
    ));
  }

  // O8: VPN tunnel with no matching policy
  const vpnNames = new Set();
  for (const cmd of commands) {
    const match = cmd.match(/^set security ipsec vpn (\S+)/);
    if (match) vpnNames.add(match[1]);
  }
  if (vpnNames.size > 0) {
    const vpnInPolicy = new Set();
    for (const cmd of commands) {
      const match = cmd.match(/then permit tunnel ipsec-vpn (\S+)/);
      if (match) vpnInPolicy.add(match[1]);
    }
    for (const vpn of vpnNames) {
      if (!vpnInPolicy.has(vpn)) {
        findings.push(createWarning(
          'warning',
          `operational/vpn-no-policy/${vpn}`,
          `IPsec VPN "${vpn}" is configured but no security policy references it.`,
          'Add a policy with "then permit tunnel ipsec-vpn ' + vpn + '" to allow VPN traffic.'
        ));
      }
    }
  }

  // O9: Overlapping NAT rules (same type + same zone pair criteria)
  const natSignatures = {};
  for (const nat of (intermediateConfig.nat_rules || [])) {
    const srcZone = nat.src_zones?.[0] || nat.from_zone || 'any';
    const dstZone = nat.dst_zones?.[0] || nat.to_zone || 'any';
    const natType = nat.type || 'source';
    const srcAddr = (nat.src_addresses || []).sort().join(',') || 'any';
    const dstAddr = (nat.dst_addresses || []).sort().join(',') || 'any';
    const sig = `${natType}:${srcZone}>${dstZone}:${srcAddr}:${dstAddr}`;
    if (!natSignatures[sig]) natSignatures[sig] = [];
    natSignatures[sig].push(nat.name || `rule-${natSignatures[sig].length}`);
  }
  for (const [sig, names] of Object.entries(natSignatures)) {
    if (names.length > 1) {
      findings.push(createWarning(
        'warning',
        `operational/overlapping-nat/${names[0]}`,
        `NAT rules [${names.join(', ')}] have identical match criteria — only the first will match.`,
        'Remove or differentiate the duplicate NAT rules.'
      ));
    }
  }

  return findings;
}
```

- [ ] **Step 2: Verify the module loads**

Run: `node -e "import('./src/validators/operational-checks.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/validators/operational-checks.js
git commit -m "feat(validation): add operational checks module (O1-O9)"
```

---

### Task 3: Compliance Checks Module

**Files:**
- Create: `src/validators/compliance-checks.js`
- Reference: `src/parsers/parser-utils.js` (for `createWarning`)

- [ ] **Step 1: Create `compliance-checks.js` with the `runComplianceChecks` function**

```js
// src/validators/compliance-checks.js
/**
 * Compliance/hardening validation checks — STIG and best-practice baseline.
 * Scans SRX set commands for presence/absence of hardening configuration.
 * @module compliance-checks
 */

import { createWarning } from '../parsers/parser-utils.js';

/**
 * Helper: checks if any command in the array matches the given pattern.
 * @param {string[]} commands
 * @param {RegExp|string} pattern - regex or string prefix to match
 * @returns {boolean}
 */
function hasCommand(commands, pattern) {
  if (typeof pattern === 'string') {
    return commands.some(c => c.startsWith(pattern));
  }
  return commands.some(c => pattern.test(c));
}

/**
 * Runs compliance/hardening checks against the SRX output.
 *
 * @param {string[]} commands - Array of SRX set command strings
 * @returns {Object[]} Array of warning objects from createWarning()
 */
export function runComplianceChecks(commands) {
  const findings = [];

  // C1: No NTP configured
  if (!hasCommand(commands, 'set system ntp server')) {
    findings.push(createWarning(
      'warning',
      'compliance/no-ntp',
      'No NTP server configured — clock drift will break log correlation and certificate validation.',
      'Add "set system ntp server <ip>" with at least two NTP sources.'
    ));
  }

  // C2: No DNS configured
  if (!hasCommand(commands, 'set system name-server')) {
    findings.push(createWarning(
      'info',
      'compliance/no-dns',
      'No DNS name-server configured — URL filtering and ATP Cloud will not resolve hostnames.',
      'Add "set system name-server <ip>" for name resolution services.'
    ));
  }

  // C3: No syslog configured
  if (!hasCommand(commands, 'set system syslog host')) {
    findings.push(createWarning(
      'warning',
      'compliance/no-syslog',
      'No external syslog host configured — no off-box log retention for forensics.',
      'Add "set system syslog host <ip>" with appropriate facility and severity levels.'
    ));
  }

  // C4: SNMP community is public/private
  if (hasCommand(commands, /^set snmp community (public|private)\b/)) {
    findings.push(createWarning(
      'warning',
      'compliance/default-snmp',
      'SNMP uses default community string "public" or "private" — known attack vector.',
      'Change to a unique community string or migrate to SNMPv3 with authentication.'
    ));
  }

  // C5: No login banner
  if (!hasCommand(commands, 'set system login message')) {
    findings.push(createWarning(
      'info',
      'compliance/no-banner',
      'No login banner configured — required for legal/compliance unauthorized access warnings.',
      'Add "set system login message" with an authorized-use-only warning.'
    ));
  }

  // C6: No console/aux timeout
  if (!hasCommand(commands, 'set system ports console')) {
    findings.push(createWarning(
      'info',
      'compliance/no-console-timeout',
      'No console port timeout configured — unattended console sessions remain open indefinitely.',
      'Add "set system ports console log-out-on-disconnect" and "set system ports console timeout <minutes>".'
    ));
  }

  // C7: Telnet enabled
  if (hasCommand(commands, 'set system services telnet')) {
    findings.push(createWarning(
      'warning',
      'compliance/telnet-enabled',
      'Telnet is enabled — plaintext management protocol exposes credentials on the wire.',
      'Remove "set system services telnet" and use SSH exclusively.'
    ));
  }

  // C8: No SSH configured
  if (!hasCommand(commands, 'set system services ssh')) {
    findings.push(createWarning(
      'info',
      'compliance/no-ssh',
      'No SSH service configured — no secure remote management access.',
      'Add "set system services ssh" for encrypted remote management.'
    ));
  }

  // C9: Weak password policy
  const hasUsers = hasCommand(commands, 'set system login user');
  const hasMinLength = hasCommand(commands, 'set system login password minimum-length');
  if (hasUsers && !hasMinLength) {
    findings.push(createWarning(
      'info',
      'compliance/no-password-policy',
      'Local users exist but no password minimum-length is set — no password complexity enforcement.',
      'Add "set system login password minimum-length 12" (or per your organization\'s policy).'
    ));
  }

  // C10: No login retry/lockout
  if (hasUsers && !hasCommand(commands, 'set system login retry-options')) {
    findings.push(createWarning(
      'info',
      'compliance/no-lockout',
      'No login retry/lockout configured — no brute-force protection on management access.',
      'Add "set system login retry-options tries-before-disconnect 3 backoff-threshold 1 backoff-factor 6".'
    ));
  }

  // C11: HTTP management enabled (not HTTPS)
  if (hasCommand(commands, /^set system services web-management http\b/) &&
      !hasCommand(commands, /^set system services web-management https\b/)) {
    findings.push(createWarning(
      'warning',
      'compliance/http-management',
      'HTTP web management is enabled without HTTPS — plaintext admin interface.',
      'Replace with "set system services web-management https" and disable HTTP.'
    ));
  }

  // C12: No root authentication
  if (!hasCommand(commands, 'set system root-authentication')) {
    findings.push(createWarning(
      'warning',
      'compliance/no-root-auth',
      'No root-authentication configured — device may use default credentials or be inaccessible.',
      'Add "set system root-authentication encrypted-password" with a strong password hash.'
    ));
  }

  return findings;
}
```

- [ ] **Step 2: Verify the module loads**

Run: `node -e "import('./src/validators/compliance-checks.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/validators/compliance-checks.js
git commit -m "feat(validation): add compliance checks module (C1-C12)"
```

---

### Task 4: Validation Engine Orchestrator

**Files:**
- Create: `src/validators/srx-validation-engine.js`
- Reference: `public/utils/srx-view-transforms.js` (for `SRX_LICENSE_TIERS`, `licenseTierCovers`)

- [ ] **Step 1: Create `srx-validation-engine.js`**

```js
// src/validators/srx-validation-engine.js
/**
 * SRX Validation Engine — orchestrates hardware, operational, and compliance checks
 * plus license gating on the generated SRX output.
 * @module srx-validation-engine
 */

import { createWarning } from '../parsers/parser-utils.js';
import { runHardwareChecks } from './hardware-checks.js';
import { runOperationalChecks } from './operational-checks.js';
import { runComplianceChecks } from './compliance-checks.js';

/**
 * Maps SRX command patterns to the minimum license tier required.
 * Used for license gating checks.
 */
const LICENSE_FEATURE_PATTERNS = [
  { pattern: /^set services idp\b/, tier: 'A1', label: 'IDP (Intrusion Detection & Prevention)' },
  { pattern: /^set services application-identification\b/, tier: 'A1', label: 'Application Identification (AppSecure)' },
  { pattern: /^set security policies .+ match application (?!any\b)\S+/, tier: 'A1', label: 'Application-based policy matching' },
  { pattern: /^set services security-intelligence\b/, tier: 'A1', label: 'Security Intelligence (SecIntel)' },
  { pattern: /^set security (utm|services content-security)\b/, tier: 'A2', label: 'UTM / Content Security' },
  { pattern: /^set services advanced-anti-malware\b/, tier: 'P1', label: 'Advanced Anti-Malware (ATP Cloud)' },
  { pattern: /application-services .+atp\b/, tier: 'P1', label: 'ATP Cloud policy attachment' },
];

/**
 * License tier hierarchy for comparison.
 * Higher index = more features included.
 */
const TIER_ORDER = ['Base', 'A1', 'A2', 'P1', 'P2'];

/**
 * Checks if the held license tier covers the required tier.
 * @param {string} haveTier
 * @param {string} needTier
 * @returns {boolean}
 */
function tierCovers(haveTier, needTier) {
  // P1 doesn't cover A2 (different branch), P2 covers everything
  if (haveTier === 'P2') return true;
  if (haveTier === 'P1') return ['Base', 'A1', 'P1'].includes(needTier);
  if (haveTier === 'A2') return ['Base', 'A1', 'A2'].includes(needTier);
  if (haveTier === 'A1') return ['Base', 'A1'].includes(needTier);
  if (haveTier === 'Base') return needTier === 'Base';
  return false;
}

/**
 * Runs license gating checks and optionally strips gated commands.
 *
 * @param {string[]} commands - SRX set command lines
 * @param {string|null} srxLicense - Selected license tier (e.g., 'A1', 'P2')
 * @param {boolean} enforce - If true, strip gated commands from output
 * @returns {{ findings: Object[], strippedCommands: string[], filteredCommands: string[] }}
 */
function runLicenseChecks(commands, srxLicense, enforce) {
  const findings = [];
  const strippedCommands = [];

  if (!srxLicense) {
    findings.push(createWarning(
      'info',
      'license/no-tier',
      'No license tier selected — license validation skipped.',
      'Select a license tier in Model Selector for license validation.'
    ));
    return { findings, strippedCommands, filteredCommands: commands };
  }

  // Detect which licensed features are used
  const detectedFeatures = new Map(); // tier -> Set<label>
  const gatedCommandIndices = new Set();

  for (let i = 0; i < commands.length; i++) {
    for (const feat of LICENSE_FEATURE_PATTERNS) {
      if (feat.pattern.test(commands[i]) && !tierCovers(srxLicense, feat.tier)) {
        if (!detectedFeatures.has(feat.tier)) detectedFeatures.set(feat.tier, new Set());
        detectedFeatures.get(feat.tier).add(feat.label);
        gatedCommandIndices.add(i);
      }
    }
  }

  // Emit findings per feature gap
  for (const [tier, labels] of detectedFeatures) {
    for (const label of labels) {
      findings.push(createWarning(
        enforce ? 'unsupported' : 'warning',
        `license/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        `${label} requires ${tier} license — current license is ${srxLicense}.${enforce ? ' Commands removed from output.' : ''}`,
        enforce
          ? `Upgrade to ${tier} or higher to re-enable these commands.`
          : `Upgrade to ${tier} or higher, or enable "Enforce license gating" to strip these commands.`
      ));
    }
  }

  // Build filtered commands list
  const filteredCommands = enforce
    ? commands.filter((_, i) => {
        if (gatedCommandIndices.has(i)) {
          strippedCommands.push(commands[i]);
          return false;
        }
        return true;
      })
    : commands;

  return { findings, strippedCommands, filteredCommands };
}

/**
 * Main entry point: runs all validation checks on the SRX output.
 *
 * @param {Object} params
 * @param {Object} params.intermediateConfig - Parsed intermediate config
 * @param {string} params.srxOutput - Raw SRX output string (set commands, newline-separated)
 * @param {string|null} params.targetModel - Target SRX model name
 * @param {string|null} params.srxLicense - Selected license tier
 * @param {boolean} [params.enforceLicense=false] - Strip license-gated commands if true
 * @param {Object} params.modelDb - SRX_MODELS from hardware-db.js
 * @param {Object} params.capacityLimits - SRX_CAPACITY_LIMITS from hardware-db.js
 * @param {Object|null} [params.sourceModel] - Source model entry for throughput comparison
 * @returns {{ findings: Object[], strippedCommands: string[], filteredOutput: string|null }}
 */
export function runValidation({
  intermediateConfig,
  srxOutput,
  targetModel,
  srxLicense,
  enforceLicense = false,
  modelDb,
  capacityLimits,
  sourceModel = null,
}) {
  const commands = (srxOutput || '').split('\n').filter(line => line.trim().length > 0);
  const allFindings = [];

  // Tag all findings with _source for filtering in WarningsPanel
  const tag = (findings) => findings.map(f => ({ ...f, _source: 'validation' }));

  // Tier 1: Hardware
  allFindings.push(...tag(runHardwareChecks(commands, targetModel, modelDb, capacityLimits, intermediateConfig, sourceModel)));

  // Tier 2: Operational
  allFindings.push(...tag(runOperationalChecks(intermediateConfig, commands)));

  // Tier 3: Compliance
  allFindings.push(...tag(runComplianceChecks(commands)));

  // License gating (runs last — may modify commands)
  const licenseResult = runLicenseChecks(commands, srxLicense, enforceLicense);
  allFindings.push(...tag(licenseResult.findings));

  // If license enforcement stripped commands, reassemble the output
  const filteredOutput = enforceLicense && licenseResult.strippedCommands.length > 0
    ? licenseResult.filteredCommands.join('\n')
    : null;

  return {
    findings: allFindings,
    strippedCommands: licenseResult.strippedCommands,
    filteredOutput,
  };
}
```

- [ ] **Step 2: Verify the module loads**

Run: `node -e "import('./src/validators/srx-validation-engine.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/validators/srx-validation-engine.js
git commit -m "feat(validation): add validation engine orchestrator with license gating"
```

---

### Task 5: Tests for All Validation Modules

**Files:**
- Create: `tests/validation-engine.test.js`
- Reference: `tests/llm-translate.test.js` (existing test pattern — standalone Node.js, manual assertions)

- [ ] **Step 1: Create `validation-engine.test.js`**

```js
// tests/validation-engine.test.js
/**
 * Tests for Config Validation v2 — hardware, operational, compliance, and license checks.
 *
 * Run: node tests/validation-engine.test.js
 */

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------
const _store = {};
global.localStorage = {
  getItem: (k) => _store[k] || null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: (k) => { delete _store[k]; },
};

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { runHardwareChecks } from '../src/validators/hardware-checks.js';
import { runOperationalChecks } from '../src/validators/operational-checks.js';
import { runComplianceChecks } from '../src/validators/compliance-checks.js';
import { runValidation } from '../src/validators/srx-validation-engine.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let currentTest = '';

function assert(condition, msg) {
  const label = currentTest ? `${currentTest}: ${msg}` : msg;
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function test(name, fn) {
  currentTest = name;
  try {
    fn();
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name} — threw: ${err.message}`);
  }
  currentTest = '';
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MOCK_MODEL_DB = {
  'SRX300': {
    name: 'SRX300',
    tier: 'branch',
    throughput: { l4: '500 Mbps', l7: 'N/A', threat: '200 Mbps' },
    ports: [
      { name: 'ge-0/0/0', type: 'copper', speed: '1G' },
      { name: 'ge-0/0/1', type: 'copper', speed: '1G' },
      { name: 'ge-0/0/2', type: 'copper', speed: '1G' },
      { name: 'ge-0/0/3', type: 'copper', speed: '1G' },
    ],
  },
  'SRX4100': {
    name: 'SRX4100',
    tier: 'datacenter',
    throughput: { l4: '20 Gbps', l7: '10 Gbps', threat: '13.9 Gbps' },
    ports: [
      { name: 'ge-0/0/0', type: 'copper', speed: '1G' },
      { name: 'ge-0/0/1', type: 'copper', speed: '1G' },
      { name: 'xe-0/0/0', type: 'SFP+', speed: '10G' },
      { name: 'xe-0/0/1', type: 'SFP+', speed: '10G' },
    ],
  },
};

const MOCK_CAPACITY = {
  'SRX300': { max_policies: 1024, max_sessions: 64000, max_zones: 16, max_nat_rules: 1024, max_address_objects: 2048 },
  'SRX4100': { max_policies: 65536, max_sessions: 10000000, max_zones: 512, max_nat_rules: 32768, max_address_objects: 131072 },
};

function makeConfig(overrides = {}) {
  return {
    zones: [{ name: 'trust' }, { name: 'untrust' }],
    interfaces: [{ name: 'ge-0/0/0', ip: '10.0.0.1/24', zone: 'trust' }],
    address_objects: [{ name: 'web-srv', type: 'host', value: '10.0.1.10' }],
    address_groups: [],
    service_objects: [],
    service_groups: [],
    security_policies: [{ name: 'allow-web', action: 'allow', src_zones: ['trust'], dst_zones: ['untrust'] }],
    nat_rules: [],
    static_routes: [],
    ...overrides,
  };
}

function makeCommands(lines) {
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Hardware Checks Tests
// ---------------------------------------------------------------------------
console.log('\n=== Hardware Checks ===');

test('H7: no model selected returns info finding', () => {
  const findings = runHardwareChecks([], null, MOCK_MODEL_DB, MOCK_CAPACITY, makeConfig(), null);
  assert(findings.length === 1, 'should have 1 finding');
  assert(findings[0].severity === 'info', 'should be info severity');
  assert(findings[0].element === 'hardware/no-model', 'should be no-model element');
});

test('H1: interface count exceeds model ports', () => {
  const cmds = [
    'set interfaces ge-0/0/0 unit 0 family inet address 10.0.0.1/24',
    'set interfaces ge-0/0/1 unit 0 family inet address 10.0.0.2/24',
    'set interfaces ge-0/0/2 unit 0 family inet address 10.0.0.3/24',
    'set interfaces ge-0/0/3 unit 0 family inet address 10.0.0.4/24',
    'set interfaces ge-0/0/4 unit 0 family inet address 10.0.0.5/24',
  ];
  const findings = runHardwareChecks(cmds, 'SRX300', MOCK_MODEL_DB, MOCK_CAPACITY, makeConfig(), null);
  const ifaceCheck = findings.find(f => f.element === 'hardware/interface-count');
  assert(ifaceCheck !== undefined, 'should flag interface count');
  assert(ifaceCheck.severity === 'unsupported', 'should be unsupported');
});

test('H1: interface count within limits passes', () => {
  const cmds = [
    'set interfaces ge-0/0/0 unit 0 family inet address 10.0.0.1/24',
    'set interfaces ge-0/0/1 unit 0 family inet address 10.0.0.2/24',
  ];
  const findings = runHardwareChecks(cmds, 'SRX300', MOCK_MODEL_DB, MOCK_CAPACITY, makeConfig(), null);
  const ifaceCheck = findings.find(f => f.element === 'hardware/interface-count');
  assert(ifaceCheck === undefined, 'should not flag interface count');
});

test('H2: interface type mismatch flags xe on ge-only model', () => {
  const cmds = ['set interfaces xe-0/0/0 unit 0 family inet address 10.0.0.1/24'];
  const findings = runHardwareChecks(cmds, 'SRX300', MOCK_MODEL_DB, MOCK_CAPACITY, makeConfig(), null);
  const typeCheck = findings.find(f => f.element.startsWith('hardware/interface-type/'));
  assert(typeCheck !== undefined, 'should flag xe on SRX300');
  assert(typeCheck.severity === 'warning', 'should be warning');
});

test('H3: policy count over capacity', () => {
  const policies = Array.from({ length: 1100 }, (_, i) => ({ name: `p${i}`, action: 'allow' }));
  const config = makeConfig({ security_policies: policies });
  const findings = runHardwareChecks([], 'SRX300', MOCK_MODEL_DB, MOCK_CAPACITY, config, null);
  const policyCheck = findings.find(f => f.element === 'hardware/policy-count');
  assert(policyCheck !== undefined, 'should flag policy count');
  assert(policyCheck.severity === 'unsupported', 'should be unsupported when over 100%');
});

test('H6: throughput advisory when target < source', () => {
  const sourceModel = { throughput: { l4: '12 Gbps' } };
  const findings = runHardwareChecks([], 'SRX300', MOCK_MODEL_DB, MOCK_CAPACITY, makeConfig(), sourceModel);
  const tpCheck = findings.find(f => f.element === 'hardware/throughput');
  assert(tpCheck !== undefined, 'should flag throughput');
  assert(tpCheck.severity === 'info', 'should be info');
});

// ---------------------------------------------------------------------------
// Operational Checks Tests
// ---------------------------------------------------------------------------
console.log('\n=== Operational Checks ===');

test('O1: missing default-deny is flagged', () => {
  const cmds = [
    'set security zones security-zone trust',
    'set security zones security-zone untrust',
    'set security policies from-zone trust to-zone untrust policy allow-web match source-address any',
    'set security policies from-zone trust to-zone untrust policy allow-web match destination-address any',
    'set security policies from-zone trust to-zone untrust policy allow-web match application any',
    'set security policies from-zone trust to-zone untrust policy allow-web then permit',
  ];
  const findings = runOperationalChecks(makeConfig(), cmds);
  const denyCheck = findings.find(f => f.element.startsWith('operational/missing-deny/'));
  assert(denyCheck !== undefined, 'should flag missing deny-all');
});

test('O1: explicit deny-all passes', () => {
  const cmds = [
    'set security zones security-zone trust',
    'set security zones security-zone untrust',
    'set security policies from-zone trust to-zone untrust policy allow-web then permit',
    'set security policies from-zone trust to-zone untrust policy deny-all match source-address any',
    'set security policies from-zone trust to-zone untrust policy deny-all match destination-address any',
    'set security policies from-zone trust to-zone untrust policy deny-all match application any',
    'set security policies from-zone trust to-zone untrust policy deny-all then deny',
  ];
  const findings = runOperationalChecks(makeConfig(), cmds);
  const denyCheck = findings.find(f => f.element.startsWith('operational/missing-deny/'));
  assert(denyCheck === undefined, 'should not flag when deny-all exists');
});

test('O4: internet-facing zone without screen flagged', () => {
  const cmds = [
    'set security zones security-zone untrust',
    'set security zones security-zone trust',
  ];
  const findings = runOperationalChecks(makeConfig(), cmds);
  const screenCheck = findings.find(f => f.element === 'operational/no-screen/untrust');
  assert(screenCheck !== undefined, 'should flag untrust without screen');
});

test('O4: screen bound passes', () => {
  const cmds = [
    'set security zones security-zone untrust',
    'set security zones security-zone untrust screen untrust-screen',
  ];
  const findings = runOperationalChecks(makeConfig(), cmds);
  const screenCheck = findings.find(f => f.element === 'operational/no-screen/untrust');
  assert(screenCheck === undefined, 'should not flag when screen is bound');
});

test('O5: permit without logging flagged', () => {
  const cmds = [
    'set security policies from-zone trust to-zone untrust policy p1 then permit',
  ];
  const findings = runOperationalChecks(makeConfig(), cmds);
  const logCheck = findings.find(f => f.element === 'operational/no-logging/p1');
  assert(logCheck !== undefined, 'should flag missing logging');
});

test('O5: permit with logging passes', () => {
  const cmds = [
    'set security policies from-zone trust to-zone untrust policy p1 then permit',
    'set security policies from-zone trust to-zone untrust policy p1 then log session-close',
  ];
  const findings = runOperationalChecks(makeConfig(), cmds);
  const logCheck = findings.find(f => f.element === 'operational/no-logging/p1');
  assert(logCheck === undefined, 'should not flag when logging exists');
});

test('O6: duplicate address objects flagged', () => {
  const config = makeConfig({
    address_objects: [
      { name: 'web1', type: 'host', value: '10.0.1.10' },
      { name: 'web-server', type: 'host', value: '10.0.1.10' },
    ],
  });
  const findings = runOperationalChecks(config, []);
  const dupCheck = findings.find(f => f.element.startsWith('operational/duplicate-address/'));
  assert(dupCheck !== undefined, 'should flag duplicate addresses');
});

test('O7: BGP without export policy flagged', () => {
  const cmds = [
    'set protocols bgp group external type external',
    'set protocols bgp group external neighbor 10.0.0.1',
  ];
  const findings = runOperationalChecks(makeConfig(), cmds);
  const routeCheck = findings.find(f => f.element === 'operational/routing-no-export');
  assert(routeCheck !== undefined, 'should flag BGP without policy-statement');
});

test('O8: VPN without matching policy flagged', () => {
  const cmds = [
    'set security ipsec vpn site-a-vpn',
    'set security ipsec vpn site-a-vpn ike gateway gw-a',
  ];
  const findings = runOperationalChecks(makeConfig(), cmds);
  const vpnCheck = findings.find(f => f.element === 'operational/vpn-no-policy/site-a-vpn');
  assert(vpnCheck !== undefined, 'should flag VPN without policy');
});

test('O9: overlapping NAT rules flagged', () => {
  const config = makeConfig({
    nat_rules: [
      { name: 'nat1', type: 'source', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['any'], dst_addresses: ['any'] },
      { name: 'nat2', type: 'source', src_zones: ['trust'], dst_zones: ['untrust'], src_addresses: ['any'], dst_addresses: ['any'] },
    ],
  });
  const findings = runOperationalChecks(config, []);
  const natCheck = findings.find(f => f.element.startsWith('operational/overlapping-nat/'));
  assert(natCheck !== undefined, 'should flag overlapping NAT');
});

// ---------------------------------------------------------------------------
// Compliance Checks Tests
// ---------------------------------------------------------------------------
console.log('\n=== Compliance Checks ===');

test('C1-C3: missing NTP, DNS, syslog flagged on empty config', () => {
  const findings = runComplianceChecks([]);
  assert(findings.some(f => f.element === 'compliance/no-ntp'), 'should flag no NTP');
  assert(findings.some(f => f.element === 'compliance/no-dns'), 'should flag no DNS');
  assert(findings.some(f => f.element === 'compliance/no-syslog'), 'should flag no syslog');
});

test('C1: NTP configured passes', () => {
  const cmds = ['set system ntp server 10.0.0.1'];
  const findings = runComplianceChecks(cmds);
  assert(!findings.some(f => f.element === 'compliance/no-ntp'), 'should not flag NTP');
});

test('C4: default SNMP community flagged', () => {
  const cmds = ['set snmp community public authorization read-only'];
  const findings = runComplianceChecks(cmds);
  assert(findings.some(f => f.element === 'compliance/default-snmp'), 'should flag default SNMP');
});

test('C4: custom SNMP community passes', () => {
  const cmds = ['set snmp community s3cr3t-str1ng authorization read-only'];
  const findings = runComplianceChecks(cmds);
  assert(!findings.some(f => f.element === 'compliance/default-snmp'), 'should not flag custom SNMP');
});

test('C7: telnet flagged', () => {
  const cmds = ['set system services telnet'];
  const findings = runComplianceChecks(cmds);
  assert(findings.some(f => f.element === 'compliance/telnet-enabled'), 'should flag telnet');
});

test('C9: users without password policy flagged', () => {
  const cmds = ['set system login user admin class super-user'];
  const findings = runComplianceChecks(cmds);
  assert(findings.some(f => f.element === 'compliance/no-password-policy'), 'should flag no password policy');
});

test('C9: users with password policy passes', () => {
  const cmds = [
    'set system login user admin class super-user',
    'set system login password minimum-length 12',
  ];
  const findings = runComplianceChecks(cmds);
  assert(!findings.some(f => f.element === 'compliance/no-password-policy'), 'should not flag with min-length');
});

test('C11: HTTP without HTTPS flagged', () => {
  const cmds = ['set system services web-management http'];
  const findings = runComplianceChecks(cmds);
  assert(findings.some(f => f.element === 'compliance/http-management'), 'should flag HTTP mgmt');
});

test('C12: no root-auth flagged', () => {
  const findings = runComplianceChecks([]);
  assert(findings.some(f => f.element === 'compliance/no-root-auth'), 'should flag no root-auth');
});

// ---------------------------------------------------------------------------
// Validation Engine Tests
// ---------------------------------------------------------------------------
console.log('\n=== Validation Engine ===');

test('runValidation tags all findings with _source', () => {
  const result = runValidation({
    intermediateConfig: makeConfig(),
    srxOutput: 'set security zones security-zone untrust',
    targetModel: null,
    srxLicense: null,
    modelDb: MOCK_MODEL_DB,
    capacityLimits: MOCK_CAPACITY,
  });
  assert(result.findings.length > 0, 'should have findings');
  assert(result.findings.every(f => f._source === 'validation'), 'all findings should have _source=validation');
});

test('License: no tier emits info', () => {
  const result = runValidation({
    intermediateConfig: makeConfig(),
    srxOutput: '',
    targetModel: null,
    srxLicense: null,
    modelDb: MOCK_MODEL_DB,
    capacityLimits: MOCK_CAPACITY,
  });
  const licenseInfo = result.findings.find(f => f.element === 'license/no-tier');
  assert(licenseInfo !== undefined, 'should have no-tier info');
});

test('License: warn-only mode keeps commands', () => {
  const cmds = [
    'set services idp idp-policy recommended',
    'set security zones security-zone trust',
  ];
  const result = runValidation({
    intermediateConfig: makeConfig(),
    srxOutput: cmds.join('\n'),
    targetModel: null,
    srxLicense: 'Base',
    enforceLicense: false,
    modelDb: MOCK_MODEL_DB,
    capacityLimits: MOCK_CAPACITY,
  });
  const idpWarning = result.findings.find(f => f.element.includes('idp'));
  assert(idpWarning !== undefined, 'should warn about IDP');
  assert(idpWarning.severity === 'warning', 'should be warning in warn-only mode');
  assert(result.filteredOutput === null, 'should not filter output');
  assert(result.strippedCommands.length === 0, 'should not strip commands');
});

test('License: enforce mode strips gated commands', () => {
  const cmds = [
    'set services idp idp-policy recommended',
    'set security zones security-zone trust',
  ];
  const result = runValidation({
    intermediateConfig: makeConfig(),
    srxOutput: cmds.join('\n'),
    targetModel: null,
    srxLicense: 'Base',
    enforceLicense: true,
    modelDb: MOCK_MODEL_DB,
    capacityLimits: MOCK_CAPACITY,
  });
  const idpWarning = result.findings.find(f => f.element.includes('idp'));
  assert(idpWarning !== undefined, 'should warn about IDP');
  assert(idpWarning.severity === 'unsupported', 'should be unsupported in enforce mode');
  assert(result.strippedCommands.length === 1, 'should strip 1 command');
  assert(result.strippedCommands[0].includes('idp'), 'stripped command should be IDP');
  assert(result.filteredOutput !== null, 'should have filtered output');
  assert(!result.filteredOutput.includes('idp'), 'filtered output should not contain IDP');
});

test('License: P2 covers everything', () => {
  const cmds = [
    'set services idp idp-policy recommended',
    'set security utm feature-profile web-filtering type enhanced',
    'set services advanced-anti-malware policy atp-policy',
  ];
  const result = runValidation({
    intermediateConfig: makeConfig(),
    srxOutput: cmds.join('\n'),
    targetModel: null,
    srxLicense: 'P2',
    enforceLicense: true,
    modelDb: MOCK_MODEL_DB,
    capacityLimits: MOCK_CAPACITY,
  });
  const licenseFindings = result.findings.filter(f => f.element.startsWith('license/') && f.element !== 'license/no-tier');
  assert(licenseFindings.length === 0, 'P2 should have no license gaps');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('All tests passed!');
process.exit(0);
```

- [ ] **Step 2: Run the tests**

Run: `node tests/validation-engine.test.js`

Expected: All tests pass with 0 failures.

- [ ] **Step 3: Fix any failures and re-run until all pass**

- [ ] **Step 4: Commit**

```bash
git add tests/validation-engine.test.js
git commit -m "test(validation): add tests for hardware, operational, compliance, and license checks"
```

---

### Task 6: Add `handleValidate` to `useConversion` Hook

**Files:**
- Modify: `public/hooks/useConversion.js`
- Reference: `public/contexts/ConversionContext.jsx` (for dispatch actions)
- Reference: `public/hooks/useConfig.js:297-316` (for `handleRunAnalysis` pattern — lazy import, loading state, error handling)

- [ ] **Step 1: Add `validationFindings` to ConversionContext initial state**

In `public/contexts/ConversionContext.jsx`, add `validationFindings: []` to initial state and handle it in `SET_CONVERSION_RESULT` and `CLEAR_OUTPUT`:

```js
// In initialState (line 12), add:
validationFindings: [],

// In SET_CONVERSION_RESULT case (line 30), add:
validationFindings: action.validationFindings ?? state.validationFindings,

// In CLEAR_OUTPUT case (line 40), add:
validationFindings: [],
```

- [ ] **Step 2: Add `handleValidate` to `useConversion.js`**

Add the following after the `handleConvert` callback (around line 98) in `public/hooks/useConversion.js`:

```js
  // -----------------------------------------------------------------------
  // handleValidate — on-demand post-conversion validation
  // -----------------------------------------------------------------------
  const handleValidate = useCallback(async (enforceLicense = false) => {
    const { srxOutput } = conversionState;
    if (!srxOutput) return;

    uiDispatch({ type: 'SET_LOADING', isLoading: true, message: 'Running validation checks...' });

    try {
      const [
        { runValidation },
        { SRX_MODELS, SRX_CAPACITY_LIMITS },
      ] = await Promise.all([
        import('../../src/validators/srx-validation-engine.js'),
        import('../data/hardware-db.js'),
      ]);

      const result = runValidation({
        intermediateConfig,
        srxOutput,
        targetModel,
        srxLicense,
        enforceLicense,
        modelDb: SRX_MODELS,
        capacityLimits: SRX_CAPACITY_LIMITS,
        sourceModel: null, // TODO: wire sourceModel from ConfigContext if available
      });

      // Replace previous validation warnings (keep non-validation warnings intact)
      const existingNonValidation = (conversionState.convertWarnings || []).filter(w => w._source !== 'validation');
      const newWarnings = [...existingNonValidation, ...result.findings];

      // If license enforcement stripped commands, update the output
      if (result.filteredOutput !== null) {
        conversionDispatch({
          type: 'SET_CONVERSION_RESULT',
          output: { ...conversionState.srxOutput, srxCommands: result.filteredOutput },
          warnings: newWarnings,
          validationFindings: result.findings,
        });
      } else {
        conversionDispatch({ type: 'SET_FIELD', field: 'convertWarnings', value: newWarnings });
        conversionDispatch({ type: 'SET_FIELD', field: 'validationFindings', value: result.findings });
      }

      // Navigate to warnings panel
      uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'warnings' });
    } catch (err) {
      uiDispatch({ type: 'SET_FIELD', field: 'error', value: `Validation error: ${err.message}` });
    } finally {
      uiDispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, [intermediateConfig, targetModel, srxLicense, conversionState, conversionDispatch, uiDispatch]);
```

Add `handleValidate` to the returned object:

```js
  return {
    ...conversionState,
    handleConvertClick,
    handleConvert,
    handleMergeConvert,
    handleValidate,  // <-- add this
  };
```

Also add `srxLicense` to the destructured values from `configState` at the top of the hook (if not already there).

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`

Expected: Build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add public/hooks/useConversion.js public/contexts/ConversionContext.jsx
git commit -m "feat(validation): add handleValidate hook with lazy-loaded engine"
```

---

### Task 7: Add Validate Button to Platform Bar

**Files:**
- Modify: `public/components/layout/ContentRouter.jsx`
- Reference: lines 146-244 (existing `renderPlatformBar()` function)

- [ ] **Step 1: Add state for enforce-license checkbox**

Near the top of the ContentRouter component (around line 100), add:

```js
const [enforceLicense, setEnforceLicense] = useState(false);
```

- [ ] **Step 2: Add the Validate button after Convert to SRX in `renderPlatformBar()`**

After the Convert to SRX button (around line 240 in the platform bar JSX), add:

```jsx
      {/* Validate button — only shows when SRX output exists */}
      {conv.srxOutput && (
        <>
          <button
            className="platform-view-btn"
            onClick={() => conversion.handleValidate(enforceLicense)}
            disabled={ui.isLoading}
            title="Run post-conversion validation checks"
            style={{ color: 'var(--caution)' }}
          >
            {ui.isLoading && ui.loadingMessage?.includes('validation')
              ? <><span className="spinner" /> Validating...</>
              : <>Validate{conv.validationFindings?.length > 0 ? ` (${conv.validationFindings.length})` : ''}</>
            }
          </button>
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, cursor: 'pointer' }}
            title="When enabled, commands requiring a higher license tier are removed from the SRX output"
          >
            <input
              type="checkbox"
              checked={enforceLicense}
              onChange={(e) => setEnforceLicense(e.target.checked)}
              style={{ margin: 0 }}
            />
            Enforce license
          </label>
        </>
      )}
```

- [ ] **Step 3: Wire the conversion hook**

Make sure `conversion` (from `useConversion()`) is accessible in ContentRouter. It should already be passed as a prop or accessed via context. Check that `conv.validationFindings` is available — it comes from ConversionContext state which was updated in Task 6.

- [ ] **Step 4: Verify the app builds and renders**

Run: `npm run build`

Expected: Build succeeds. The Validate button should appear in the platform bar after converting a config to SRX.

- [ ] **Step 5: Commit**

```bash
git add public/components/layout/ContentRouter.jsx
git commit -m "feat(validation): add Validate button and enforce-license checkbox to platform bar"
```

---

### Task 8: Add Validation Source Filter to WarningsPanel

**Files:**
- Modify: `public/components/WarningsPanel.jsx`

- [ ] **Step 1: Add validation source filter**

In `WarningsPanel.jsx`, add a `sourceFilter` state and filter button. After the existing severity filters (around line 90), add a "Validation" toggle:

```jsx
// Add state (near line 29):
const [sourceFilter, setSourceFilter] = useState('all');

// Add to the counts computation (in the useMemo around line 32):
const validationCount = warnings.filter(w => w._source === 'validation').length;

// Add filter button after the Optimization FilterButton (around line 95):
{validationCount > 0 && (
  <FilterButton
    label={`Validation (${validationCount})`}
    active={sourceFilter === 'validation'}
    onClick={() => setSourceFilter(sourceFilter === 'validation' ? 'all' : 'validation')}
    color="var(--caution)"
  />
)}
```

- [ ] **Step 2: Apply source filter to the displayed warnings**

In the filtering logic (around line 50-63), add the source filter:

```js
// After severity filtering, add:
if (sourceFilter === 'validation') {
  filtered = filtered.filter(w => w._source === 'validation');
}
```

- [ ] **Step 3: Verify the app builds**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add public/components/WarningsPanel.jsx
git commit -m "feat(validation): add Validation source filter to WarningsPanel"
```

---

### Task 9: Run All Tests and Final Verification

**Files:**
- Run: `tests/validation-engine.test.js`
- Run: `tests/llm-translate.test.js` (regression)
- Run: `npm run build`

- [ ] **Step 1: Run validation tests**

Run: `node tests/validation-engine.test.js`

Expected: All tests pass.

- [ ] **Step 2: Run existing tests for regression**

Run: `node tests/llm-translate.test.js`

Expected: All existing tests still pass.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: Clean build, no errors, no new warnings.

- [ ] **Step 4: Update TODO.md — mark Config Validation v2 as complete**

In `TODO.md`, update the "Planned — Future Improvements" section. Change:
```
- [ ] **Config validation v2** — License gating, conflict detection, best practices
```
to:
```
- [x] **Config validation v2** — License gating (toggle), operational best practices (9 checks), compliance/hardening (12 checks), hardware limits (7 checks), on-demand Validate button in platform bar, WarningsPanel integration
```

- [ ] **Step 5: Commit everything**

```bash
git add TODO.md
git commit -m "docs: mark Config Validation v2 as complete in TODO.md"
```
