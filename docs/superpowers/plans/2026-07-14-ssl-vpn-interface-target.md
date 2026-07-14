# SSL-VPN / Remote-Access Interface Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users designate a PAN-OS tunnel as SSL-VPN / remote-access, auto-detected from GlobalProtect config, so the SRX conversion emits an honest `st0` placeholder plus a manual-not-converted caveat instead of a misleading IPsec tunnel.

**Architecture:** The PAN-OS parser detects GlobalProtect gateways and stamps their tunnel interfaces with `remote_access_role: 'ssl-vpn'` plus a `config.global_protect` summary. The converter and HTML report key off those parsed fields (authoritative, decoupled from UI state). The Interface Mapper adds an `st0-ra` dropdown option that auto-selects for GlobalProtect tunnels; `st0-ra` is a UI marker that always serializes to a real `st0.<unit>` Junos token.

**Tech Stack:** JavaScript (ESM), React 18, Vitest, fast-xml-parser (already used by the PAN-OS parser).

## Global Constraints

- No fabricated VPN crypto/auth is ever emitted for SSL-VPN tunnels (comment + report caveat only).
- `remote_access_role` is written only as the literal string `'ssl-vpn'`.
- `st0-ra` is a UI/mapping-layer marker only; every interface-mapping string the converter consumes must be a valid Junos interface token (`st0.<unit>`).
- No behavior change for configs without GlobalProtect: `global_protect.gateways` is `[]` and no interface is stamped.
- Follow existing code style: `const` over `let`, JSDoc on exported functions, early returns.
- Run tests with `npx vitest run` (there is no `npm test` script).

---

### Task 1: Parser — detect GlobalProtect and stamp remote-access tunnels

**Files:**
- Modify: `src/parsers/panos-parser.js` (add `parseGlobalProtect`, call it in the main parse, add `global_protect` to `intermediateConfig`, stamp interfaces)
- Test: `tests/panos-global-protect.test.js` (create)

**Interfaces:**
- Produces:
  - `parseGlobalProtect(config, warnings) → { gateways: Array<{ name: string, tunnel_interface: string }> }`
  - `intermediateConfig.global_protect: { gateways: [...] }`
  - Each interface object in `intermediateConfig.interfaces` whose `name` equals a gateway `tunnel_interface` gains `remote_access_role: 'ssl-vpn'`.
- Consumes: existing helpers `getNestedValue(obj, path)` and `extractEntries(node)` already defined in `panos-parser.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/panos-global-protect.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parsePanosConfig } from '../src/parsers/panos-parser.js';

/** Minimal PAN-OS XML with one GlobalProtect gateway bound to tunnel.10. */
const GP_XML = `<?xml version="1.0"?>
<config version="11.1.0">
  <devices><entry name="localhost.localdomain">
    <network><interface><tunnel><units>
      <entry name="tunnel.10"><comment>Remote Access GP Tunnel</comment></entry>
    </units></tunnel></interface></network>
    <vsys><entry name="vsys1">
      <zone><entry name="REMOTE-ACCESS"><network><layer3>
        <member>tunnel.10</member>
      </layer3></network></entry></zone>
      <global-protect><global-protect-gateway>
        <entry name="G41-GP-GW"><tunnel-interface>tunnel.10</tunnel-interface></entry>
      </global-protect-gateway></global-protect>
    </entry></vsys>
  </entry></devices>
</config>`;

const NO_GP_XML = `<?xml version="1.0"?>
<config version="11.1.0">
  <devices><entry name="localhost.localdomain">
    <network><interface><tunnel><units>
      <entry name="tunnel.1"><comment>Site VPN</comment></entry>
    </units></tunnel></interface></network>
    <vsys><entry name="vsys1">
      <zone><entry name="VPN"><network><layer3>
        <member>tunnel.1</member>
      </layer3></network></entry></zone>
    </entry></vsys>
  </entry></devices>
</config>`;

describe('PAN-OS GlobalProtect detection', () => {
  it('records GP gateways and stamps the bound tunnel interface', () => {
    const { intermediateConfig } = parsePanosConfig(GP_XML);
    expect(intermediateConfig.global_protect.gateways).toEqual([
      { name: 'G41-GP-GW', tunnel_interface: 'tunnel.10' },
    ]);
    const tun = intermediateConfig.interfaces.find(i => i.name === 'tunnel.10');
    expect(tun.remote_access_role).toBe('ssl-vpn');
  });

  it('leaves non-GlobalProtect configs unchanged', () => {
    const { intermediateConfig } = parsePanosConfig(NO_GP_XML);
    expect(intermediateConfig.global_protect.gateways).toEqual([]);
    const tun = intermediateConfig.interfaces.find(i => i.name === 'tunnel.1');
    expect(tun?.remote_access_role).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/panos-global-protect.test.js`
Expected: FAIL — `intermediateConfig.global_protect` is undefined.

> If `parsePanosConfig` is not the exported name, check the export at the bottom of `src/parsers/panos-parser.js` and update the import in the test to match (e.g. a default export or `parsePanos`). Do not change the parser's public name.

- [ ] **Step 3: Add `parseGlobalProtect` and wire it in**

In `src/parsers/panos-parser.js`, add this function near `parseVpnConfig` (follow the same `getNestedValue`/`extractEntries` navigation pattern):

```js
/**
 * Parse GlobalProtect gateways and the tunnel interface each one binds.
 * GlobalProtect is SSL-VPN; it has no automatic SRX equivalent, so we only
 * record it for the UI/report and to stamp the tunnel interface.
 *
 * @param {object} config - Parsed PAN-OS XML config root.
 * @param {Array} warnings - Warning accumulator (unused today; reserved).
 * @returns {{ gateways: Array<{ name: string, tunnel_interface: string }> }}
 */
function parseGlobalProtect(config, warnings) {
  const gateways = [];
  const devices = getNestedValue(config, 'devices');
  if (!devices) return { gateways };

  for (const device of extractEntries(devices)) {
    const vsysNode = getNestedValue(device, 'vsys');
    if (!vsysNode) continue;
    for (const vsys of extractEntries(vsysNode)) {
      const gwContainer = getNestedValue(vsys, 'global-protect.global-protect-gateway');
      if (!gwContainer) continue;
      for (const entry of extractEntries(gwContainer)) {
        const name = entry['@_name'] || '';
        const tunnelInterface = typeof entry['tunnel-interface'] === 'string'
          ? entry['tunnel-interface'].trim()
          : '';
        if (!name || !tunnelInterface) continue;
        gateways.push({ name, tunnel_interface: tunnelInterface });
      }
    }
  }
  return { gateways };
}
```

- [ ] **Step 4: Call it and stamp interfaces in the main parse**

In `src/parsers/panos-parser.js`, immediately after the line
`const interfaces = parseInterfaceConfig(config, allZones, warnings);`
add:

```js
  // Detect GlobalProtect (SSL-VPN) and mark the tunnel interfaces it binds.
  const globalProtect = parseGlobalProtect(config, warnings);
  const sslVpnTunnels = new Set(globalProtect.gateways.map(g => g.tunnel_interface));
  for (const iface of interfaces) {
    if (sslVpnTunnels.has(iface.name)) iface.remote_access_role = 'ssl-vpn';
  }
```

Then add `global_protect: globalProtect,` to the `intermediateConfig` object literal (place it right after the `vpn_tunnels: vpnTunnels,` line).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/panos-global-protect.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite (no regressions)**

Run: `npx vitest run`
Expected: all files pass.

- [ ] **Step 7: Commit**

```bash
git add src/parsers/panos-parser.js tests/panos-global-protect.test.js
git commit -m "feat(parser): detect GlobalProtect and mark remote-access tunnels (#23)"
```

---

### Task 2: Converter — emit SSL-VPN placeholder comment, no VPN config

**Files:**
- Modify: `src/converters/srx-converter.js` (add `convertRemoteAccessPlaceholders`, call it)
- Test: `tests/srx-ssl-vpn.test.js` (create)

**Interfaces:**
- Consumes: `intermediateConfig.interfaces[].remote_access_role`, `intermediateConfig.global_protect.gateways`, existing `mapInterfaceName(name, interfaceMappings)` and `convertToSrxSetCommands(config, interfaceMappings)`.
- Produces: `convertRemoteAccessPlaceholders(interfaces, commands, interfaceMappings, globalProtect)` — pushes comment lines; returns nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/srx-ssl-vpn.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { convertToSrxSetCommands } from '../src/converters/srx-converter.js';

const CONFIG = {
  zones: [{ name: 'REMOTE-ACCESS', interfaces: ['tunnel.10'] }],
  interfaces: [
    { name: 'tunnel.10', zone: 'REMOTE-ACCESS', type: 'tunnel',
      description: 'Remote Access GP Tunnel', remote_access_role: 'ssl-vpn' },
  ],
  global_protect: { gateways: [{ name: 'G41-GP-GW', tunnel_interface: 'tunnel.10' }] },
  security_policies: [], nat_rules: [], address_objects: [], service_objects: [],
  vpn_tunnels: [],
};
const MAPPINGS = { 'tunnel.10': 'st0.10' };

describe('SRX SSL-VPN remote-access placeholder', () => {
  it('emits an SSL-VPN caveat comment naming the gateway', () => {
    const out = convertToSrxSetCommands(CONFIG, MAPPINGS);
    const text = Array.isArray(out.commands) ? out.commands.join('\n') : String(out);
    expect(text).toMatch(/SSL-VPN \(GlobalProtect 'G41-GP-GW'\)/);
    expect(text).toMatch(/not auto-converted/i);
  });

  it('does not emit IKE/IPsec config for the SSL-VPN tunnel', () => {
    const out = convertToSrxSetCommands(CONFIG, MAPPINGS);
    const text = Array.isArray(out.commands) ? out.commands.join('\n') : String(out);
    expect(text).not.toMatch(/set security ike gateway/);
    expect(text).not.toMatch(/set security ipsec vpn/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/srx-ssl-vpn.test.js`
Expected: FAIL — no SSL-VPN comment in output.

> If `convertToSrxSetCommands` returns a shape other than `{ commands: [...] }`, inspect its `return` (near the top of the function it is declared at `src/converters/srx-converter.js:75`) and adjust the test's `text` extraction accordingly. Do not change the function's return shape.

- [ ] **Step 3: Add the placeholder emitter**

In `src/converters/srx-converter.js`, add this function next to `convertInterfaceAddresses`:

```js
/**
 * Emit an honest caveat for SSL-VPN / remote-access tunnels (e.g. PAN-OS
 * GlobalProtect). The st0 unit itself is already ensured elsewhere; here we
 * only document that the remote-access VPN was NOT auto-converted. No IKE,
 * IPsec, or access configuration is generated.
 *
 * @param {Array} interfaces - intermediateConfig.interfaces
 * @param {Array<string>} commands - output command accumulator
 * @param {object} interfaceMappings - PAN-OS→SRX interface map
 * @param {{gateways: Array<{name: string, tunnel_interface: string}>}} globalProtect
 */
function convertRemoteAccessPlaceholders(interfaces, commands, interfaceMappings = {}, globalProtect = { gateways: [] }) {
  const raInterfaces = (interfaces || []).filter(i => i.remote_access_role === 'ssl-vpn');
  if (raInterfaces.length === 0) return;

  const gatewayByTunnel = new Map(
    (globalProtect?.gateways || []).map(g => [g.tunnel_interface, g.name]),
  );

  commands.push('# =============================================');
  commands.push('# SSL-VPN / Remote Access — NOT CONVERTED');
  commands.push('# =============================================');
  for (const iface of raInterfaces) {
    const mapped = mapInterfaceName(iface.name || '', interfaceMappings);
    const gateway = gatewayByTunnel.get(iface.name);
    const gwLabel = gateway ? ` (GlobalProtect '${gateway}')` : '';
    commands.push(`# ${iface.name} -> ${mapped}: SSL-VPN${gwLabel} — remote-access VPN not auto-converted;`);
    commands.push('#   rebuild as Juniper Secure Connect / IPsec dial-up (re-implement MFA via RADIUS).');
  }
  commands.push('');
}
```

- [ ] **Step 4: Call it from the main converter**

In `src/converters/srx-converter.js`, find the call `convertInterfaceAddresses(config.interfaces, commands, warnings, summary, interfaceMappings);` (near line 134) and add immediately after it:

```js
  convertRemoteAccessPlaceholders(config.interfaces, commands, interfaceMappings, config.global_protect);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/srx-ssl-vpn.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/converters/srx-converter.js tests/srx-ssl-vpn.test.js
git commit -m "feat(convert): emit SSL-VPN remote-access caveat, no fabricated VPN (#23)"
```

---

### Task 3: Report — Remote Access VPN section in the HTML report

**Files:**
- Modify: `public/utils/report-generator.js` (add a section built from `ic.global_protect`)
- Test: `tests/report-ssl-vpn.test.js` (create)

**Interfaces:**
- Consumes: `data.intermediateConfig.global_protect.gateways`, existing local helpers `section(id, title, content, count)`, `table(headers, rows)`, `esc(str)`, `arr(v)` inside `report-generator.js`.
- Produces: an extra `<div class="section">` titled "Remote Access VPN (SSL-VPN)" when GlobalProtect gateways exist.

- [ ] **Step 1: Write the failing test**

Create `tests/report-ssl-vpn.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateReportHtml } from '../public/utils/report-generator.js';

const base = {
  sourceVendor: 'panos', targetModel: 'SRX1600',
  intermediateConfig: {
    zones: [], interfaces: [], security_policies: [], nat_rules: [],
    address_objects: [], service_objects: [], static_routes: [],
  },
};

describe('report SSL-VPN section', () => {
  it('renders a Remote Access VPN section when GlobalProtect is present', () => {
    const data = {
      ...base,
      intermediateConfig: {
        ...base.intermediateConfig,
        global_protect: { gateways: [{ name: 'G41-GP-GW', tunnel_interface: 'tunnel.10' }] },
      },
    };
    const html = generateReportHtml(data);
    expect(html).toContain('Remote Access VPN');
    expect(html).toContain('G41-GP-GW');
    expect(html).toContain('tunnel.10');
    expect(html).toMatch(/Secure Connect|manual/i);
  });

  it('omits the section when no GlobalProtect is present', () => {
    const html = generateReportHtml(base);
    expect(html).not.toContain('Remote Access VPN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/report-ssl-vpn.test.js`
Expected: FAIL — "Remote Access VPN" not in output.

- [ ] **Step 3: Add the section**

In `public/utils/report-generator.js`, inside `generateReportHtml`, after the routing section is pushed (`sections.push(section('routing', ...));` near line 202) and before the warnings section, add:

```js
  // Remote Access VPN (SSL-VPN / GlobalProtect) — manual, not auto-converted.
  const gpGateways = arr(ic?.global_protect?.gateways);
  if (gpGateways.length > 0) {
    const raRows = gpGateways.map(g => [
      esc(g.tunnel_interface || ''),
      esc(g.name || ''),
      'Rebuild as Juniper Secure Connect / IPsec dial-up (re-implement MFA via RADIUS).',
    ]);
    const raHtml = `<p>SSL-VPN remote access is <strong>not auto-converted</strong>. `
      + `The tunnels below map to <code>st0</code> placeholders only.</p>`
      + table(['Tunnel', 'GlobalProtect Gateway', 'Manual action'], raRows);
    sections.push(section('remote-access', 'Remote Access VPN (SSL-VPN)', raHtml, gpGateways.length));
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/report-ssl-vpn.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all pass (confirm `tests/report-branding.test.js` still green).

- [ ] **Step 6: Commit**

```bash
git add public/utils/report-generator.js tests/report-ssl-vpn.test.js
git commit -m "feat(report): add SSL-VPN remote-access manual section (#23)"
```

---

### Task 4: UI — st0-ra dropdown option, auto-suggest, and SSL-VPN badge

**Files:**
- Modify: `public/components/InterfaceMapper.jsx` (add `st0-ra` option + pure helpers + wire them in)
- Test: `tests/interface-mapper-ssl-vpn.test.js` (create — tests the exported pure helpers)

**Interfaces:**
- Produces two exported pure helpers from `InterfaceMapper.jsx`:
  - `srxTunnelBase(tunnelType: string) → string` — maps `'st0-ra'` → `'st0'`, otherwise returns the input unchanged.
  - `defaultTunnelTypeFor(ifaceName: string, sslVpnTunnels: Set<string>, existingMapping: string) → string` — returns `'gr-0/0/0'`/`'ip-0/0/0'` from an existing mapping prefix, else `'st0-ra'` if `sslVpnTunnels.has(ifaceName)`, else `'st0'`.
- Consumes: `intermediateConfig.global_protect.gateways` (to build the `sslVpnTunnels` set), existing `SRX_TUNNEL_TYPES`, `tunnelTypes`/`tunnelUnits` state.

- [ ] **Step 1: Write the failing test**

Create `tests/interface-mapper-ssl-vpn.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { srxTunnelBase, defaultTunnelTypeFor } from '../public/components/InterfaceMapper.jsx';

describe('InterfaceMapper SSL-VPN helpers', () => {
  it('srxTunnelBase maps the st0-ra marker to a real st0 Junos base', () => {
    expect(srxTunnelBase('st0-ra')).toBe('st0');
    expect(srxTunnelBase('st0')).toBe('st0');
    expect(srxTunnelBase('gr-0/0/0')).toBe('gr-0/0/0');
  });

  it('defaultTunnelTypeFor auto-selects st0-ra for GlobalProtect tunnels', () => {
    const gp = new Set(['tunnel.10']);
    expect(defaultTunnelTypeFor('tunnel.10', gp, '')).toBe('st0-ra');
    expect(defaultTunnelTypeFor('tunnel.99', gp, '')).toBe('st0');
  });

  it('defaultTunnelTypeFor honors an existing non-st0 mapping prefix', () => {
    const gp = new Set(['tunnel.10']);
    expect(defaultTunnelTypeFor('tunnel.10', gp, 'gr-0/0/0.10')).toBe('gr-0/0/0');
    expect(defaultTunnelTypeFor('tunnel.5', gp, 'ip-0/0/0.5')).toBe('ip-0/0/0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/interface-mapper-ssl-vpn.test.js`
Expected: FAIL — `srxTunnelBase`/`defaultTunnelTypeFor` are not exported.

- [ ] **Step 3: Add the `st0-ra` option and exported helpers**

In `public/components/InterfaceMapper.jsx`, add a fourth entry to `SRX_TUNNEL_TYPES`:

```js
  { value: 'st0-ra',    label: 'st0 (SSL-VPN / Remote Access)', description: 'GlobalProtect → Juniper Secure Connect / IPsec dial-up (manual rebuild)' },
```

Then add these exported helpers near the other top-level helpers (e.g. after `getUnit`):

```js
/**
 * Resolve the real Junos interface base for a tunnel-type selection.
 * The `st0-ra` value is a UI marker for SSL-VPN intent; it always serializes
 * to a real `st0` interface so the emitted mapping is a valid Junos token.
 * @param {string} tunnelType
 * @returns {string}
 */
export function srxTunnelBase(tunnelType) {
  return tunnelType === 'st0-ra' ? 'st0' : tunnelType;
}

/**
 * Choose the default tunnel-type selection for a PAN-OS tunnel interface.
 * An existing non-st0 mapping prefix wins; otherwise GlobalProtect tunnels
 * default to the SSL-VPN marker, and everything else to plain st0 IPsec.
 * @param {string} ifaceName
 * @param {Set<string>} sslVpnTunnels
 * @param {string} existingMapping
 * @returns {string}
 */
export function defaultTunnelTypeFor(ifaceName, sslVpnTunnels, existingMapping = '') {
  if (existingMapping.startsWith('gr-')) return 'gr-0/0/0';
  if (existingMapping.startsWith('ip-')) return 'ip-0/0/0';
  if (sslVpnTunnels && sslVpnTunnels.has(ifaceName)) return 'st0-ra';
  return 'st0';
}
```

- [ ] **Step 4: Wire the helpers into component state and mapping**

In `public/components/InterfaceMapper.jsx`:

(a) Build the SSL-VPN tunnel set once, near the top of the component body (after `targetModelData` is defined):

```js
  const sslVpnTunnels = useMemo(
    () => new Set((intermediateConfig?.global_protect?.gateways || []).map(g => g.tunnel_interface)),
    [intermediateConfig],
  );
```

(b) Replace the `tunnelTypes` initializer's inner branch so it uses the helper. Change the block that currently reads:

```js
          const existing = existingMappings?.[iface] || '';
          if (existing.startsWith('gr-')) {
            types[iface] = 'gr-0/0/0';
          } else if (existing.startsWith('ip-')) {
            types[iface] = 'ip-0/0/0';
          } else {
            types[iface] = 'st0';
          }
```

to:

```js
          const existing = existingMappings?.[iface] || '';
          types[iface] = defaultTunnelTypeFor(iface, sslVpnTunnels, existing);
```

> Note: `sslVpnTunnels` is a `useMemo` value, but the `useState` initializer only runs on first mount, so referencing it there reads its initial value — which is correct because `intermediateConfig` does not change while the modal is open.

(c) In `handleTunnelTypeChange` and `handleTunnelUnitChange`, build the mapping string with the real Junos base. Replace both occurrences of:

```js
      [panosIface]: `${tunnelType}.${unit}`,
```

with:

```js
      [panosIface]: `${srxTunnelBase(tunnelType)}.${unit}`,
```

(In `handleTunnelUnitChange` the local variable is `tunnelType`; in `handleTunnelTypeChange` it is the `tunnelType` parameter — both already in scope.)

(d) SSL-VPN badge: locate the tunnel-row render where the encapsulation badge shows `IPsec`/`GRE`/`IP-IP` (search the JSX for the badge text near the tunnel dropdown) and make it show `SSL-VPN` when the selected type is `st0-ra`. Concretely, where the badge label is derived, use:

```js
  const tunnelBadge = tunnelTypes[iface] === 'st0-ra'
    ? 'SSL-VPN'
    : (tunnelTypes[iface] === 'gr-0/0/0' ? 'GRE'
      : tunnelTypes[iface] === 'ip-0/0/0' ? 'IP-IP' : 'IPsec');
```

and render `{tunnelBadge}` in place of the existing hard-coded badge text. If the existing badge is not a simple literal, adapt minimally to select `SSL-VPN` for `st0-ra` without changing the other cases' output.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/interface-mapper-ssl-vpn.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 7: Manual smoke (drive the real app)**

The dev server is already running (`npm run dev`, http://192.168.1.127:5173/). Load a PAN-OS config with a GlobalProtect gateway, open Interface Mapping, and confirm the GP tunnel row defaults to "st0 (SSL-VPN / Remote Access)" with an SSL-VPN badge, and that Convert & Export produces the SSL-VPN caveat comment and the report's Remote Access VPN section. (No code change expected here — this is verification.)

- [ ] **Step 8: Commit**

```bash
git add public/components/InterfaceMapper.jsx tests/interface-mapper-ssl-vpn.test.js
git commit -m "feat(ui): add SSL-VPN remote-access tunnel option and auto-suggest (#23)"
```

---

## Spec Coverage Check

- Spec §1 Parser → **Task 1** (`parseGlobalProtect`, `global_protect`, `remote_access_role` stamping, defensive no-GP behavior).
- Spec §2 UI → **Task 4** (`st0-ra` option, auto-suggest via `defaultTunnelTypeFor`, `srxTunnelBase` keeps the Junos token valid, SSL-VPN badge).
- Spec §3 Converter → **Task 2** (`convertRemoteAccessPlaceholders`, comment naming the gateway, no IKE/IPsec).
- Spec §4 Report → **Task 3** (Remote Access VPN section, manual action per gateway).
- Spec "Testing" bullets → covered across Tasks 1–4 test steps (parser present/absent/malformed, UI default + override, converter comment + no VPN, report present/absent).
- Spec "Risks" (marker leaking into Junos output) → **Task 4** `srxTunnelBase` + its unit test; converter tests assert only valid `st0` tokens are emitted.

## Notes / Out of Scope

- **Override persistence across modal re-open:** a user who overrides a GP tunnel from `st0-ra` back to plain `st0` will see it re-default to `st0-ra` on the next open (auto-suggest re-derives from parsed GlobalProtect). The emitted Junos token is `st0.<unit>` either way, so conversion is unaffected; only the badge/report intent re-asserts. Persisting per-user overrides is out of scope for this issue.
- The converter/report treat `remote_access_role` / `global_protect` as authoritative, so the SSL-VPN caveat appears whenever GlobalProtect was detected, independent of UI dropdown state.
