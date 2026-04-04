/**
 * MigrationChecklist Component
 *
 * Auto-generates pre/post migration task checklist based on parsed config features.
 * Scans intermediate config for features that need manual attention:
 *   - Certificates (SSL decryption needs import)
 *   - User-ID / JIMS (needs server config)
 *   - IDP/IPS signatures (needs update)
 *   - SecIntel (needs license)
 *   - RADIUS/TACACS+ (needs server config)
 *   - VPN tunnels (needs peer coordination)
 *   - NAT rules (needs IP verification)
 *
 * Checkbox state persists in localStorage keyed by site name.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * @typedef {Object} ChecklistItem
 * @property {string} id - Unique item identifier
 * @property {string} category - 'pre' or 'post'
 * @property {string} title - Short task title
 * @property {string} detail - Longer description
 * @property {string} severity - 'required' | 'recommended' | 'optional'
 */

/**
 * Scans intermediate config and generates checklist items.
 * @param {Object} intermediateConfig - The parsed intermediate configuration
 * @returns {ChecklistItem[]}
 */
function generateChecklist(intermediateConfig) {
  if (!intermediateConfig) return [];

  const items = [];
  const allText = JSON.stringify(intermediateConfig).toLowerCase();
  const policies = intermediateConfig.security_policies || [];
  const natRules = intermediateConfig.nat_rules || [];
  const vpnTunnels = intermediateConfig.vpn_tunnels || [];
  const decryptionRules = intermediateConfig.decryption_rules || [];

  // --- Certificates / SSL Decryption ---
  const hasCerts = decryptionRules.length > 0
    || allText.includes('certificate')
    || allText.includes('ssl-forward-proxy')
    || allText.includes('ssl-inbound');
  if (hasCerts) {
    items.push({
      id: 'cert-import',
      category: 'pre',
      title: 'Import SSL/TLS certificates',
      detail: 'Config references certificates or SSL decryption rules. Import CA and server certificates to the SRX before deployment.',
      severity: 'required',
    });
    items.push({
      id: 'cert-verify',
      category: 'post',
      title: 'Verify SSL proxy profiles',
      detail: 'After import, confirm ssl-forward-proxy and ssl-inbound-inspection profiles reference the correct certificate names.',
      severity: 'required',
    });
  }

  // --- User-ID / JIMS ---
  const hasUserIdPolicies = policies.some(p =>
    (p.source_users || []).some(u => u !== 'any' && u !== 'unknown')
  );
  if (hasUserIdPolicies) {
    items.push({
      id: 'jims-config',
      category: 'pre',
      title: 'Configure JIMS (Juniper Identity Management Service)',
      detail: 'Policies reference source users. Configure JIMS or integrated user firewall to provide user-to-IP mappings on the SRX.',
      severity: 'required',
    });
    items.push({
      id: 'jims-ad',
      category: 'pre',
      title: 'Verify Active Directory integration',
      detail: 'Ensure the SRX or JIMS server can reach the AD domain controller for user identity lookups.',
      severity: 'required',
    });
  }

  // --- IDP / IPS Signatures ---
  const hasIdp = policies.some(p =>
    (p.profiles || []).some(pr => {
      const lower = (pr || '').toLowerCase();
      return lower.includes('idp') || lower.includes('ips') || lower.includes('intrusion');
    })
  ) || allText.includes('"idp"') || allText.includes('idp-policy');
  if (hasIdp) {
    items.push({
      id: 'idp-license',
      category: 'pre',
      title: 'Verify IDP license',
      detail: 'IDP/IPS profiles detected. Ensure the SRX has an active IDP feature license before enabling signature-based inspection.',
      severity: 'required',
    });
    items.push({
      id: 'idp-sig-update',
      category: 'post',
      title: 'Update IDP signature database',
      detail: 'After deployment, run "request security idp security-package download" and install the latest signatures.',
      severity: 'required',
    });
  }

  // --- SecIntel / Threat Intelligence ---
  const hasSecIntel = allText.includes('secintel')
    || allText.includes('secint')
    || allText.includes('threat-intelligence')
    || allText.includes('threat_intelligence')
    || allText.includes('c2-feed')
    || allText.includes('infected-hosts');
  if (hasSecIntel) {
    items.push({
      id: 'secintel-license',
      category: 'pre',
      title: 'Verify SecIntel / ATP Cloud license',
      detail: 'Threat intelligence feeds detected. Ensure the SRX has an active SecIntel or ATP Cloud license.',
      severity: 'required',
    });
    items.push({
      id: 'secintel-feeds',
      category: 'post',
      title: 'Enable SecIntel feed subscriptions',
      detail: 'Configure and verify SecIntel feeds (C&C, infected-hosts, custom feeds) are downloading successfully.',
      severity: 'recommended',
    });
  }

  // --- RADIUS / TACACS+ ---
  const hasRadius = allText.includes('radius') || allText.includes('tacacs');
  const hasAaaConfig = (ic?.aaa_config || []).length > 0;
  if (hasRadius) {
    if (hasAaaConfig) {
      items.push({
        id: 'radius-config',
        category: 'pre',
        title: 'Verify AAA server shared secrets',
        detail: 'AAA servers were auto-converted. Shared secrets may be sanitized — verify and replace with correct values before deployment.',
        severity: 'required',
      });
    } else {
      items.push({
        id: 'radius-config',
        category: 'pre',
        title: 'Configure RADIUS/TACACS+ server',
        detail: 'Authentication server references detected but no AAA config was extracted. Configure the SRX system access profile with the correct server addresses and shared secrets.',
        severity: 'required',
      });
    }
    items.push({
      id: 'radius-test',
      category: 'post',
      title: 'Test authentication server reachability',
      detail: 'Verify RADIUS/TACACS+ servers are reachable from the SRX management plane using "test system authentication".',
      severity: 'recommended',
    });
  }

  // --- VPN Tunnels ---
  if (vpnTunnels.length > 0) {
    items.push({
      id: 'vpn-peer-coord',
      category: 'pre',
      title: `Coordinate with ${vpnTunnels.length} VPN peer(s)`,
      detail: 'VPN tunnels require coordination with remote peers. Verify IKE proposals, pre-shared keys, and peer IP addresses before cutover.',
      severity: 'required',
    });
    items.push({
      id: 'vpn-verify',
      category: 'post',
      title: 'Verify VPN tunnel establishment',
      detail: 'After deployment, confirm all IPsec tunnels come up with "show security ike security-associations" and "show security ipsec security-associations".',
      severity: 'required',
    });
  }

  // --- NAT Rules ---
  if (natRules.length > 0) {
    items.push({
      id: 'nat-ips',
      category: 'pre',
      title: 'Verify NAT IP address pools',
      detail: `${natRules.length} NAT rule(s) detected. Verify that source/destination NAT pool addresses are valid and routable from the SRX.`,
      severity: 'required',
    });
    items.push({
      id: 'nat-proxy-arp',
      category: 'post',
      title: 'Configure proxy ARP for NAT pools',
      detail: 'If using destination NAT or static NAT with addresses not on a directly connected subnet, configure proxy ARP.',
      severity: 'recommended',
    });
  }

  // --- HA Configuration ---
  if (intermediateConfig.ha_config?.enabled) {
    items.push({
      id: 'ha-fabric',
      category: 'pre',
      title: 'Prepare HA fabric/ICL cabling',
      detail: 'HA is enabled. Ensure physical cables are connected for fabric (chassis cluster) or ICL (MNHA) links before deployment.',
      severity: 'required',
    });
    items.push({
      id: 'ha-failover-test',
      category: 'post',
      title: 'Test HA failover',
      detail: 'After deployment, perform a controlled failover to verify redundancy group transitions and traffic continuity.',
      severity: 'recommended',
    });
  }

  // --- Static Routes ---
  if ((intermediateConfig.static_routes || []).length > 0) {
    items.push({
      id: 'routes-verify',
      category: 'post',
      title: 'Verify routing table',
      detail: `${intermediateConfig.static_routes.length} static route(s) converted. Verify next-hop reachability and route preferences after deployment.`,
      severity: 'recommended',
    });
  }

  // --- Syslog ---
  if (intermediateConfig.syslog_config) {
    items.push({
      id: 'syslog-test',
      category: 'post',
      title: 'Verify syslog forwarding',
      detail: 'Syslog configuration detected. After deployment, confirm log messages are reaching the syslog collector.',
      severity: 'recommended',
    });
  }

  // --- General items always present ---
  items.push({
    id: 'backup-source',
    category: 'pre',
    title: 'Backup source firewall configuration',
    detail: 'Save a full backup of the current source firewall config before making any changes.',
    severity: 'required',
  });
  items.push({
    id: 'change-window',
    category: 'pre',
    title: 'Schedule maintenance window',
    detail: 'Coordinate a change window for the migration cutover to minimize user impact.',
    severity: 'recommended',
  });
  items.push({
    id: 'connectivity-test',
    category: 'post',
    title: 'Run connectivity smoke tests',
    detail: 'After deployment, test critical application flows, DNS resolution, and internet access from key network segments.',
    severity: 'required',
  });
  items.push({
    id: 'monitor-logs',
    category: 'post',
    title: 'Monitor security logs for 24-48 hours',
    detail: 'Watch for unexpected denies, policy mismatches, or session drops in the first 24-48 hours after migration.',
    severity: 'recommended',
  });

  return items;
}

const STORAGE_KEY = 'migration-checklist-state';

/** @param {string} siteName */
function loadCheckedState(siteName) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${siteName || 'default'}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** @param {string} siteName @param {Object} state */
function saveCheckedState(siteName, state) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${siteName || 'default'}`, JSON.stringify(state));
  } catch { /* ignore */ }
}

const SEVERITY_STYLES = {
  required: { color: 'var(--error)', label: 'Required' },
  recommended: { color: 'var(--caution)', label: 'Recommended' },
  optional: { color: 'var(--text-muted)', label: 'Optional' },
};

export default function MigrationChecklist({ intermediateConfig, siteName }) {
  const items = useMemo(() => generateChecklist(intermediateConfig), [intermediateConfig]);
  const [checked, setChecked] = useState(() => loadCheckedState(siteName));

  useEffect(() => {
    saveCheckedState(siteName, checked);
  }, [checked, siteName]);

  const toggleItem = useCallback((id) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
  }, []);

  const preItems = items.filter(i => i.category === 'pre');
  const postItems = items.filter(i => i.category === 'post');
  const totalCount = items.length;
  const doneCount = items.filter(i => checked[i.id]).length;

  if (!intermediateConfig) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <h3>No configuration loaded</h3>
          <p>Parse a configuration to generate a migration checklist.</p>
        </div>
      </div>
    );
  }

  const renderSection = (title, sectionItems) => (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        {title}
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
          {sectionItems.filter(i => checked[i.id]).length}/{sectionItems.length} done
        </span>
      </h3>
      {sectionItems.map(item => {
        const sev = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.optional;
        const isDone = checked[item.id];
        return (
          <div
            key={item.id}
            onClick={() => toggleItem(item.id)}
            style={{
              display: 'flex', gap: 10, padding: '8px 12px', marginBottom: 4,
              background: isDone ? 'rgba(52, 211, 153, 0.06)' : 'var(--bg-secondary)',
              borderRadius: 'var(--radius)', cursor: 'pointer',
              border: '1px solid var(--border-color)',
              opacity: isDone ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <input
              type="checkbox"
              checked={!!isDone}
              onChange={() => toggleItem(item.id)}
              onClick={(e) => e.stopPropagation()}
              style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  textDecoration: isDone ? 'line-through' : 'none',
                  color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                }}>
                  {item.title}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                  padding: '1px 5px', borderRadius: 3,
                  color: sev.color,
                  background: `color-mix(in srgb, ${sev.color} 15%, transparent)`,
                }}>
                  {sev.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                {item.detail}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--caution)" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
        <h2 style={{ margin: 0, fontSize: 16 }}>Migration Checklist</h2>
        <span className="stat-badge">{doneCount}/{totalCount} complete</span>
        {doneCount === totalCount && totalCount > 0 && (
          <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>All done!</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', marginBottom: 16, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
          background: doneCount === totalCount ? 'var(--success)' : 'var(--accent)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {preItems.length > 0 && renderSection('Pre-Migration Tasks', preItems)}
      {postItems.length > 0 && renderSection('Post-Migration Tasks', postItems)}
    </div>
  );
}
