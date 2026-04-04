/**
 * BatchMigrationPanel Component
 *
 * Multi-file upload and independent batch conversion of N firewall configs.
 * Each file is parsed and converted independently through the engine pipeline.
 * Results can be downloaded individually or as a combined ZIP.
 */
import React, { useState, useCallback, useRef } from 'react';
import { parseConfig, convertConfig } from '../utils/engine.js';

const STATUS = {
  pending: { label: 'Pending', color: 'var(--text-muted)' },
  parsing: { label: 'Parsing...', color: 'var(--accent)' },
  converting: { label: 'Converting...', color: 'var(--accent)' },
  done: { label: 'Done', color: 'var(--success)' },
  error: { label: 'Error', color: 'var(--error, #e74c3c)' },
};

const VENDOR_LABELS = {
  panos: 'PAN-OS', srx: 'SRX', fortigate: 'FortiGate',
  cisco_asa: 'Cisco ASA', checkpoint: 'Check Point',
  sonicwall: 'SonicWall', huawei_usg: 'Huawei USG',
  aws_sg: 'AWS SG', azure_nsg: 'Azure NSG', gcp_fw: 'GCP FW',
};

/**
 * @typedef {Object} BatchItem
 * @property {string} filename
 * @property {string} configText
 * @property {'pending'|'parsing'|'converting'|'done'|'error'} status
 * @property {string} vendor
 * @property {number} ruleCount
 * @property {number} warningCount
 * @property {string} error
 * @property {string} srxOutput
 */

export default function BatchMigrationPanel() {
  const [items, setItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  /** Handle file drop or file input */
  const handleFiles = useCallback((files) => {
    const newItems = Array.from(files).map(file => ({
      filename: file.name,
      configText: null,
      file,
      status: 'pending',
      vendor: '',
      ruleCount: 0,
      warningCount: 0,
      error: '',
      srxOutput: '',
    }));
    setItems(prev => [...prev, ...newItems]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemoveItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAll = useCallback(() => {
    setItems([]);
  }, []);

  /** Process all items sequentially */
  const handleProcessAll = useCallback(async () => {
    if (items.length === 0) return;
    setIsProcessing(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === 'done') continue;

      try {
        // Read file text if not already loaded
        let configText = item.configText;
        if (!configText && item.file) {
          configText = await item.file.text();
          setItems(prev => prev.map((it, idx) =>
            idx === i ? { ...it, configText } : it
          ));
        }

        // Parse
        setItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'parsing' } : it
        ));

        const parseResult = await parseConfig(configText);
        const ic = parseResult.intermediateConfig || parseResult;
        const vendor = ic.detectedVendor || parseResult.detectedVendor || ic.metadata?.source_vendor || '';
        const ruleCount = (ic.security_policies || []).length;

        // Convert
        setItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'converting', vendor, ruleCount } : it
        ));

        const convertResult = await convertConfig(ic, 'set', {}, null);
        const srxOutput = (convertResult.commands || []).join('\n');
        const warningCount = (convertResult.warnings || []).length;

        setItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'done', vendor, ruleCount, warningCount, srxOutput } : it
        ));
      } catch (err) {
        setItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'error', error: err.message || 'Unknown error' } : it
        ));
      }
    }

    setIsProcessing(false);
  }, [items]);

  /** Download SRX output for a single item */
  const handleDownloadSingle = useCallback((item) => {
    if (!item.srxOutput) return;
    const blob = new Blob([item.srxOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.filename.replace(/\.[^.]+$/, '') + '_srx.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  /** Download all completed outputs as a combined file */
  const handleDownloadAll = useCallback(() => {
    const doneItems = items.filter(it => it.status === 'done' && it.srxOutput);
    if (doneItems.length === 0) return;

    const combined = doneItems.map(it => {
      const header = `# ===== ${it.filename} (${VENDOR_LABELS[it.vendor] || it.vendor}) =====`;
      return `${header}\n${it.srxOutput}\n`;
    }).join('\n\n');

    const blob = new Blob([combined], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `batch-migration-${ts}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const doneCount = items.filter(it => it.status === 'done').length;
  const errorCount = items.filter(it => it.status === 'error').length;
  const totalRules = items.reduce((s, it) => s + it.ruleCount, 0);
  const totalWarnings = items.reduce((s, it) => s + it.warningCount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)' }}>Batch Migration</h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Upload multiple config files for independent conversion
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {items.length > 0 && (
            <button className="btn btn-sm" onClick={handleClearAll} disabled={isProcessing}>Clear All</button>
          )}
          <button className="btn btn-primary btn-sm"
            onClick={handleProcessAll}
            disabled={isProcessing || items.length === 0 || items.every(it => it.status === 'done')}>
            {isProcessing ? 'Processing...' : `Convert All (${items.length})`}
          </button>
          {doneCount > 0 && (
            <button className="btn btn-primary btn-sm" onClick={handleDownloadAll}>
              Download All ({doneCount})
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {items.length > 0 && (
        <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 16, fontSize: 12 }}>
          <span>Files: <strong>{items.length}</strong></span>
          <span>Done: <strong style={{ color: 'var(--success)' }}>{doneCount}</strong></span>
          {errorCount > 0 && <span>Errors: <strong style={{ color: 'var(--error, #e74c3c)' }}>{errorCount}</strong></span>}
          <span>Total Rules: <strong>{totalRules}</strong></span>
          <span>Total Warnings: <strong>{totalWarnings}</strong></span>
        </div>
      )}

      {/* File list or dropzone */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {items.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: 48,
              textAlign: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'border-color 0.2s',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: 12 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ fontSize: 14, marginBottom: 4 }}>Drop config files here or click to browse</p>
            <p style={{ fontSize: 12 }}>Supports all 7 vendor formats. Each file is converted independently.</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.conf,.cfg,.xml,.json,.log"
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        ) : (
          <>
            {/* Add more files button */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>+ Add Files</button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.conf,.cfg,.xml,.json,.log"
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {/* File table */}
            <table className="report-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Filename</th>
                  <th style={{ width: 100 }}>Vendor</th>
                  <th style={{ width: 70 }}>Rules</th>
                  <th style={{ width: 80 }}>Warnings</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td style={{ color: 'var(--text-muted)' }}>{index + 1}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.filename}</td>
                    <td>{VENDOR_LABELS[item.vendor] || item.vendor || '-'}</td>
                    <td>{item.ruleCount || '-'}</td>
                    <td>{item.warningCount || '-'}</td>
                    <td>
                      <span style={{
                        color: STATUS[item.status]?.color || 'var(--text-muted)',
                        fontWeight: item.status === 'done' || item.status === 'error' ? 600 : 400,
                      }}>
                        {STATUS[item.status]?.label || item.status}
                      </span>
                      {item.error && (
                        <div style={{ fontSize: 10, color: 'var(--error, #e74c3c)', marginTop: 2 }}>{item.error}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {item.status === 'done' && (
                          <button className="btn btn-sm" onClick={() => handleDownloadSingle(item)} title="Download SRX output">
                            Download
                          </button>
                        )}
                        <button className="btn-icon btn-icon-danger" onClick={() => handleRemoveItem(index)}
                          disabled={isProcessing} title="Remove">x</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Drop target overlay when files exist */}
        {items.length > 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{
              marginTop: 16,
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: 16,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            Drop more files here or click to add
          </div>
        )}
      </div>
    </div>
  );
}
