import React, { useState, useCallback } from 'react';
import { useConfigContext } from '../../contexts/ConfigContext.jsx';
import { useConversionContext } from '../../contexts/ConversionContext.jsx';
import { useUIContext } from '../../contexts/UIContext.jsx';
import useSectionAcceptance from '../../hooks/useSectionAcceptance.js';

/* ── Inline SVG Icons (16x16, stroke-based) ──────────────────────── */
const ICONS = {
  import: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  review: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  configure: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  validate: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  export: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  operate: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
};

/* ── Stage numbers for workflow navigation ──────────────────────── */
const STAGE_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥'];

/* ── Navigation structure (workflow-based) ──────────────────────── */
const NAV_STRUCTURE = [
  { id: 'stage-import', label: 'Import', icon: 'import', stageIndex: 0, children: [
    { id: 'import', label: 'Config Input' },
    { id: 'sanitized', label: 'Sanitized Objects', sanitizedCount: true },
  ]},
  { id: 'stage-review', label: 'Review', icon: 'review', stageIndex: 1, children: [
    { id: 'rules', label: 'Policies', countKey: 'security_policies', actionable: true },
    { id: 'nat', label: 'NAT Rules', countKey: 'nat_rules' },
    { id: 'zones', label: 'Zones', countKey: 'zones' },
    { id: 'objects', label: 'Objects', countFn: (ic) =>
      (ic?.address_objects?.length || 0) +
      (ic?.service_objects?.length || 0) +
      (ic?.applications?.length || 0)
    },
    { id: 'analysis', label: 'Analysis', countFn: (ic) => ic?._analysisFindings?.reduce((s, f) => s + f.count, 0) || 0, actionable: true },
    { id: 'dependency-graph', label: 'Dependency Graph' },
  ]},
  { id: 'stage-configure', label: 'Configure', icon: 'configure', stageIndex: 2, children: [
    { id: 'routing', label: 'Interfaces & Routing', countFn: (ic) =>
      (ic?.interfaces?.length || 0) + (ic?.static_routes?.length || 0)
    },
    { id: 'vpn', label: 'VPN', countKey: 'vpn_tunnels' },
    { id: 'screen', label: 'Screens', countKey: 'screen_config' },
    { id: 'decryption', label: 'SSL Decrypt', countKey: 'decryption_rules' },
    { id: 'pbf', label: 'PBF', countKey: 'pbf_rules' },
    { id: 'ha', label: 'HA', countFn: (ic) => ic?.ha_config?.enabled ? 1 : 0 },
    { id: 'qos', label: 'QoS', countKey: 'qos_config' },
    { id: 'syslog', label: 'Syslog', countKey: 'syslog_config' },
    { id: 'snmp', label: 'SNMP', countKey: 'snmp_config' },
    { id: 'aaa', label: 'AAA', countKey: 'aaa_config' },
    { id: 'dhcp', label: 'DHCP', countKey: 'dhcp_config' },
    { id: 'flow-monitoring', label: 'Flow Monitoring', countFn: (ic) => ic?.flow_monitoring_config?.collectors?.length || 0 },
  ]},
  { id: 'stage-validate', label: 'Validate', icon: 'validate', stageIndex: 3, children: [
    { id: 'warnings', label: 'Warnings', warnCount: true, actionable: true },
    { id: 'checklist', label: 'Checklist', actionable: true, countFn: (ic) => {
      if (!ic) return 0;
      let count = 0;
      const policies = ic.security_policies || [];
      const allText = JSON.stringify(ic);
      if (allText.includes('certificate') || allText.includes('ssl-') || (ic.decryption_rules || []).length > 0) count++;
      if (policies.some(p => (p.source_users || []).some(u => u !== 'any'))) count++;
      if (policies.some(p => (p.profiles || []).some(pr => pr.includes('idp') || pr.includes('ips')))) count++;
      if (allText.includes('secint') || allText.includes('secintel') || allText.includes('threat-intelligence')) count++;
      if (allText.includes('radius') || allText.includes('tacacs')) count++;
      if ((ic.vpn_tunnels || []).length > 0) count++;
      if ((ic.nat_rules || []).length > 0) count++;
      return count;
    }},
    { id: 'diff', label: 'Diff View' },
  ]},
  { id: 'stage-export', label: 'Export', icon: 'export', stageIndex: 4, children: [
    { id: 'output', label: 'SRX Config' },
    { id: 'report', label: 'Report' },
  ]},
  { id: 'stage-operate', label: 'Operate', icon: 'operate', stageIndex: 5, children: [
    { id: 'day2ops', label: 'Day 2 Ops' },
    { id: 'batch', label: 'Batch Migration' },
  ]},
];

/* ── Helper: get count for a child item ──────────────────────────── */
function getCount(child, intermediateConfig) {
  if (child.countFn) return child.countFn(intermediateConfig);
  if (child.countKey) {
    const val = intermediateConfig?.[child.countKey];
    if (Array.isArray(val)) return val.length;
    if (val && typeof val === 'object') return 1;
    return 0;
  }
  return 0;
}

/* ── NavTree Component ───────────────────────────────────────────── */
export default function NavTree({ collapsed }) {
  const { state: cfg } = useConfigContext();
  const { state: conv } = useConversionContext();
  const { state: ui, dispatch: uiDispatch } = useUIContext();

  const { intermediateConfig, isSanitized, sanitizationTable } = cfg;
  const { convertWarnings } = conv;
  const { editTab } = ui;
  const sanitizedCount = (isSanitized && sanitizationTable?.length) || 0;

  // Restore expanded groups from localStorage, default to all expanded
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('nav-expanded-stages');
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* ignore */ }
    return new Set(NAV_STRUCTURE.map(g => g.id));
  });

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      try { localStorage.setItem('nav-expanded-stages', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setTab = useCallback((tabId) => {
    uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: tabId });
  }, [uiDispatch]);

  const warnCount = convertWarnings?.length || 0;
  const acceptance = useSectionAcceptance();

  return (
    <ul className="nav-tree">
      {NAV_STRUCTURE.map(group => {
        const isExpanded = expandedGroups.has(group.id);
        const groupReviewClass = acceptance.groups?.[group.id] === true ? ' nav-review-done'
          : acceptance.groups?.[`_${group.id}HasContent`] ? ' nav-review-pending'
          : '';

        return (
          <li key={group.id} className={`nav-group${isExpanded ? '' : ' collapsed'}`}>
            <button
              className={`nav-group-header${groupReviewClass}`}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="arrow">{'\u25BC'}</span>
              <span className="stage-number">{STAGE_NUMBERS[group.stageIndex]}</span>
              <span className="group-icon">{ICONS[group.icon]}</span>
              <span>{group.label}</span>
            </button>
            <ul className="nav-group-items">
              {group.children.map(child => {
                // Hide Sanitized Objects when there's nothing to show
                if (child.sanitizedCount && sanitizedCount === 0) return null;

                const count = child.sanitizedCount
                  ? sanitizedCount
                  : child.warnCount ? warnCount : getCount(child, intermediateConfig);
                const reviewClass = acceptance.items?.[child.id] === true ? ' nav-review-done'
                  : acceptance.hasContent?.[child.id] ? ' nav-review-pending'
                  : '';
                const badgeClass = child.warnCount && warnCount > 0
                  ? ' warn'
                  : child.actionable ? ' actionable' : '';
                return (
                  <li
                    key={child.id}
                    className={`nav-item${editTab === child.id ? ' active' : ''}${reviewClass}`}
                    onClick={() => setTab(child.id)}
                  >
                    <span>{child.label}</span>
                    {count > 0 && (
                      <span className={`nav-badge${badgeClass}`}>
                        {count}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
