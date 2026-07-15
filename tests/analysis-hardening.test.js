/**
 * Tests for device-plane & VPN hardening checks (GitHub issue #48, Group B)
 * Three new checks: weak_ike, weak_ipsec, no_screen
 */
import { describe, test, expect } from 'vitest';
import { AnalysisEngine } from '../src/analysis/config-analyzer.js';

describe('Hardening checks (issue #48 Group B)', () => {
  describe('weak_ike', () => {
    test('flags tunnel with weak DH group', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group2',
              encryption: 'aes-256-gcm',
              authentication: 'sha256',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.id).toBe('weak_ike');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].label).toMatch(/vpn1/);
      expect(result.items[0].label).toMatch(/DH group 2/);
      expect(result.description).toMatch(/1 VPN tunnel/);
    });

    test('flags tunnel with weak encryption (3des)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: '3des',
              authentication: 'sha256',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/3des/);
    });

    test('flags tunnel with weak authentication (md5)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: 'aes-256-gcm',
              authentication: 'md5',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/md5/);
    });

    test('flags tunnel with comma-separated crypto list containing weak cipher', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: 'aes-256-cbc,3des',
              authentication: 'sha256',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/3des/);
    });

    test('flags tunnel with multiple weaknesses', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group2',
              encryption: '3des',
              authentication: 'md5',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/DH group 2/);
      expect(result.items[0].label).toMatch(/3des/);
      expect(result.items[0].label).toMatch(/md5/);
    });

    test('flags vendor-normalized weak encryption (3des-cbc)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: '3des-cbc',
              authentication: 'sha256',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/3des-cbc/);
    });

    test('flags vendor-normalized weak encryption (des-cbc)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: 'des-cbc',
              authentication: 'sha256',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/des-cbc/);
    });

    test('flags vendor-normalized weak authentication (hmac-md5-96)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: 'aes-256-gcm',
              authentication: 'hmac-md5-96',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/hmac-md5-96/);
    });

    test('flags vendor-normalized weak authentication (hmac-sha1-96)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: 'aes-256-gcm',
              authentication: 'hmac-sha1-96',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/hmac-sha1-96/);
    });

    test('does not flag tunnel with strong crypto', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: 'aes-256-gcm',
              authentication: 'sha256',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(0);
      expect(result.description).toMatch(/No VPN tunnels.*weak IKE crypto/);
    });

    test('does not flag aes-128-cbc as weak (no des substring)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: 'aes-128-cbc',
              authentication: 'sha256',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(0);
    });

    test('does not flag hmac-sha2-256 as weak (sha1 not a substring)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group14',
              encryption: 'aes-256-gcm',
              authentication: 'hmac-sha2-256',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(0);
    });

    test('does not flag sha384 as weak', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ike_proposal: {
              dh_group: 'group20',
              encryption: 'aes-256-gcm',
              authentication: 'sha384',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(0);
    });

    test('handles missing vpn_tunnels array', () => {
      const config = {};
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(0);
    });

    test('handles tunnel without ike_proposal', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
          },
        ],
      };
      const result = AnalysisEngine._weakIke(config);
      expect(result.count).toBe(0);
    });
  });

  describe('weak_ipsec', () => {
    test('flags tunnel with weak encryption', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: '3des',
              authentication: 'sha256',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.id).toBe('weak_ipsec');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].label).toMatch(/vpn1/);
      expect(result.items[0].label).toMatch(/3des/);
    });

    test('flags tunnel with weak authentication', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'md5',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/md5/);
    });

    test('flags tunnel with no PFS (empty string)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'sha256',
              pfs_group: '',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/no PFS/);
    });

    test('flags tunnel with PFS disabled (none)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'sha256',
              pfs_group: 'none',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/no PFS/);
    });

    test('flags tunnel with PFS disabled (group0)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'sha256',
              pfs_group: 'group0',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/no PFS/);
    });

    test('flags tunnel with multiple weaknesses including no PFS', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: '3des',
              authentication: 'md5',
              pfs_group: '',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/3des/);
      expect(result.items[0].label).toMatch(/md5/);
      expect(result.items[0].label).toMatch(/no PFS/);
    });

    test('flags tunnel with strong crypto but no PFS', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'sha256',
              pfs_group: 'disabled',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/no PFS/);
    });

    test('flags vendor-normalized weak encryption (3des-cbc)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: '3des-cbc',
              authentication: 'sha256',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/3des-cbc/);
    });

    test('flags vendor-normalized weak encryption (des-cbc)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'des-cbc',
              authentication: 'sha256',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/des-cbc/);
    });

    test('flags vendor-normalized weak authentication (hmac-md5-96)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'hmac-md5-96',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/hmac-md5-96/);
    });

    test('flags vendor-normalized weak authentication (hmac-sha1-96)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'hmac-sha1-96',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toMatch(/hmac-sha1-96/);
    });

    test('does not flag tunnel with strong crypto and PFS', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'sha256',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(0);
      expect(result.description).toMatch(/No VPN tunnels.*weak IPsec crypto/);
    });

    test('does not flag aes-128-cbc as weak (no des substring)', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-128-cbc',
              authentication: 'sha256',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(0);
    });

    test('does not flag hmac-sha2-256 as weak', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'hmac-sha2-256',
              pfs_group: 'group20',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(0);
    });

    test('does not flag sha512 as weak', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
            ipsec_proposal: {
              encryption: 'aes-256-gcm',
              authentication: 'sha512',
              pfs_group: 'group14',
            },
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(0);
    });

    test('handles missing vpn_tunnels array', () => {
      const config = {};
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(0);
    });

    test('handles tunnel without ipsec_proposal', () => {
      const config = {
        vpn_tunnels: [
          {
            name: 'vpn1',
          },
        ],
      };
      const result = AnalysisEngine._weakIpsec(config);
      expect(result.count).toBe(0);
    });
  });

  describe('no_screen', () => {
    test('flags external zone without screen binding', () => {
      const config = {
        zones: [
          { name: 'untrust' },
          { name: 'untrust-bare' },
          { name: 'trust' },
        ],
        screen_config: [
          {
            name: 'dos-policy-1',
            zone: 'untrust',
          },
        ],
      };
      const result = AnalysisEngine._zonesWithoutScreen(config);
      expect(result.count).toBe(1);
      expect(result.id).toBe('no_screen');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].label).toBe('untrust-bare');
      expect(result.description).toMatch(/1 external.*zone.*no screen/);
    });

    test('flags multiple external zones without screen', () => {
      const config = {
        zones: [
          { name: 'untrust' },
          { name: 'internet' },
          { name: 'wan' },
          { name: 'trust' },
        ],
        screen_config: [
          {
            name: 'dos-policy-1',
            zone: 'untrust',
          },
        ],
      };
      const result = AnalysisEngine._zonesWithoutScreen(config);
      expect(result.count).toBe(2);
      expect(result.items.map(i => i.label).sort()).toEqual(['internet', 'wan']);
    });

    test('does not flag internal zones without screen', () => {
      const config = {
        zones: [
          { name: 'trust' },
          { name: 'dmz' },
          { name: 'servers' },
        ],
        screen_config: [],
      };
      const result = AnalysisEngine._zonesWithoutScreen(config);
      expect(result.count).toBe(0);
    });

    test('does not flag external zone with screen binding', () => {
      const config = {
        zones: [
          { name: 'untrust' },
          { name: 'internet' },
        ],
        screen_config: [
          {
            name: 'dos-policy-1',
            zone: 'untrust',
          },
          {
            name: 'dos-policy-2',
            zone: 'internet',
          },
        ],
      };
      const result = AnalysisEngine._zonesWithoutScreen(config);
      expect(result.count).toBe(0);
      expect(result.description).toMatch(/All external.*zones have screen/);
    });

    test('ignores screen_config entries with empty zone', () => {
      const config = {
        zones: [
          { name: 'untrust' },
          { name: 'internet' },
        ],
        screen_config: [
          {
            name: 'dos-policy-global',
            zone: '',
          },
          {
            name: 'dos-policy-1',
            zone: 'untrust',
          },
        ],
      };
      const result = AnalysisEngine._zonesWithoutScreen(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toBe('internet');
    });

    test('handles missing zones array', () => {
      const config = {
        screen_config: [],
      };
      const result = AnalysisEngine._zonesWithoutScreen(config);
      expect(result.count).toBe(0);
    });

    test('handles missing screen_config array', () => {
      const config = {
        zones: [
          { name: 'untrust' },
        ],
      };
      const result = AnalysisEngine._zonesWithoutScreen(config);
      expect(result.count).toBe(1);
      expect(result.items[0].label).toBe('untrust');
    });

    test('handles empty zones array', () => {
      const config = {
        zones: [],
        screen_config: [],
      };
      const result = AnalysisEngine._zonesWithoutScreen(config);
      expect(result.count).toBe(0);
    });
  });
});
