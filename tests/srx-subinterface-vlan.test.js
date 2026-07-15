import { describe, it, expect } from 'vitest';
import { convertToSrxSetCommands } from '../src/converters/srx-converter.js';

function ifaceLines(out) {
  const cmds = Array.isArray(out.commands) ? out.commands : [];
  return cmds.filter(l => l.startsWith('set interfaces ge-0/0/3'));
}

const MAPPINGS = { 'ethernet1/13': 'ge-0/0/3' };

describe('sub-interface VLAN tagging', () => {
  it('native case: parent untagged IP + tagged sub-units', () => {
    const cfg = {
      zones: [{ name: 'INSIDE', interfaces: ['ethernet1/13', 'ethernet1/13.100', 'ethernet1/13.206'] }],
      security_policies: [], service_objects: [], address_objects: [], nat_rules: [],
      interfaces: [
        { name: 'ethernet1/13', zone: 'INSIDE', ip: '172.16.0.2/16', vlan: '' },
        { name: 'ethernet1/13.100', zone: 'INSIDE', ip: '10.0.0.1/24', vlan: '100' },
        { name: 'ethernet1/13.206', zone: 'INSIDE', ip: '10.0.6.1/24', vlan: '206' },
      ],
    };
    const lines = ifaceLines(convertToSrxSetCommands(cfg, MAPPINGS, null)).join('\n');
    expect(lines).toContain('set interfaces ge-0/0/3 flexible-vlan-tagging');
    expect(lines).toContain('set interfaces ge-0/0/3 native-vlan-id 1');   // 1 ∉ {100,206}
    expect(lines).toContain('set interfaces ge-0/0/3 unit 0 family inet address 172.16.0.2/16');
    expect(lines).not.toMatch(/unit 0 vlan-id/);                            // native unit has no vlan-id
    expect(lines).toContain('set interfaces ge-0/0/3 unit 100 vlan-id 100');
    expect(lines).toContain('set interfaces ge-0/0/3 unit 206 vlan-id 206');
  });

  it('no-native case: tagged sub-units, no parent IP', () => {
    const cfg = {
      zones: [{ name: 'INSIDE', interfaces: ['ethernet1/13.100'] }],
      security_policies: [], service_objects: [], address_objects: [], nat_rules: [],
      interfaces: [{ name: 'ethernet1/13.100', zone: 'INSIDE', ip: '10.0.0.1/24', vlan: '100' }],
    };
    const lines = ifaceLines(convertToSrxSetCommands(cfg, MAPPINGS, null)).join('\n');
    expect(lines).toContain('set interfaces ge-0/0/3 flexible-vlan-tagging');
    expect(lines).toContain('set interfaces ge-0/0/3 unit 100 vlan-id 100');
    expect(lines).not.toMatch(/native-vlan-id/);
  });

  it('regression: plain interface with no tagged siblings gets no flexible-vlan-tagging', () => {
    const cfg = {
      zones: [{ name: 'DMZ', interfaces: ['ethernet1/13'] }],
      security_policies: [], service_objects: [], address_objects: [], nat_rules: [],
      interfaces: [{ name: 'ethernet1/13', zone: 'DMZ', ip: '10.9.9.1/24', vlan: '' }],
    };
    const lines = ifaceLines(convertToSrxSetCommands(cfg, MAPPINGS, null)).join('\n');
    expect(lines).not.toMatch(/flexible-vlan-tagging/);
    expect(lines).toContain('set interfaces ge-0/0/3 unit 0 family inet address 10.9.9.1/24');
  });
});
