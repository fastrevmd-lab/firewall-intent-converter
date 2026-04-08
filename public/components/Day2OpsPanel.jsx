/**
 * Day2OpsPanel — Live Day 2 Operations dashboard.
 *
 * Connects to a PyEZ Bridge to pull live SRX policy stats, annotates the
 * intermediate config, surfaces summary metrics, and exposes quick-action
 * buttons for common remediation tasks.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfigContext } from '../contexts/ConfigContext.jsx';
import { useUIContext } from '../contexts/UIContext.jsx';
import useDay2Ops from '../hooks/useDay2Ops.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO timestamp as a relative time string ("just now", "2 min ago", etc.).
 * @param {string|null} isoString
 * @returns {string}
 */
function relativeTime(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

const POLL_OPTIONS = [
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single summary metric card. */
function SummaryCard({ value, label, valueColor }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: 8,
      padding: 16,
      textAlign: 'center',
      flex: '1 1 0',
      minWidth: 100,
    }}>
      <div style={{ fontSize: 28, fontWeight: 600, color: valueColor || 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Day2OpsPanel — dashboard for live Day 2 SRX operations.
 */
export default function Day2OpsPanel() {
  const { state: configState, dispatch: configDispatch } = useConfigContext();
  const { dispatch: uiDispatch } = useUIContext();
  const day2 = useDay2Ops();

  const policies = configState.intermediateConfig?.security_policies || [];
  const summary = useMemo(
    () => day2.computeSummary(policies),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [policies, day2.stats],
  );

  // Auto-refresh countdown
  const [countdown, setCountdown] = useState(0);
  const countdownRef = React.useRef(null);

  // Track relative time display — re-render every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Fetch devices on mount if bridge is configured
  useEffect(() => {
    if (day2.bridgeUrl) day2.refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer management
  const startCountdown = useCallback((intervalMs) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(Math.floor(intervalMs / 1000));
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return Math.floor(intervalMs / 1000);
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(0);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Handlers
  const handlePullStats = useCallback(async () => {
    const freshStats = await day2.fetchStats(day2.deviceName);
    if (freshStats) {
      day2.annotateConfig(configDispatch, configState.intermediateConfig);
    }
  }, [day2, configDispatch, configState.intermediateConfig]);

  const handleTogglePolling = useCallback((enabled) => {
    if (enabled) {
      day2.startPolling(day2.deviceName, configDispatch, configState.intermediateConfig);
      startCountdown(day2.pollInterval);
    } else {
      day2.stopPolling();
      stopCountdown();
    }
  }, [day2, configDispatch, configState.intermediateConfig, startCountdown, stopCountdown]);

  const handlePollIntervalChange = useCallback((newIntervalMs) => {
    day2.setPollInterval(newIntervalMs);
    if (day2.isPolling) {
      day2.stopPolling();
      day2.startPolling(day2.deviceName, configDispatch, configState.intermediateConfig);
      startCountdown(newIntervalMs);
    }
  }, [day2, configDispatch, configState.intermediateConfig, startCountdown]);

  // Tighten: count eligible rules
  const tightenEligibleCount = useMemo(() => {
    return policies.filter(p =>
      Array.isArray(p.applications) &&
      p.applications.includes('any') &&
      Array.isArray(p._matched_apps) &&
      p._matched_apps.length > 0,
    ).length;
  }, [policies]);

  // Active percent color
  const activePercentColor = summary.activePercent > 80
    ? 'var(--juniper-green, #90C641)'
    : summary.activePercent > 50
      ? 'var(--caution, #f59e0b)'
      : 'var(--error, #ef4444)';

  const neverHitColor = summary.neverHit > 0
    ? 'var(--error, #ef4444)'
    : 'var(--juniper-green, #90C641)';

  // Styles
  const sectionHeader = {
    fontSize: 13,
    fontWeight: 600,
    margin: '16px 0 8px',
    color: 'var(--text-primary)',
  };

  return (
    <div style={{ padding: '16px 24px', maxWidth: 900 }}>

      {/* ------------------------------------------------------------------ */}
      {/* Connection Bar                                                       */}
      {/* ------------------------------------------------------------------ */}
      {!day2.bridgeUrl ? (
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          padding: '12px 16px',
          color: 'var(--text-muted)',
          fontSize: 13,
          marginBottom: 16,
        }}>
          Configure PyEZ Bridge in Settings to connect to SRX devices.
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Bridge: <code style={{ color: 'var(--text-secondary)' }}>{day2.bridgeUrl}</code>
          </span>

          <select
            value={day2.deviceName}
            onChange={(evt) => day2.setDeviceName(evt.target.value)}
            style={{
              background: 'var(--bg-input, var(--bg-card))',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 12,
            }}
          >
            <option value="">▼ select device</option>
            {day2.devices.map(device => (
              <option key={device} value={device}>{device}</option>
            ))}
          </select>

          <button
            className="btn"
            onClick={handlePullStats}
            disabled={day2.isLoading || !day2.deviceName}
            style={{ fontSize: 12, padding: '3px 12px' }}
          >
            {day2.isLoading ? 'Pulling…' : 'Pull Stats'}
          </button>

          {day2.lastFetchTime && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Last: {relativeTime(day2.lastFetchTime)}
            </span>
          )}

          {day2.error && (
            <span style={{ fontSize: 12, color: 'var(--error, #ef4444)', flex: '1 1 100%' }}>
              {day2.error}
            </span>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Summary Cards                                                        */}
      {/* ------------------------------------------------------------------ */}
      {day2.annotationApplied && (
        <>
          <div style={{ ...sectionHeader }}>Live Policy Summary</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <SummaryCard
              value={`${summary.annotated} / ${summary.total}`}
              label="Policies Annotated"
            />
            <SummaryCard
              value={`${summary.activePercent}%`}
              label="Active (hits > 0)"
              valueColor={activePercentColor}
            />
            <SummaryCard
              value={summary.neverHit}
              label="Never-Hit"
              valueColor={neverHitColor}
            />
            <SummaryCard
              value={summary.totalSessions.toLocaleString()}
              label="Active Sessions"
            />
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Top Applications Table                                              */}
      {/* ------------------------------------------------------------------ */}
      {summary.topApps?.length > 0 && (
        <>
          <div style={{ ...sectionHeader }}>Top Applications</div>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            marginBottom: 16,
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: 36 }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Application</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Sessions</th>
              </tr>
            </thead>
            <tbody>
              {summary.topApps.map((appEntry, idx) => (
                <tr
                  key={appEntry.application}
                  style={{ borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.05))' }}
                >
                  <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td style={{ padding: '5px 8px', color: 'var(--text-primary)' }}>{appEntry.application}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                    {(appEntry.sessions ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Auto-Refresh Controls                                               */}
      {/* ------------------------------------------------------------------ */}
      {day2.bridgeUrl && (
        <>
          <div style={{ ...sectionHeader }}>Auto-Refresh</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={day2.isPolling}
                onChange={(evt) => handleTogglePolling(evt.target.checked)}
                disabled={!day2.deviceName}
              />
              Auto-refresh
            </label>

            <select
              value={day2.pollInterval}
              onChange={(evt) => handlePollIntervalChange(Number(evt.target.value))}
              disabled={!day2.deviceName}
              style={{
                background: 'var(--bg-input, var(--bg-card))',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 12,
              }}
            >
              {POLL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {day2.isPolling && countdown > 0 && (
              <span style={{ fontSize: 12, color: 'var(--caution, #f59e0b)' }}>
                ● Refreshing in {countdown}s…
              </span>
            )}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Quick Actions                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ ...sectionHeader }}>Quick Actions</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="btn"
          onClick={() => day2.disableNeverHitRules(configDispatch, configState.intermediateConfig)}
          disabled={summary.neverHit === 0}
          style={{ fontSize: 12 }}
        >
          Disable Never-Hit Rules ({summary.neverHit})
        </button>

        <button
          className="btn"
          onClick={() => uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'analysis' })}
          style={{ fontSize: 12 }}
        >
          Run Analysis
        </button>

        <button
          className="btn"
          onClick={() => uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'rules' })}
          style={{ fontSize: 12 }}
        >
          View Policies
        </button>

        <button
          className="btn"
          onClick={() => day2.tightenPermissiveRules(configDispatch, configState.intermediateConfig)}
          disabled={tightenEligibleCount === 0}
          style={{ fontSize: 12 }}
        >
          Tighten Permissive Rules{tightenEligibleCount > 0 ? ` (${tightenEligibleCount})` : ''}
        </button>
      </div>

    </div>
  );
}
