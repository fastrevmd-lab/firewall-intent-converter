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
