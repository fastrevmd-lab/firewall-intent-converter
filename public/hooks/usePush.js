/**
 * usePush — Push-to-SRX workflow hook
 *
 * Manages connection to the PyEZ Bridge service, device selection,
 * config loading, diff, commit check, commit (with optional confirm),
 * and rollback operations.
 *
 * Reads srxOutput + outputFormat from ConversionContext.
 * Reads sanitizationTable from ConfigContext for IP restoration.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useConversionContext } from '../contexts/ConversionContext.jsx';
import { useConfigContext } from '../contexts/ConfigContext.jsx';
import { safeJsonParse } from '../utils/safe-json.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'pyez-bridge-settings';
const OLD_STORAGE_KEY = 'mcp-settings';
const FETCH_TIMEOUT = 30000; // 30 seconds

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a bridge URL — ensure http:// or https:// prefix. */
function normalizeBridgeUrl(raw) {
  let url = (raw || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  if (/^https?:\/[^/]/.test(url)) url = url.replace(/^(https?:\/)/, '$1/');
  if (!/^https?:\/\//.test(url)) url = 'http://' + url;
  return url;
}

/** Load bridge URL from localStorage with migration from old mcp-settings key. */
function loadBridgeUrl() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = safeJsonParse(saved);
      return normalizeBridgeUrl(data?.url || '');
    }
    // Migrate from old key
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      const data = safeJsonParse(old);
      const url = normalizeBridgeUrl(data?.url || '');
      if (url) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ url }));
      }
      return url;
    }
  } catch { /* ignore */ }
  return '';
}

/** Restore sanitized placeholders with original values for export. */
function restoreForExport(text, sanitizationTable) {
  if (!sanitizationTable || sanitizationTable.length === 0) return text;
  let result = text;
  for (const entry of sanitizationTable) {
    if (entry.restore) {
      result = result.replaceAll(entry.placeholder, entry.original);
    }
  }
  return result;
}

/** Fetch with timeout via AbortController. */
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal, mode: 'cors' });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

/** Format timestamp for log entries. */
function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export default function usePush() {
  const { state: convState } = useConversionContext();
  const { state: configState } = useConfigContext();

  const { srxOutput, outputFormat } = convState;
  const { sanitizationTable } = configState;

  // Connection state
  const [bridgeUrl, setBridgeUrl] = useState(() => loadBridgeUrl());
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [devices, setDevices] = useState([]);

  // Push workflow state
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pushStep, setPushStep] = useState('select'); // select | diff | check | commit | done | error
  const [pushLog, setPushLog] = useState([]);
  const [configDiff, setConfigDiff] = useState('');
  const [commitCheckResult, setCommitCheckResult] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [confirmTimer, setConfirmTimer] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  // Confirm countdown interval ref
  const confirmIntervalRef = useRef(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------------
  const appendLog = useCallback((level, message) => {
    setPushLog(prev => [...prev, { time: timestamp(), level, message }]);
  }, []);

  // -----------------------------------------------------------------------
  // Base URL helper
  // -----------------------------------------------------------------------
  const baseUrl = useCallback(() => {
    return (bridgeUrl || '').replace(/\/+$/, '');
  }, [bridgeUrl]);

  // -----------------------------------------------------------------------
  // Get config text (with sanitization restore)
  // -----------------------------------------------------------------------
  const getConfigText = useCallback(() => {
    if (!srxOutput) return '';
    let text;
    if (outputFormat === 'xml') {
      text = srxOutput.xml || '';
    } else {
      text = (srxOutput.commands || []).join('\n');
    }
    return restoreForExport(text, sanitizationTable);
  }, [srxOutput, outputFormat, sanitizationTable]);

  // -----------------------------------------------------------------------
  // Connection
  // -----------------------------------------------------------------------
  const testConnection = useCallback(async (url) => {
    const base = (url || bridgeUrl || '').replace(/\/+$/, '');
    if (!base) return false;
    try {
      const resp = await fetchWithTimeout(base + '/health');
      if (resp.ok) {
        setBridgeConnected(true);
        appendLog('success', 'Connected to PyEZ Bridge.');
        // Quick device list (no NETCONF probe — instant)
        try {
          const devResp = await fetchWithTimeout(base + '/devices');
          if (devResp.ok) {
            const data = await devResp.json();
            setDevices(Array.isArray(data) ? data : data.devices || []);
          }
        } catch { /* device list optional on first connect */ }
        // Background probe for live status (may take seconds per device)
        fetchWithTimeout(base + '/devices?probe=true', {}, 60000).then(async (r) => {
          if (r.ok) {
            const data = await r.json();
            setDevices(Array.isArray(data) ? data : data.devices || []);
          }
        }).catch(() => {});
        return true;
      }
      setBridgeConnected(false);
      appendLog('error', `Bridge returned HTTP ${resp.status}.`);
      return false;
    } catch (err) {
      setBridgeConnected(false);
      appendLog('error', `Connection failed: ${err.message}`);
      return false;
    }
  }, [bridgeUrl, appendLog]);

  const saveSettings = useCallback((url) => {
    setBridgeUrl(url);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url }));
  }, []);

  // -----------------------------------------------------------------------
  // Device management
  // -----------------------------------------------------------------------
  const refreshDevices = useCallback(async () => {
    try {
      const resp = await fetchWithTimeout(baseUrl() + '/devices');
      if (resp.ok) {
        const data = await resp.json();
        setDevices(Array.isArray(data) ? data : data.devices || []);
      }
    } catch (err) {
      appendLog('error', `Failed to refresh devices: ${err.message}`);
    }
  }, [baseUrl, appendLog]);

  const addDevice = useCallback(async (deviceInfo) => {
    try {
      const resp = await fetchWithTimeout(baseUrl() + '/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceInfo),
      });
      const data = await resp.json();
      if (data.ok) {
        appendLog('success', `Device '${deviceInfo.name}' added.`);
        await refreshDevices();
        return true;
      }
      appendLog('error', data.error || 'Failed to add device.');
      return false;
    } catch (err) {
      appendLog('error', `Failed to add device: ${err.message}`);
      return false;
    }
  }, [baseUrl, appendLog, refreshDevices]);

  const removeDevice = useCallback(async (deviceName) => {
    try {
      const resp = await fetchWithTimeout(baseUrl() + `/devices/${encodeURIComponent(deviceName)}`, {
        method: 'DELETE',
      });
      const data = await resp.json();
      if (data.ok) {
        appendLog('info', `Device '${deviceName}' removed.`);
        await refreshDevices();
        if (selectedDevice === deviceName) setSelectedDevice(null);
        return true;
      }
      appendLog('error', data.error || 'Failed to remove device.');
      return false;
    } catch (err) {
      appendLog('error', `Failed to remove device: ${err.message}`);
      return false;
    }
  }, [baseUrl, appendLog, refreshDevices, selectedDevice]);

  // -----------------------------------------------------------------------
  // Push workflow
  // -----------------------------------------------------------------------

  const loadConfig = useCallback(async (deviceName) => {
    const name = deviceName || selectedDevice;
    if (!name) return false;
    setIsWorking(true);
    appendLog('info', `Loading configuration to ${name}...`);
    try {
      let configText = getConfigText();
      if (!configText) {
        appendLog('error', 'No SRX output to push.');
        setIsWorking(false);
        return false;
      }

      const fmt = outputFormat === 'xml' ? 'xml' : 'set';
      // For set format, strip comment lines and blanks — NETCONF rejects non-command lines
      if (fmt === 'set') {
        const lines = configText.split('\n').filter(l => {
          const trimmed = l.trim();
          return trimmed && !trimmed.startsWith('#');
        });
        configText = lines.join('\n');
        appendLog('info', `Sending ${lines.length} set commands (comments stripped).`);
      }
      const resp = await fetchWithTimeout(baseUrl() + `/devices/${encodeURIComponent(name)}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configText, format: fmt }),
      });
      const data = await resp.json();
      if (data.ok) {
        appendLog('success', data.message || 'Configuration loaded into candidate.');
        // Show skipped lines as warnings
        if (data.warnings && data.warnings.length > 0) {
          appendLog('warn', `${data.skipped} command(s) skipped due to errors:`);
          for (const w of data.warnings.slice(0, 20)) {
            appendLog('warn', `  Line ${w.line}: ${w.command}`);
            if (w.message) appendLog('warn', `    → ${w.message}`);
          }
          if (data.warnings.length > 20) {
            appendLog('warn', `  ... and ${data.warnings.length - 20} more`);
          }
        }
        setIsWorking(false);
        return true;
      }
      appendLog('error', `Load failed: ${data.error}`);
      if (data.details) {
        if (Array.isArray(data.details)) {
          for (const err of data.details) {
            const cmd = err.command ? `: ${err.command}` : '';
            appendLog('error', `  ${err.message || err}${cmd}`);
          }
        } else {
          appendLog('error', String(data.details).slice(0, 500));
        }
      }
      setIsWorking(false);
      return false;
    } catch (err) {
      appendLog('error', `Load failed: ${err.message}`);
      setIsWorking(false);
      return false;
    }
  }, [selectedDevice, getConfigText, outputFormat, baseUrl, appendLog]);

  const fetchDiff = useCallback(async (deviceName) => {
    const name = deviceName || selectedDevice;
    if (!name) return '';
    setIsWorking(true);
    appendLog('info', 'Fetching configuration diff...');
    try {
      const resp = await fetchWithTimeout(baseUrl() + `/devices/${encodeURIComponent(name)}/diff`);
      const data = await resp.json();
      if (data.ok) {
        setConfigDiff(data.diff || '');
        if (!data.diff) {
          appendLog('info', 'No changes — candidate matches active config.');
        } else {
          const adds = (data.diff.match(/^\+/gm) || []).length;
          const dels = (data.diff.match(/^-/gm) || []).length;
          appendLog('success', `Diff retrieved: ${adds} additions, ${dels} removals.`);
        }
        setIsWorking(false);
        return data.diff || '';
      }
      appendLog('error', data.error || 'Failed to get diff.');
      setIsWorking(false);
      return '';
    } catch (err) {
      appendLog('error', `Diff failed: ${err.message}`);
      setIsWorking(false);
      return '';
    }
  }, [selectedDevice, baseUrl, appendLog]);

  const commitCheck = useCallback(async (deviceName) => {
    const name = deviceName || selectedDevice;
    if (!name) return null;
    setIsWorking(true);
    appendLog('info', 'Running commit check (dry run)...');
    try {
      const resp = await fetchWithTimeout(baseUrl() + `/devices/${encodeURIComponent(name)}/commit-check`, {
        method: 'POST',
      });
      const data = await resp.json();
      setCommitCheckResult(data);
      if (data.ok) {
        appendLog('success', 'Commit check passed.');
      } else {
        appendLog('error', 'Commit check failed.');
        if (data.errors) {
          for (const err of data.errors) {
            appendLog('error', `  ${err.message}`);
          }
        }
      }
      setIsWorking(false);
      return data;
    } catch (err) {
      const result = { ok: false, errors: [{ message: err.message, severity: 'error' }] };
      setCommitCheckResult(result);
      appendLog('error', `Commit check failed: ${err.message}`);
      setIsWorking(false);
      return result;
    }
  }, [selectedDevice, baseUrl, appendLog]);

  const commitConfig = useCallback(async (deviceName, options = {}) => {
    const name = deviceName || selectedDevice;
    if (!name) return null;
    setIsWorking(true);
    const confirmMin = options.confirm_minutes || 0;
    appendLog('info', confirmMin
      ? `Committing with ${confirmMin}-minute confirm timer...`
      : 'Committing configuration...');
    try {
      const resp = await fetchWithTimeout(baseUrl() + `/devices/${encodeURIComponent(name)}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: options.comment || 'Pushed via Firewall Intent Converter',
          confirm_minutes: confirmMin || undefined,
        }),
      });
      const data = await resp.json();
      setCommitResult(data);

      if (data.ok) {
        appendLog('success', data.message);
        if (data.confirm_active && confirmMin > 0) {
          // Start countdown timer
          const expiresAt = Date.now() + confirmMin * 60 * 1000;
          setConfirmTimer({ active: true, minutes: confirmMin, expiresAt });
          // Update timer every second
          if (confirmIntervalRef.current) clearInterval(confirmIntervalRef.current);
          confirmIntervalRef.current = setInterval(() => {
            const remaining = Math.max(0, expiresAt - Date.now());
            if (remaining <= 0) {
              clearInterval(confirmIntervalRef.current);
              confirmIntervalRef.current = null;
              setConfirmTimer(prev => prev ? { ...prev, active: false } : null);
              appendLog('warn', 'Confirm timer expired — device will auto-rollback.');
            }
          }, 1000);
        }
      } else {
        appendLog('error', data.error || 'Commit failed.');
      }
      setIsWorking(false);
      return data;
    } catch (err) {
      const result = { ok: false, error: err.message };
      setCommitResult(result);
      appendLog('error', `Commit failed: ${err.message}`);
      setIsWorking(false);
      return result;
    }
  }, [selectedDevice, baseUrl, appendLog]);

  const confirmCommit = useCallback(async (deviceName) => {
    const name = deviceName || selectedDevice;
    if (!name) return false;
    setIsWorking(true);
    appendLog('info', 'Confirming commit...');
    try {
      const resp = await fetchWithTimeout(baseUrl() + `/devices/${encodeURIComponent(name)}/confirm`, {
        method: 'POST',
      });
      const data = await resp.json();
      if (data.ok) {
        appendLog('success', 'Commit confirmed. Auto-rollback cancelled.');
        if (confirmIntervalRef.current) {
          clearInterval(confirmIntervalRef.current);
          confirmIntervalRef.current = null;
        }
        setConfirmTimer(null);
        setIsWorking(false);
        return true;
      }
      appendLog('error', data.error || 'Confirm failed.');
      setIsWorking(false);
      return false;
    } catch (err) {
      appendLog('error', `Confirm failed: ${err.message}`);
      setIsWorking(false);
      return false;
    }
  }, [selectedDevice, baseUrl, appendLog]);

  const rollback = useCallback(async (deviceName) => {
    const name = deviceName || selectedDevice;
    if (!name) return false;
    setIsWorking(true);
    appendLog('info', 'Rolling back configuration...');
    try {
      const resp = await fetchWithTimeout(baseUrl() + `/devices/${encodeURIComponent(name)}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 0 }),
      });
      const data = await resp.json();
      if (data.ok) {
        appendLog('success', 'Configuration rolled back successfully.');
        if (confirmIntervalRef.current) {
          clearInterval(confirmIntervalRef.current);
          confirmIntervalRef.current = null;
        }
        setConfirmTimer(null);
        setIsWorking(false);
        return true;
      }
      appendLog('error', data.error || 'Rollback failed.');
      setIsWorking(false);
      return false;
    } catch (err) {
      appendLog('error', `Rollback failed: ${err.message}`);
      setIsWorking(false);
      return false;
    }
  }, [selectedDevice, baseUrl, appendLog]);

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------
  const resetPush = useCallback(() => {
    setSelectedDevice(null);
    setPushStep('select');
    setPushLog([]);
    setConfigDiff('');
    setCommitCheckResult(null);
    setCommitResult(null);
    if (confirmIntervalRef.current) {
      clearInterval(confirmIntervalRef.current);
      confirmIntervalRef.current = null;
    }
    setConfirmTimer(null);
    setIsWorking(false);
  }, []);

  // -----------------------------------------------------------------------
  // Return public API
  // -----------------------------------------------------------------------
  return {
    // Connection
    bridgeUrl,
    bridgeConnected,
    devices,
    testConnection,
    saveSettings,
    refreshDevices,
    addDevice,
    removeDevice,

    // Workflow state
    selectedDevice,
    setSelectedDevice,
    pushStep,
    setPushStep,
    pushLog,
    configDiff,
    commitCheckResult,
    commitResult,
    confirmTimer,
    isWorking,

    // Workflow actions
    loadConfig,
    fetchDiff,
    commitCheck,
    commitConfig,
    confirmCommit,
    rollback,
    resetPush,
    appendLog,

    // Config info
    getConfigText,
    outputFormat,
    hasSrxOutput: !!(srxOutput && (srxOutput.commands?.length || srxOutput.xml)),
  };
}
