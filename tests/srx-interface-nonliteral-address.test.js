/**
 * Non-literal / malformed interface address handling.
 *
 * Regression: a PAN-OS interface whose ipv6 (or ip) is not a plain Junos
 * literal — a named object reference, a scoped link-local (fe80::1%eth0),
 * an EUI-64 suffix, a `dhcpv6` keyword, or a trailing-space value — used to
 * hard-block the ENTIRE conversion via validateJunosInput. Per the tool's
 * skip-and-caveat philosophy (#32-#35) it must instead skip only the bad
 * address, emit a caveat + warning, and convert everything else.
 */

import { describe, it, expect } from 'vitest';
import { convertToSrxSetCommands } from '../src/converters/srx-converter.js';

const baseConfig = {
  zones: [{ name: 'trust', interfaces: ['ethernet1/1', 'ethernet1/2'] }],
  security_policies: [],
  service_objects: [],
  address_objects: [],
  address_groups: [],
  nat_rules: [],
};

describe('interface non-literal/malformed address does not block conversion', () => {
  const malformed = [
    ['scoped link-local', 'fe80::1%eth0'],
    ['named object reference', 'v6-mgmt-addr'],
    ['EUI-64 suffix', '2001:db8:abcd::1 eui-64'],
    ['dhcpv6 keyword', 'dhcpv6'],
  ];

  malformed.forEach(([label, badIpv6]) => {
    it(`does not throw and skips the bad ipv6 (${label})`, () => {
      const config = {
        ...baseConfig,
        interfaces: [
          { name: 'ethernet1/1', zone: 'trust', ip: '10.0.0.1/24', ipv6: '' },
          { name: 'ethernet1/2', zone: 'trust', ip: '10.0.1.1/24', ipv6: badIpv6 },
        ],
      };

      // Must NOT throw "Conversion blocked".
      const result = convertToSrxSetCommands(config);

      // Valid interfaces still emit.
      expect(result.commands.some((c) => c.includes('10.0.0.1/24'))).toBe(true);
      expect(result.commands.some((c) => c.includes('10.0.1.1/24'))).toBe(true);

      // The malformed ipv6 must NOT be emitted as an inet6 address.
      expect(result.commands.some((c) => c.includes(`family inet6 address ${badIpv6}`))).toBe(false);

      // A warning must flag the skipped address.
      expect(result.warnings.some((w) => /ipv6|address/i.test(JSON.stringify(w)))).toBe(true);
    });
  });

  it('trims a trailing-space literal so it emits normally', () => {
    const config = {
      ...baseConfig,
      interfaces: [
        { name: 'ethernet1/1', zone: 'trust', ip: '10.0.0.1/24', ipv6: '' },
        { name: 'ethernet1/2', zone: 'trust', ip: '10.0.1.1/24', ipv6: '2001:db8::1/64 ' },
      ],
    };
    const result = convertToSrxSetCommands(config);
    expect(result.commands.some((c) => c.includes('family inet6 address 2001:db8::1/64'))).toBe(true);
  });

  it('never reflects a malformed-address injection payload into commands', () => {
    const config = {
      ...baseConfig,
      interfaces: [
        { name: 'ethernet1/1', zone: 'trust', ip: '192.0.2.1/24 set system services telnet', ipv6: '' },
      ],
    };
    const result = convertToSrxSetCommands(config);
    // Skips gracefully (no throw) and the payload appears in NO command line.
    expect(result.commands.some((c) => c.includes('set system services telnet'))).toBe(false);
    expect(result.commands.some((c) => c.includes('family inet address 192.0.2.1/24 set'))).toBe(false);
  });

  it('still emits a valid ipv6 unchanged', () => {
    const config = {
      ...baseConfig,
      interfaces: [
        { name: 'ethernet1/1', zone: 'trust', ip: '10.0.0.1/24', ipv6: '2001:db8::1/64' },
      ],
    };
    const result = convertToSrxSetCommands(config);
    expect(result.commands.some((c) => c.includes('family inet6 address 2001:db8::1/64'))).toBe(true);
  });
});
