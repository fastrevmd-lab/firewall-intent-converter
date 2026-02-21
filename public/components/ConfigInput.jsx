/**
 * ConfigInput Component
 *
 * Left panel for PAN-OS configuration input.
 * Supports:
 *   - Paste raw XML config text
 *   - Upload a config file (.xml, .txt)
 *   - Select a pre-loaded sample config for testing
 *   - Show source/target model badges after parsing
 */
import React, { useRef } from 'react';
import { SAMPLE_CONFIGS } from './sample-configs.jsx';

export default function ConfigInput({
  configText,
  onConfigChange,
  onParse,
  isLoading,
  isParsed,
  sourceModel,
  targetModel,
  onOpenModels,
}) {
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      onConfigChange(event.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadSample = (sampleKey) => {
    const sample = SAMPLE_CONFIGS[sampleKey];
    if (sample) {
      onConfigChange(sample.xml);
    }
  };

  return (
    <div className="panel config-input-panel">
      <div className="panel-header">
        <h2>Source Configuration</h2>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PAN-OS XML</span>
      </div>

      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Model badges — shown after models are selected */}
        {isParsed && (sourceModel || targetModel) && (
          <div
            className="model-badges-bar"
            onClick={onOpenModels}
            title="Click to change models"
          >
            <div className="model-badge-item">
              <span className="model-badge-label">Source</span>
              <span className="model-badge-value">{sourceModel || 'Auto'}</span>
            </div>
            <span style={{ color: 'var(--accent)', fontSize: 14 }}>&rarr;</span>
            <div className="model-badge-item">
              <span className="model-badge-label">Target</span>
              <span className="model-badge-value">{targetModel || 'Not set'}</span>
            </div>
          </div>
        )}

        {/* File upload area */}
        <div
          className="file-upload-area"
          onClick={() => fileInputRef.current?.click()}
        >
          <p>Click to upload config file (.xml, .txt)</p>
          <p style={{ fontSize: '10px', marginTop: '4px' }}>or drag and drop</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.txt,.conf"
            onChange={handleFileUpload}
          />
        </div>

        {/* Sample config selector */}
        <div className="sample-selector">
          <label>Load Sample Config</label>
          <div className="sample-buttons">
            {Object.entries(SAMPLE_CONFIGS).map(([key, sample]) => (
              <button
                key={key}
                className="sample-btn"
                onClick={() => loadSample(key)}
                title={sample.description}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        {/* Config textarea */}
        <textarea
          className="config-textarea"
          value={configText}
          onChange={(e) => onConfigChange(e.target.value)}
          placeholder={"Paste your PAN-OS XML configuration here...\n\nExample:\n<config version=\"10.1.0\">\n  <devices>\n    <entry name=\"localhost.localdomain\">\n      <vsys>\n        ..."}
          spellCheck={false}
          style={{ flex: 1 }}
        />

        {/* Parse button */}
        <button
          className="btn btn-primary btn-block"
          onClick={onParse}
          disabled={isLoading || !configText.trim()}
        >
          {isLoading ? (
            <>
              <span className="loading-spinner" style={{ width: 14, height: 14 }} />
              Parsing...
            </>
          ) : isParsed ? (
            'Re-Parse Configuration'
          ) : (
            'Parse Configuration'
          )}
        </button>
      </div>
    </div>
  );
}
