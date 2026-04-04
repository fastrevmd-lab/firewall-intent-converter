/**
 * ConversionReport Component
 *
 * Tabbed interface providing 8 reporting/summary sections that document
 * the conversion process. Lives under the Output section in the sidebar.
 *
 * Sections:
 *   1. Rule Count Comparison
 *   2. Unused Objects Summary
 *   3. Shadowed Rules Summary
 *   4. AI-Disabled Rules Report
 *   5. Migration Delta Dashboard
 *   6. Exportable Migration Summary
 *   7. Per-Command Conversion Report
 *   8. Rollback Plan Generation
 */
import React, { useState, useMemo, useCallback } from 'react';
import ExportPdfButton from './ExportPdfButton.jsx';

/* ── Tab definitions ──────────────────────────────────────────────── */
const TABS = [
  { id: 'rule-count', label: 'Rule Counts' },
  { id: 'unused-objects', label: 'Unused Objects' },
  { id: 'shadowed', label: 'Shadowed Rules' },
  { id: 'ai-disabled', label: 'AI-Disabled' },
  { id: 'delta', label: 'Migration Delta' },
  { id: 'summary', label: 'Migration Summary' },
  { id: 'per-command', label: 'Per-Command' },
  { id: 'rollback', label: 'Rollback Plan' },
];

/* ── SVG icons for empty states ───────────────────────────────────── */
const EMPTY_ICONS = {
  'rule-count': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  'unused-objects': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <line x1="3.27" y1="6.96" x2="12" y2="12.01" /><line x1="20.73" y1="6.96" x2="12" y2="12.01" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  'shadowed': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 010 20" fill="currentColor" opacity="0.1" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  'ai-disabled': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
      <line x1="12" y1="15" x2="12" y2="18" />
    </svg>
  ),
  'delta': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  'summary': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  'per-command': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  'rollback': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  ),
};

const EMPTY_DESCRIPTIONS = {
  'rule-count': 'Convert your configuration to see a rule count comparison between source and converted output.',
  'unused-objects': 'Convert your configuration to identify address and service objects not referenced by any policy.',
  'shadowed': 'Convert your configuration to detect rules that are fully shadowed by earlier rules.',
  'ai-disabled': 'Use the LLM translation workflow to identify rules disabled by AI with rationale.',
  'delta': 'Convert your configuration to see a summary of all changes made during migration.',
  'summary': 'Convert your configuration to generate an exportable migration summary for change management.',
  'per-command': 'Convert your configuration to see per-rule decision tracking.',
  'rollback': 'Convert your configuration to auto-generate rollback delete commands.',
};

const EMPTY_HEADINGS = {
  'rule-count': 'No conversion data',
  'unused-objects': 'No object data',
  'shadowed': 'No shadow analysis',
  'ai-disabled': 'No AI-reviewed rules',
  'delta': 'No migration data',
  'summary': 'No summary available',
  'per-command': 'No conversion report',
  'rollback': 'No rollback plan',
};

/**
 * @param {Object} props
 * @param {Object|null} props.intermediateConfig - Parsed source config
 * @param {Array|null} props.srxTranslatedPolicies - LLM-translated policies (SRX view)
 * @param {Object|null} props.srxOutput - Converted SRX output { commands, xml }
 * @param {Array} props.warnings - Combined parse + convert warnings
 * @param {Object|null} props.conversionSummary - Summary stats from converter
 * @param {boolean} props.isParsed - Whether a config has been parsed
 */
export default function ConversionReport({
  intermediateConfig,
  srxTranslatedPolicies,
  srxOutput,
  warnings,
  conversionSummary,
  isParsed,
}) {
  const [activeTab, setActiveTab] = useState('rule-count');

  // --- Not yet parsed ---
  if (!isParsed) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <h3>Conversion Report</h3>
        <p>Load and convert a configuration to see detailed reporting and migration summaries.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '2px', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`format-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ExportPdfButton />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {activeTab === 'rule-count' && (
          <RuleCountTab
            intermediateConfig={intermediateConfig}
            srxTranslatedPolicies={srxTranslatedPolicies}
            conversionSummary={conversionSummary}
          />
        )}
        {activeTab === 'unused-objects' && (
          <UnusedObjectsTab intermediateConfig={intermediateConfig} />
        )}
        {activeTab === 'shadowed' && (
          <ShadowedRulesTab warnings={warnings} intermediateConfig={intermediateConfig} srxTranslatedPolicies={srxTranslatedPolicies} />
        )}
        {activeTab === 'ai-disabled' && (
          <AIDisabledTab srxTranslatedPolicies={srxTranslatedPolicies} />
        )}
        {activeTab === 'delta' && (
          <MigrationDeltaTab
            intermediateConfig={intermediateConfig}
            srxTranslatedPolicies={srxTranslatedPolicies}
            srxOutput={srxOutput}
            warnings={warnings}
            conversionSummary={conversionSummary}
          />
        )}
        {activeTab === 'summary' && (
          <MigrationSummaryTab
            intermediateConfig={intermediateConfig}
            srxTranslatedPolicies={srxTranslatedPolicies}
            srxOutput={srxOutput}
            warnings={warnings}
            conversionSummary={conversionSummary}
          />
        )}
        {activeTab === 'per-command' && (
          <PerCommandTab
            intermediateConfig={intermediateConfig}
            srxTranslatedPolicies={srxTranslatedPolicies}
          />
        )}
        {activeTab === 'rollback' && (
          <RollbackTab srxOutput={srxOutput} />
        )}
      </div>
    </div>
  );
}

/* ── Empty state helper ───────────────────────────────────────────── */
function EmptyState({ tabId }) {
  return (
    <div className="empty-state">
      {EMPTY_ICONS[tabId]}
      <h3>{EMPTY_HEADINGS[tabId]}</h3>
      <p>{EMPTY_DESCRIPTIONS[tabId]}</p>
    </div>
  );
}

/* ── 1. Rule Count Comparison ─────────────────────────────────────── */
function RuleCountTab({ intermediateConfig, srxTranslatedPolicies, conversionSummary }) {
  const data = useMemo(() => {
    const srcPolicies = intermediateConfig?.security_policies || [];
    const dstPolicies = srxTranslatedPolicies || srcPolicies;

    if (srcPolicies.length === 0) return null;

    const srcTotal = srcPolicies.length;
    const dstTotal = dstPolicies.length;

    // Breakdown by action
    const countByAction = (policies) => {
      const result = { permit: 0, deny: 0, other: 0 };
      for (const policy of policies) {
        const action = (policy.action || '').toLowerCase();
        if (action === 'allow' || action === 'permit') result.permit++;
        else if (action === 'deny' || action === 'drop' || action === 'reject') result.deny++;
        else result.other++;
      }
      return result;
    };

    // Breakdown by zone pair
    const countByZonePair = (policies) => {
      const pairs = {};
      for (const policy of policies) {
        const srcZone = (policy.src_zones || ['any']).join(',');
        const dstZone = (policy.dst_zones || ['any']).join(',');
        const key = `${srcZone} -> ${dstZone}`;
        pairs[key] = (pairs[key] || 0) + 1;
      }
      return pairs;
    };

    // Disabled count
    const countDisabled = (policies) => policies.filter(p => p.disabled).length;

    const srcActions = countByAction(srcPolicies);
    const dstActions = countByAction(dstPolicies);
    const srcZones = countByZonePair(srcPolicies);
    const dstZones = countByZonePair(dstPolicies);
    const srcDisabled = countDisabled(srcPolicies);
    const dstDisabled = countDisabled(dstPolicies);

    return { srcTotal, dstTotal, srcActions, dstActions, srcZones, dstZones, srcDisabled, dstDisabled };
  }, [intermediateConfig, srxTranslatedPolicies]);

  if (!data) return <EmptyState tabId="rule-count" />;

  const delta = data.dstTotal - data.srcTotal;
  const allZonePairs = [...new Set([...Object.keys(data.srcZones), ...Object.keys(data.dstZones)])];

  return (
    <div className="report-section">
      <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Rule Count Comparison</h3>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard label="Source Rules" value={data.srcTotal} />
        <StatCard label="Converted Rules" value={data.dstTotal} />
        <StatCard
          label="Delta"
          value={`${delta > 0 ? '+' : ''}${delta}`}
          color={delta === 0 ? 'var(--success)' : 'var(--caution)'}
        />
        <StatCard label="Source Disabled" value={data.srcDisabled} />
        <StatCard label="Converted Disabled" value={data.dstDisabled} />
      </div>

      {/* Action breakdown */}
      <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>By Action</h4>
      <table className="report-table" style={{ marginBottom: 16 }}>
        <thead>
          <tr><th>Action</th><th>Source</th><th>Converted</th><th>Delta</th></tr>
        </thead>
        <tbody>
          {['permit', 'deny', 'other'].map(action => {
            const srcCount = data.srcActions[action];
            const dstCount = data.dstActions[action];
            const actionDelta = dstCount - srcCount;
            if (srcCount === 0 && dstCount === 0) return null;
            return (
              <tr key={action}>
                <td style={{ textTransform: 'capitalize' }}>{action}</td>
                <td>{srcCount}</td>
                <td>{dstCount}</td>
                <td style={{ color: actionDelta === 0 ? 'var(--text-muted)' : 'var(--caution)' }}>
                  {actionDelta > 0 ? '+' : ''}{actionDelta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Zone pair breakdown */}
      <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>By Zone Pair</h4>
      <table className="report-table">
        <thead>
          <tr><th>Zone Pair</th><th>Source</th><th>Converted</th><th>Delta</th></tr>
        </thead>
        <tbody>
          {allZonePairs.map(pair => {
            const srcCount = data.srcZones[pair] || 0;
            const dstCount = data.dstZones[pair] || 0;
            const pairDelta = dstCount - srcCount;
            return (
              <tr key={pair}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{pair}</td>
                <td>{srcCount}</td>
                <td>{dstCount}</td>
                <td style={{ color: pairDelta === 0 ? 'var(--text-muted)' : 'var(--caution)' }}>
                  {pairDelta > 0 ? '+' : ''}{pairDelta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── 2. Unused Objects Summary ────────────────────────────────────── */
function UnusedObjectsTab({ intermediateConfig }) {
  const { unusedAddresses, unusedServices } = useMemo(() => {
    if (!intermediateConfig) return { unusedAddresses: [], unusedServices: [] };

    const policies = intermediateConfig.security_policies || [];
    const natRules = intermediateConfig.nat_rules || [];
    const addressGroups = intermediateConfig.address_groups || [];

    // Collect all referenced address names
    const referencedAddresses = new Set();
    const referencedServices = new Set();

    for (const policy of policies) {
      for (const addr of (policy.src_addresses || [])) referencedAddresses.add(addr);
      for (const addr of (policy.dst_addresses || [])) referencedAddresses.add(addr);
      for (const svc of (policy.services || [])) referencedServices.add(svc);
      for (const app of (policy.applications || [])) referencedServices.add(app);
    }

    for (const rule of natRules) {
      for (const addr of (rule.src_addresses || [])) referencedAddresses.add(addr);
      for (const addr of (rule.dst_addresses || [])) referencedAddresses.add(addr);
    }

    // Address group members are also considered referenced
    for (const group of addressGroups) {
      for (const member of (group.members || [])) referencedAddresses.add(member);
    }

    const addressObjects = intermediateConfig.address_objects || [];
    const serviceObjects = intermediateConfig.service_objects || [];

    const unusedAddr = addressObjects.filter(obj => !referencedAddresses.has(obj.name));
    const unusedSvc = serviceObjects.filter(obj => !referencedServices.has(obj.name));

    return { unusedAddresses: unusedAddr, unusedServices: unusedSvc };
  }, [intermediateConfig]);

  if (!intermediateConfig) return <EmptyState tabId="unused-objects" />;

  const totalAddresses = intermediateConfig.address_objects?.length || 0;
  const totalServices = intermediateConfig.service_objects?.length || 0;

  if (unusedAddresses.length === 0 && unusedServices.length === 0) {
    return (
      <div className="report-section">
        <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Unused Objects Summary</h3>
        <div className="empty-state" style={{ padding: 24 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <h3>All objects referenced</h3>
          <p>All {totalAddresses} address objects and {totalServices} service objects are referenced by at least one policy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-section">
      <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Unused Objects Summary</h3>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard label="Unused Addresses" value={unusedAddresses.length} color="var(--caution)" />
        <StatCard label="Unused Services" value={unusedServices.length} color="var(--caution)" />
        <StatCard label="Total Addresses" value={totalAddresses} />
        <StatCard label="Total Services" value={totalServices} />
      </div>

      {unusedAddresses.length > 0 && (
        <>
          <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>Unused Address Objects ({unusedAddresses.length})</h4>
          <table className="report-table" style={{ marginBottom: 16 }}>
            <thead>
              <tr><th>Name</th><th>Type</th><th>Value</th></tr>
            </thead>
            <tbody>
              {unusedAddresses.map((obj, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{obj.name}</td>
                  <td>{obj.type || 'ip-netmask'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{obj.value || obj.ip_netmask || obj.fqdn || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {unusedServices.length > 0 && (
        <>
          <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>Unused Service Objects ({unusedServices.length})</h4>
          <table className="report-table">
            <thead>
              <tr><th>Name</th><th>Protocol</th><th>Port</th></tr>
            </thead>
            <tbody>
              {unusedServices.map((obj, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{obj.name}</td>
                  <td>{obj.protocol || '-'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{obj.port || obj.dst_port || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/* ── 3. Shadowed Rules Summary ────────────────────────────────────── */
function ShadowedRulesTab({ warnings, intermediateConfig, srxTranslatedPolicies }) {
  const shadowedRules = useMemo(() => {
    const results = [];

    // Check warnings for shadow-related entries
    const shadowWarnings = (warnings || []).filter(w =>
      /shadow/i.test(w.message || '') ||
      /shadow/i.test(w.element || '') ||
      /redundant/i.test(w.message || '')
    );

    for (const w of shadowWarnings) {
      results.push({ source: 'warning', element: w.element, message: w.message, severity: w.severity });
    }

    // Check policies for _shadow or _redundant flags
    const allPolicies = srxTranslatedPolicies || intermediateConfig?.security_policies || [];
    for (const policy of allPolicies) {
      if (policy._shadow || policy._redundant) {
        results.push({
          source: 'flag',
          element: policy.name,
          message: policy._shadow ? 'Rule is fully shadowed by a prior rule' : 'Rule is redundant',
          severity: 'warning',
        });
      }
    }

    return results;
  }, [warnings, intermediateConfig, srxTranslatedPolicies]);

  if (shadowedRules.length === 0) {
    return (
      <div className="report-section">
        <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Shadowed Rules Summary</h3>
        <div className="empty-state" style={{ padding: 24 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <h3>No shadowed rules detected</h3>
          <p>No rules appear to be fully shadowed or redundant in the current configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-section">
      <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Shadowed Rules Summary</h3>
      <div style={{ marginBottom: 16 }}>
        <StatCard label="Shadowed / Redundant" value={shadowedRules.length} color="var(--caution)" />
      </div>
      <table className="report-table">
        <thead>
          <tr><th>Rule</th><th>Issue</th><th>Source</th></tr>
        </thead>
        <tbody>
          {shadowedRules.map((rule, i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{rule.element || '-'}</td>
              <td>{rule.message}</td>
              <td>{rule.source === 'warning' ? 'Conversion Warning' : 'Policy Flag'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 4. AI-Disabled Rules Report ──────────────────────────────────── */
function AIDisabledTab({ srxTranslatedPolicies }) {
  const aiDisabledRules = useMemo(() => {
    if (!srxTranslatedPolicies) return [];
    return srxTranslatedPolicies.filter(
      p => p._review_status === 'llm_reviewed' && p.disabled === true
    );
  }, [srxTranslatedPolicies]);

  if (aiDisabledRules.length === 0) return <EmptyState tabId="ai-disabled" />;

  return (
    <div className="report-section">
      <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>AI-Disabled Rules Report</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        These rules were disabled by the LLM during translation. Review the rationale before accepting.
      </p>
      <div style={{ marginBottom: 16 }}>
        <StatCard label="AI-Disabled Rules" value={aiDisabledRules.length} color="var(--llm-cloud)" />
      </div>
      <table className="report-table">
        <thead>
          <tr><th>Rule Name</th><th>Action</th><th>Src Zones</th><th>Dst Zones</th><th>LLM Rationale</th></tr>
        </thead>
        <tbody>
          {aiDisabledRules.map((rule, i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{rule.name || `Rule ${i + 1}`}</td>
              <td>{rule.action || '-'}</td>
              <td style={{ fontSize: 12 }}>{(rule.src_zones || []).join(', ') || 'any'}</td>
              <td style={{ fontSize: 12 }}>{(rule.dst_zones || []).join(', ') || 'any'}</td>
              <td style={{ fontSize: 12, maxWidth: 300 }}>
                <span style={{ color: 'var(--llm-cloud)' }}>{rule._translation_notes || 'No rationale provided'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 5. Migration Delta Dashboard ─────────────────────────────────── */
function MigrationDeltaTab({ intermediateConfig, srxTranslatedPolicies, srxOutput, warnings, conversionSummary }) {
  const delta = useMemo(() => {
    if (!intermediateConfig) return null;

    const srcPolicies = intermediateConfig.security_policies || [];
    const dstPolicies = srxTranslatedPolicies || srcPolicies;

    // Rules added/removed/modified/disabled
    const srcNames = new Set(srcPolicies.map(p => p.name));
    const dstNames = new Set(dstPolicies.map(p => p.name));

    const added = dstPolicies.filter(p => !srcNames.has(p.name)).length;
    const removed = srcPolicies.filter(p => !dstNames.has(p.name)).length;
    const disabled = dstPolicies.filter(p => p.disabled).length;
    const srcDisabled = srcPolicies.filter(p => p.disabled).length;
    const newlyDisabled = disabled - srcDisabled;

    // Modified: rules that exist in both but have been LLM reviewed
    const modified = dstPolicies.filter(
      p => srcNames.has(p.name) && p._review_status === 'llm_reviewed'
    ).length;

    // Objects consolidated
    const srcAddressCount = intermediateConfig.address_objects?.length || 0;
    const srcServiceCount = intermediateConfig.service_objects?.length || 0;
    const convertedAddresses = conversionSummary?.addresses_converted || srcAddressCount;
    const convertedServices = conversionSummary?.services_converted || srcServiceCount;

    // Zones
    const srcZones = intermediateConfig.zones?.length || 0;
    const convertedZones = conversionSummary?.zones_converted || srcZones;

    // NAT
    const srcNat = intermediateConfig.nat_rules?.length || 0;
    const convertedNat = conversionSummary?.nat_rules_converted || srcNat;

    // Warnings by severity
    const warningSeverity = { warning: 0, unsupported: 0, interview_required: 0, info: 0 };
    for (const w of (warnings || [])) {
      if (warningSeverity[w.severity] !== undefined) warningSeverity[w.severity]++;
    }

    return {
      added, removed, modified, newlyDisabled,
      srcAddressCount, convertedAddresses, srcServiceCount, convertedServices,
      srcZones, convertedZones, srcNat, convertedNat,
      totalWarnings: (warnings || []).length,
      warningSeverity,
      totalCommands: srxOutput?.commands?.length || 0,
    };
  }, [intermediateConfig, srxTranslatedPolicies, srxOutput, warnings, conversionSummary]);

  if (!delta) return <EmptyState tabId="delta" />;

  return (
    <div className="report-section">
      <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Migration Delta Dashboard</h3>

      {/* Rule changes */}
      <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>Policy Changes</h4>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <DeltaBar label="Added" value={delta.added} color="var(--success)" />
        <DeltaBar label="Removed" value={delta.removed} color="var(--error)" />
        <DeltaBar label="Modified" value={delta.modified} color="var(--caution)" />
        <DeltaBar label="Newly Disabled" value={delta.newlyDisabled} color="var(--text-muted)" />
      </div>

      {/* Object changes */}
      <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>Objects &amp; Infrastructure</h4>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard label="Addresses" value={`${delta.srcAddressCount} \u2192 ${delta.convertedAddresses}`} />
        <StatCard label="Services" value={`${delta.srcServiceCount} \u2192 ${delta.convertedServices}`} />
        <StatCard label="Zones" value={`${delta.srcZones} \u2192 ${delta.convertedZones}`} />
        <StatCard label="NAT Rules" value={`${delta.srcNat} \u2192 ${delta.convertedNat}`} />
      </div>

      {/* Output stats */}
      <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>Output</h4>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard label="Set Commands" value={delta.totalCommands} />
        <StatCard label="Warnings" value={delta.totalWarnings} color={delta.totalWarnings > 0 ? 'var(--caution)' : undefined} />
        <StatCard label="Unsupported" value={delta.warningSeverity.unsupported} color={delta.warningSeverity.unsupported > 0 ? 'var(--error)' : undefined} />
      </div>
    </div>
  );
}

/* ── 6. Exportable Migration Summary ──────────────────────────────── */
function MigrationSummaryTab({ intermediateConfig, srxTranslatedPolicies, srxOutput, warnings, conversionSummary }) {
  const summaryText = useMemo(() => {
    if (!intermediateConfig || !srxOutput) return null;

    const srcPolicies = intermediateConfig.security_policies || [];
    const dstPolicies = srxTranslatedPolicies || srcPolicies;
    const commands = srxOutput.commands || [];
    const now = new Date().toISOString();

    // Risk assessment based on warning severity
    const severityCounts = { warning: 0, unsupported: 0, interview_required: 0 };
    for (const w of (warnings || [])) {
      if (severityCounts[w.severity] !== undefined) severityCounts[w.severity]++;
    }

    let riskLevel = 'LOW';
    if (severityCounts.unsupported > 0 || severityCounts.interview_required > 3) riskLevel = 'HIGH';
    else if (severityCounts.warning > 5 || severityCounts.interview_required > 0) riskLevel = 'MEDIUM';

    const lines = [
      '='.repeat(70),
      'FIREWALL MIGRATION SUMMARY -- CHANGE MANAGEMENT DOCUMENT',
      '='.repeat(70),
      '',
      `Generated: ${now}`,
      `Source Vendor: ${intermediateConfig._sourceVendor || 'Unknown'}`,
      `Target Platform: Juniper SRX`,
      '',
      '--- RULE COUNTS ---',
      `Source policies:      ${srcPolicies.length}`,
      `Converted policies:   ${dstPolicies.length}`,
      `Delta:                ${dstPolicies.length - srcPolicies.length >= 0 ? '+' : ''}${dstPolicies.length - srcPolicies.length}`,
      `Disabled (source):    ${srcPolicies.filter(p => p.disabled).length}`,
      `Disabled (converted): ${dstPolicies.filter(p => p.disabled).length}`,
      '',
      '--- CONVERSION SUMMARY ---',
      `Zones:        ${conversionSummary?.zones_converted || 0}`,
      `Addresses:    ${conversionSummary?.addresses_converted || 0}`,
      `Services:     ${conversionSummary?.services_converted || 0}`,
      `Policies:     ${conversionSummary?.policies_converted || 0}`,
      `NAT Rules:    ${conversionSummary?.nat_rules_converted || 0}`,
      `Set Commands: ${commands.length}`,
      '',
      '--- WARNINGS ---',
      `Total:           ${(warnings || []).length}`,
      `  Warnings:      ${severityCounts.warning}`,
      `  Unsupported:   ${severityCounts.unsupported}`,
      `  Interview Req: ${severityCounts.interview_required}`,
      '',
      '--- RISK ASSESSMENT ---',
      `Risk Level: ${riskLevel}`,
      riskLevel === 'HIGH' ? '  * Unsupported features detected -- manual review required' : '',
      riskLevel === 'MEDIUM' ? '  * Warnings present -- review before deployment' : '',
      riskLevel === 'LOW' ? '  * Clean conversion -- standard testing recommended' : '',
      '',
      '--- ROLLBACK REFERENCE ---',
      `Total set commands to rollback: ${commands.length}`,
      'Rollback plan: see "Rollback Plan" tab for delete commands',
      'Method: paste delete commands in SRX config mode (configure)',
      '',
      '='.repeat(70),
      'END OF MIGRATION SUMMARY',
      '='.repeat(70),
    ].filter(l => l !== undefined);

    return lines.join('\n');
  }, [intermediateConfig, srxTranslatedPolicies, srxOutput, warnings, conversionSummary]);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = summaryText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [summaryText]);

  const handleDownload = useCallback(() => {
    if (!summaryText) return;
    const now = new Date();
    const ts = now.toISOString().slice(0, 10) + '_' + now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `migration-summary-${ts}.txt`;
    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [summaryText]);

  if (!summaryText) return <EmptyState tabId="summary" />;

  return (
    <div className="report-section">
      <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Exportable Migration Summary</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download .txt
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleCopy}
          style={copied ? { borderColor: 'var(--juniper-green)', color: 'var(--juniper-green)' } : undefined}
        >
          {copied ? '\u2713 Copied!' : 'Copy to Clipboard'}
        </button>
      </div>
      <pre className="output-code" style={{ fontSize: 12, maxHeight: 500, overflow: 'auto' }}>
        {summaryText}
      </pre>
    </div>
  );
}

/* ── 7. Per-Command Conversion Report ─────────────────────────────── */
function PerCommandTab({ intermediateConfig, srxTranslatedPolicies }) {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const rows = useMemo(() => {
    const srcPolicies = intermediateConfig?.security_policies || [];
    if (srcPolicies.length === 0) return [];

    const dstPolicies = srxTranslatedPolicies || [];
    const dstByName = {};
    for (const policy of dstPolicies) {
      if (policy.name) dstByName[policy.name] = policy;
    }

    return srcPolicies.map((srcPolicy, index) => {
      const dstPolicy = dstByName[srcPolicy.name];

      let decision = '';
      let decisionCode = 0;
      let comment = '';

      if (!dstPolicy && srcPolicy._deleted_by === 'analysis') {
        decision = 'Deleted by analysis';
        decisionCode = 1;
        comment = srcPolicy._deletion_reason || '';
      } else if (!dstPolicy && srcPolicy._deleted_by === 'user') {
        decision = 'Deleted by user';
        decisionCode = 2;
        comment = srcPolicy._deletion_reason || '';
      } else if (!dstPolicy && srcPolicy._deleted_by === 'ai') {
        decision = 'Deleted by AI (flagged)';
        decisionCode = 4;
        comment = srcPolicy._deletion_reason || srcPolicy._translation_notes || '';
      } else if (dstPolicy && dstPolicy._review_status === 'llm_reviewed') {
        decision = 'Modified by AI to SRX';
        decisionCode = 3;
        comment = dstPolicy._translation_notes || '';
      } else if (dstPolicy && dstPolicy._review_status === 'accepted') {
        decision = 'Accepted (converted to SRX)';
        decisionCode = 3;
        comment = dstPolicy._translation_notes || '';
      } else if (dstPolicy) {
        decision = 'Direct conversion to SRX';
        decisionCode = 3;
        comment = '';
      } else {
        decision = 'Not in converted output';
        decisionCode = 5;
        comment = 'Rule was not included in the SRX conversion.';
      }

      return {
        index,
        name: srcPolicy.name || `Rule ${index + 1}`,
        srcAction: srcPolicy.action || '-',
        srcZones: `${(srcPolicy.src_zones || ['any']).join(',')} \u2192 ${(srcPolicy.dst_zones || ['any']).join(',')}`,
        decision,
        decisionCode,
        comment,
        disabled: srcPolicy.disabled || dstPolicy?.disabled,
        srcPolicy,
        dstPolicy,
      };
    });
  }, [intermediateConfig, srxTranslatedPolicies]);

  const toggleRow = useCallback((index) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleExportCsv = useCallback(() => {
    if (rows.length === 0) return;
    const headers = ['#', 'Rule Name', 'Action', 'Zone Flow', 'Decision', 'Decision Code', 'Comment', 'Disabled', 'Src Addresses', 'Dst Addresses', 'Services'];
    const csvRows = rows.map(row => [
      row.index + 1,
      `"${(row.name || '').replace(/"/g, '""')}"`,
      row.srcAction,
      `"${(row.srcZones || '').replace(/"/g, '""')}"`,
      `"${(row.decision || '').replace(/"/g, '""')}"`,
      row.decisionCode,
      `"${(row.comment || '').replace(/"/g, '""')}"`,
      row.disabled ? 'yes' : 'no',
      `"${(row.srcPolicy.src_addresses || ['any']).join('; ')}"`,
      `"${(row.srcPolicy.dst_addresses || ['any']).join('; ')}"`,
      `"${(row.srcPolicy.services || row.srcPolicy.applications || ['any']).join('; ')}"`,
    ].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `audit-trail-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  if (rows.length === 0) return <EmptyState tabId="per-command" />;

  const decisionColors = {
    1: 'var(--caution)',
    2: 'var(--text-muted)',
    3: 'var(--success)',
    4: 'var(--llm-cloud)',
    5: 'var(--text-muted)',
  };

  return (
    <div className="report-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Per-Command Conversion Report</h3>
        <button className="btn btn-primary btn-sm" onClick={handleExportCsv} title="Export audit trail as CSV">
          Export CSV
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        Each source rule mapped to a conversion decision. Click a row to expand details.
      </p>
      <table className="report-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th>#</th>
            <th>Rule Name</th>
            <th>Action</th>
            <th>Zone Flow</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <React.Fragment key={row.index}>
              <tr
                onClick={() => toggleRow(row.index)}
                style={{ cursor: 'pointer' }}
                className={expandedRows.has(row.index) ? 'expanded-row' : ''}
              >
                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {expandedRows.has(row.index) ? '\u25BC' : '\u25B6'}
                </td>
                <td>{row.index + 1}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {row.name}
                  {row.disabled && <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>(disabled)</span>}
                </td>
                <td style={{ textTransform: 'capitalize' }}>{row.srcAction}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{row.srcZones}</td>
                <td style={{ color: decisionColors[row.decisionCode] || 'var(--text-primary)' }}>
                  {row.decision}
                </td>
              </tr>
              {expandedRows.has(row.index) && (
                <tr className="expanded-detail-row">
                  <td colSpan={6} style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderTop: 'none' }}>
                    {row.comment && (
                      <div style={{ marginBottom: 6 }}>
                        <strong style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Notes: </strong>
                        <span style={{ fontSize: 12 }}>{row.comment}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Src Addresses: </strong>
                        {(row.srcPolicy.src_addresses || ['any']).join(', ')}
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Dst Addresses: </strong>
                        {(row.srcPolicy.dst_addresses || ['any']).join(', ')}
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Services: </strong>
                        {(row.srcPolicy.services || row.srcPolicy.applications || ['any']).join(', ')}
                      </div>
                    </div>
                    {row.dstPolicy && row.dstPolicy._translation_notes && (
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        <strong style={{ color: 'var(--llm-cloud)' }}>LLM Notes: </strong>
                        {row.dstPolicy._translation_notes}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 8. Rollback Plan Generation ──────────────────────────────────── */
function RollbackTab({ srxOutput }) {
  const rollbackCommands = useMemo(() => {
    if (!srxOutput?.commands) return [];
    return srxOutput.commands
      .filter(cmd => cmd.startsWith('set '))
      .map(cmd => 'delete ' + cmd.substring(4));
  }, [srxOutput]);

  const [copied, setCopied] = useState(false);

  const rollbackText = rollbackCommands.join('\n');

  const handleCopy = useCallback(async () => {
    if (!rollbackText) return;
    try {
      await navigator.clipboard.writeText(rollbackText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = rollbackText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [rollbackText]);

  const handleDownload = useCallback(() => {
    if (!rollbackText) return;
    const now = new Date();
    const ts = now.toISOString().slice(0, 10) + '_' + now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `srx-rollback-${ts}.txt`;
    const blob = new Blob([rollbackText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [rollbackText]);

  if (rollbackCommands.length === 0) return <EmptyState tabId="rollback" />;

  return (
    <div className="report-section">
      <h3 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>Rollback Plan</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        Auto-generated <code>delete</code> commands for every <code>set</code> command in the SRX output.
        Paste these in SRX config mode to undo the migration.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download .txt
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleCopy}
          style={copied ? { borderColor: 'var(--juniper-green)', color: 'var(--juniper-green)' } : undefined}
        >
          {copied ? '\u2713 Copied!' : 'Copy to Clipboard'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {rollbackCommands.length} delete commands
        </span>
      </div>
      <pre className="output-code" style={{ fontSize: 12, maxHeight: 500, overflow: 'auto' }}>
        {rollbackCommands.map((cmd, i) => (
          <span key={i} className="set-command">
            <span className="keyword" style={{ color: 'var(--error)' }}>delete</span>
            {cmd.substring(6)}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  );
}

/* ── Shared sub-components ────────────────────────────────────────── */

/** Stat card for numerical summaries */
function StatCard({ label, value, color }) {
  return (
    <div className="summary-card" style={{ minWidth: 100 }}>
      <div className="summary-value" style={color ? { color } : undefined}>{value}</div>
      <div className="summary-label">{label}</div>
    </div>
  );
}

/** Bar-style delta indicator */
function DeltaBar({ label, value, color }) {
  const maxWidth = 100;
  const barWidth = Math.min(Math.max(value * 5, value > 0 ? 8 : 0), maxWidth);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)',
      padding: '10px 16px', minWidth: 100,
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: color || 'var(--text-primary)', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{
        width: maxWidth, height: 4, borderRadius: 2,
        background: 'var(--bg-hover)', marginBottom: 4, overflow: 'hidden',
      }}>
        <div style={{ width: barWidth, height: '100%', borderRadius: 2, background: color || 'var(--accent)' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
