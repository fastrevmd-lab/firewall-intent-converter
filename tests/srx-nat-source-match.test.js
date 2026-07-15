/**
 * Test: NAT source match address-groups + service protocol/port
 * ============================================================
 * Issue #55: Preserve address groups and service protocol/port in NAT match.
 *
 * Part A: Address groups are emitted as name-refs (match source-address-name)
 *         instead of being dropped (resulting in over-broad match).
 * Part B: Service protocol/port is captured from PAN parser and emitted in
 *         source NAT match.
 */

import { describe, it, expect } from 'vitest';
import { convertToSrxSetCommands } from '../src/converters/srx-converter.js';
import { validateSetOutput } from '../src/security/junos-output-validation.js';

describe('NAT source match — address groups + service (issue #55)', () => {
  it('emits match source-address-name for address group', () => {
    const config = {
      zones: [
        { name: 'trust', interfaces: ['ge-0/0/0'] },
        { name: 'untrust', interfaces: ['ge-0/0/1'] },
      ],
      address_objects: [],
      address_groups: [
        { name: 'grp-internal', members: ['10.0.1.0/24', '10.0.2.0/24'] },
      ],
      nat_rules: [
        {
          name: 'snat-group-src',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['grp-internal'],
          dst_addresses: ['any'],
          translated_src: { type: 'interface' },
        },
      ],
    };

    const result = convertToSrxSetCommands(config);
    const output = result.commands.join('\n');

    // Must emit match source-address-name <group>, NOT drop it
    expect(output).toMatch(/match source-address-name grp-internal/);
    expect(output).not.toMatch(/match source-address 0\.0\.0\.0\/0/);
    expect(() => validateSetOutput(result.commands)).not.toThrow();
  });

  it('emits match destination-address-name for address group', () => {
    const config = {
      zones: [
        { name: 'trust', interfaces: ['ge-0/0/0'] },
        { name: 'untrust', interfaces: ['ge-0/0/1'] },
      ],
      address_objects: [],
      address_groups: [
        { name: 'grp-servers', members: ['192.168.10.0/24'] },
      ],
      nat_rules: [
        {
          name: 'snat-group-dst',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['any'],
          dst_addresses: ['grp-servers'],
          translated_src: { type: 'interface' },
        },
      ],
    };

    const result = convertToSrxSetCommands(config);
    const output = result.commands.join('\n');

    expect(output).toMatch(/match destination-address-name grp-servers/);
    expect(() => validateSetOutput(result.commands)).not.toThrow();
  });

  it('emits literal IP for source address object (not a group)', () => {
    const config = {
      zones: [
        { name: 'trust', interfaces: ['ge-0/0/0'] },
        { name: 'untrust', interfaces: ['ge-0/0/1'] },
      ],
      address_objects: [
        { name: 'host-a', value: '10.0.5.10/32' },
      ],
      address_groups: [],
      nat_rules: [
        {
          name: 'snat-object-src',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['host-a'],
          dst_addresses: ['any'],
          translated_src: { type: 'interface' },
        },
      ],
    };

    const result = convertToSrxSetCommands(config);
    const output = result.commands.join('\n');

    // Address objects resolve to IPs → match source-address <ip>
    expect(output).toMatch(/match source-address 10\.0\.5\.10\/32/);
    expect(output).not.toMatch(/source-address-name/);
    expect(() => validateSetOutput(result.commands)).not.toThrow();
  });

  it('skips unknown address with warning', () => {
    const config = {
      zones: [
        { name: 'trust', interfaces: ['ge-0/0/0'] },
        { name: 'untrust', interfaces: ['ge-0/0/1'] },
      ],
      address_objects: [],
      address_groups: [],
      nat_rules: [
        {
          name: 'snat-unknown',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['unknown-addr'],
          dst_addresses: ['any'],
          translated_src: { type: 'interface' },
        },
      ],
    };

    const result = convertToSrxSetCommands(config);
    const output = result.commands.join('\n');

    // Unknown name → skip match (no source-address line)
    expect(output).not.toMatch(/match source-address unknown-addr/);
    // Should warn (note: NAT warnings have non-standard structure, element is actually the message)
    expect(result.warnings.some(w => (w.message || w.element || '').includes('unknown-addr'))).toBe(true);
    expect(() => validateSetOutput(result.commands)).not.toThrow();
  });

  it('emits protocol + port for source NAT rule with service', () => {
    const config = {
      zones: [
        { name: 'trust', interfaces: ['ge-0/0/0'] },
        { name: 'untrust', interfaces: ['ge-0/0/1'] },
      ],
      address_objects: [],
      address_groups: [],
      nat_rules: [
        {
          name: 'snat-with-service',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.1.0/24'],
          dst_addresses: ['any'],
          match_protocol: 'tcp',
          match_port: '8080',
          translated_src: { type: 'interface' },
        },
      ],
    };

    const result = convertToSrxSetCommands(config);
    const output = result.commands.join('\n');

    expect(output).toMatch(/match protocol tcp/);
    expect(output).toMatch(/match destination-port 8080/);
    expect(() => validateSetOutput(result.commands)).not.toThrow();
  });

  it('emits only protocol if port is absent', () => {
    const config = {
      zones: [
        { name: 'trust', interfaces: ['ge-0/0/0'] },
        { name: 'untrust', interfaces: ['ge-0/0/1'] },
      ],
      address_objects: [],
      address_groups: [],
      nat_rules: [
        {
          name: 'snat-proto-only',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.2.0/24'],
          dst_addresses: ['any'],
          match_protocol: 'udp',
          translated_src: { type: 'interface' },
        },
      ],
    };

    const result = convertToSrxSetCommands(config);
    const output = result.commands.join('\n');

    expect(output).toMatch(/match protocol udp/);
    expect(output).not.toMatch(/destination-port/);
    expect(() => validateSetOutput(result.commands)).not.toThrow();
  });

  it('skips protocol/port if match_protocol/match_port are absent', () => {
    const config = {
      zones: [
        { name: 'trust', interfaces: ['ge-0/0/0'] },
        { name: 'untrust', interfaces: ['ge-0/0/1'] },
      ],
      address_objects: [],
      address_groups: [],
      nat_rules: [
        {
          name: 'snat-no-service',
          type: 'source',
          src_zones: ['trust'],
          dst_zones: ['untrust'],
          src_addresses: ['10.0.3.0/24'],
          dst_addresses: ['any'],
          translated_src: { type: 'interface' },
        },
      ],
    };

    const result = convertToSrxSetCommands(config);
    const output = result.commands.join('\n');

    expect(output).not.toMatch(/match protocol/);
    expect(output).not.toMatch(/destination-port/);
    expect(() => validateSetOutput(result.commands)).not.toThrow();
  });

  it('full source NAT with group + service passes validation', () => {
    const config = {
      zones: [
        { name: 'dmz', interfaces: ['ge-0/0/2'] },
        { name: 'internet', interfaces: ['ge-0/0/3'] },
      ],
      address_objects: [
        { name: 'web-srv', value: '192.168.100.10/32' },
      ],
      address_groups: [
        { name: 'app-servers', members: ['192.168.100.0/24', '192.168.101.0/24'] },
      ],
      nat_rules: [
        {
          name: 'full-snat',
          type: 'source',
          src_zones: ['dmz'],
          dst_zones: ['internet'],
          src_addresses: ['app-servers'],
          dst_addresses: ['web-srv'],
          match_protocol: 'tcp',
          match_port: '443',
          translated_src: { type: 'interface' },
        },
      ],
    };

    const result = convertToSrxSetCommands(config);
    const output = result.commands.join('\n');

    // address-set definition
    expect(output).toMatch(/set security address-book global address-set app-servers/);
    // source match: name-ref for group
    expect(output).toMatch(/match source-address-name app-servers/);
    // destination match: literal IP for object
    expect(output).toMatch(/match destination-address 192\.168\.100\.10\/32/);
    // service match
    expect(output).toMatch(/match protocol tcp/);
    expect(output).toMatch(/match destination-port 443/);

    expect(() => validateSetOutput(result.commands)).not.toThrow();
  });
});
