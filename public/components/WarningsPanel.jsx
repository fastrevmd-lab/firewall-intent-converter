/**
 * WarningsPanel Component
 *
 * Displays all conversion warnings, filterable by severity level and resolution status.
 * Each warning shows:
 *   - Severity icon (clean / warning / unsupported / interview required)
 *   - The specific config element involved
 *   - Description of the issue
 *   - Suggestion for resolution
 *   - Action buttons: Acknowledge / Fixed / Ignore (or status badge if already actioned)
 */
import React, { useState, useMemo } from 'react';

const SEVERITY_META = {
  clean:              { icon: '\u2705', label: 'Clean',              cssClass: 'clean' },
  warning:            { icon: '\u26A0\uFE0F', label: 'Warning',      cssClass: 'warning' },
  unsupported:        { icon: '\u274C', label: 'Unsupported',        cssClass: 'unsupported' },
  interview_required: { icon: '\uD83D\uDCAC', label: 'Interview Req.', cssClass: 'interview' },
  info:               { icon: '\uD83D\uDCA1', label: 'Optimization',  cssClass: 'info' },
};

const STATUS_LABELS = {
  acknowledged: 'Ack',
  fixed: 'Fixed',
  ignored: 'Ignored',
};

export default function WarningsPanel({ warnings, warningStatuses = {}, onWarningAction }) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Count by severity and resolution status
  const counts = useMemo(() => {
    const c = { all: 0, warning: 0, unsupported: 0, interview_required: 0, info: 0, unresolved: 0, resolved: 0, validation: 0 };
    for (let i = 0; i < (warnings || []).length; i++) {
      const w = warnings[i];
      c.all++;
      if (c[w.severity] !== undefined) c[w.severity]++;
      if (w._source === 'validation') c.validation++;
      if (warningStatuses[i]) {
        c.resolved++;
      } else {
        c.unresolved++;
      }
    }
    return c;
  }, [warnings, warningStatuses]);

  // We need to track the global index (into the full warnings array) for each
  // filtered warning so action buttons update the correct entry.
  const filtered = useMemo(() => {
    const result = [];
    for (let i = 0; i < (warnings || []).length; i++) {
      const w = warnings[i];
      // Severity filter
      if (severityFilter !== 'all' && w.severity !== severityFilter) continue;
      // Status filter
      const isResolved = !!warningStatuses[i];
      if (statusFilter === 'unresolved' && isResolved) continue;
      if (statusFilter === 'resolved' && !isResolved) continue;
      // Source filter
      if (sourceFilter === 'validation' && w._source !== 'validation') continue;
      result.push({ warning: w, globalIndex: i });
    }
    return result;
  }, [warnings, severityFilter, statusFilter, sourceFilter, warningStatuses]);

  if (!warnings || warnings.length === 0) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <h3>All clear</h3>
        <p>No warnings. All conversion items processed cleanly.</p>
      </div>
    );
  }

  return (
    <div className="warnings-panel">
      {/* Filter buttons */}
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Status filters */}
        <FilterButton
          label={`All (${counts.all})`}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <FilterButton
          label={`Unresolved (${counts.unresolved})`}
          active={statusFilter === 'unresolved'}
          onClick={() => setStatusFilter('unresolved')}
          color="var(--caution)"
        />
        <FilterButton
          label={`Resolved (${counts.resolved})`}
          active={statusFilter === 'resolved'}
          onClick={() => setStatusFilter('resolved')}
          color="var(--success)"
        />

        <span style={{ borderLeft: '1px solid var(--border-color)', height: 20, margin: '0 4px' }} />

        {/* Severity filters */}
        <FilterButton
          label={`Warnings (${counts.warning})`}
          active={severityFilter === 'warning'}
          onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning')}
          color="var(--caution)"
        />
        <FilterButton
          label={`Unsupported (${counts.unsupported})`}
          active={severityFilter === 'unsupported'}
          onClick={() => setSeverityFilter(severityFilter === 'unsupported' ? 'all' : 'unsupported')}
          color="var(--error)"
        />
        <FilterButton
          label={`Interview (${counts.interview_required})`}
          active={severityFilter === 'interview_required'}
          onClick={() => setSeverityFilter(severityFilter === 'interview_required' ? 'all' : 'interview_required')}
          color="var(--status-interview)"
        />
        {counts.info > 0 && (
          <FilterButton
            label={`Optimization (${counts.info})`}
            active={severityFilter === 'info'}
            onClick={() => setSeverityFilter(severityFilter === 'info' ? 'all' : 'info')}
            color="#38bdf8"
          />
        )}
        {counts.validation > 0 && (
          <FilterButton
            label={`Validation (${counts.validation})`}
            active={sourceFilter === 'validation'}
            onClick={() => setSourceFilter(sourceFilter === 'validation' ? 'all' : 'validation')}
            color="var(--caution)"
          />
        )}
      </div>

      {/* Warning list */}
      {filtered.map(({ warning: w, globalIndex }) => {
        const meta = SEVERITY_META[w.severity] || SEVERITY_META.warning;
        const status = warningStatuses[globalIndex];
        return (
          <div key={globalIndex} className={`warning-item ${status ? 'resolved' : ''}`}>
            <span className={`warning-icon ${meta.cssClass}`}>
              {meta.icon}
            </span>
            <div className="warning-body">
              <div className="warning-element">{w.element}</div>
              <div className="warning-message">{w.message}</div>
              {w.suggestion && (
                <div className="warning-suggestion">{w.suggestion}</div>
              )}
            </div>
            {onWarningAction && (
              <div className="warning-actions">
                {!status ? (
                  <>
                    <button className="btn btn-xs btn-ack" onClick={() => onWarningAction(globalIndex, 'acknowledged')}
                      title="I've reviewed this warning">Ack</button>
                    <button className="btn btn-xs btn-fixed" onClick={() => onWarningAction(globalIndex, 'fixed')}
                      title="I've applied a fix for this">Fixed</button>
                    <button className="btn btn-xs btn-ignore" onClick={() => onWarningAction(globalIndex, 'ignored')}
                      title="Not applicable / won't fix">Ignore</button>
                  </>
                ) : (
                  <span
                    className={`warning-status-badge ${status}`}
                    onClick={() => onWarningAction(globalIndex, null)}
                    title="Click to undo"
                  >
                    {STATUS_LABELS[status] || status}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="empty-state" style={{ padding: '20px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p>No warnings match this filter.</p>
        </div>
      )}
    </div>
  );
}

function FilterButton({ label, active, onClick, color }) {
  return (
    <button
      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
      onClick={onClick}
      style={active && color ? { background: color } : undefined}
    >
      {label}
    </button>
  );
}
