/**
 * Main Application Component
 *
 * Orchestrates the four-panel layout:
 *   LEFT:   ConfigInput   — paste/upload PAN-OS config
 *   CENTER: Tabbed editor — Security Rules / Zones / Objects / NAT
 *   RIGHT:  InterviewPanel — editable rule details + LLM suggestions
 *   BOTTOM: SRXOutput     — generated SRX commands + warnings
 *
 * State flow:
 *   1. User pastes/uploads config  →  configText
 *   2. Click "Parse" sends to /api/parse  →  intermediateConfig + parseWarnings
 *   3. ModelSelector auto-opens  →  sourceModel + targetModel
 *   4. InterfaceMapper opens  →  interfaceMappings
 *   5. User edits config in tabbed panels
 *   6. Click "Convert" sends to /api/convert  →  srxOutput + convertWarnings
 */
import React, { useState, useCallback } from 'react';
import ConfigInput from './components/ConfigInput.jsx';
import PolicyTable from './components/PolicyTable.jsx';
import InterviewPanel from './components/InterviewPanel.jsx';
import SRXOutput from './components/SRXOutput.jsx';
import WarningsPanel from './components/WarningsPanel.jsx';
import LLMSettings from './components/LLMSettings.jsx';
import ModelSelector from './components/ModelSelector.jsx';
import InterfaceMapper from './components/InterfaceMapper.jsx';
import ZoneEditor from './components/ZoneEditor.jsx';
import ObjectEditor from './components/ObjectEditor.jsx';
import NATEditor from './components/NATEditor.jsx';

export default function App() {
  // --- Config input state ---
  const [configText, setConfigText] = useState('');

  // --- Parsed data state ---
  const [intermediateConfig, setIntermediateConfig] = useState(null);
  const [parseWarnings, setParseWarnings] = useState([]);
  const [parseStats, setParseStats] = useState(null);

  // --- Hardware model state ---
  const [sourceModel, setSourceModel] = useState('');
  const [targetModel, setTargetModel] = useState('');
  const [interfaceMappings, setInterfaceMappings] = useState({});

  // --- Modal state ---
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showInterfaceMapper, setShowInterfaceMapper] = useState(false);

  // --- Center panel tab state ---
  const [editTab, setEditTab] = useState('rules');

  // --- Conversion output state ---
  const [srxOutput, setSrxOutput] = useState(null);
  const [convertWarnings, setConvertWarnings] = useState([]);
  const [conversionSummary, setConversionSummary] = useState(null);
  const [outputFormat, setOutputFormat] = useState('set');

  // --- UI state ---
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedRule, setSelectedRule] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [bottomTab, setBottomTab] = useState('output');
  const [error, setError] = useState(null);

  // --- All warnings combined (parse + convert) ---
  const allWarnings = [...parseWarnings, ...convertWarnings];

  // ------------------------------------------------------------------
  // Parse handler: sends config to /api/parse
  // ------------------------------------------------------------------
  const handleParse = useCallback(async () => {
    if (!configText.trim()) return;
    setIsLoading(true);
    setLoadingMessage('Parsing PAN-OS configuration...');
    setError(null);
    setSrxOutput(null);
    setConvertWarnings([]);
    setConversionSummary(null);
    setSelectedRule(null);
    setEditTab('rules');

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configText }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Parse failed');
      }

      setIntermediateConfig(data.intermediateConfig);
      setParseWarnings(data.warnings || []);
      setParseStats(data.parseStats || null);

      // Auto-open model selector after successful parse
      setShowModelSelector(true);
    } catch (err) {
      setError(`Parse error: ${err.message}`);
      setIntermediateConfig(null);
      setParseWarnings([]);
      setParseStats(null);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [configText]);

  // ------------------------------------------------------------------
  // Convert handler: sends intermediate config to /api/convert
  // ------------------------------------------------------------------
  const handleConvert = useCallback(async (format = 'set') => {
    if (!intermediateConfig) return;
    setIsLoading(true);
    setLoadingMessage('Converting to SRX format...');
    setError(null);

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intermediateConfig, format, interfaceMappings }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      setSrxOutput(data.output);
      setConvertWarnings(data.output.warnings || []);
      setConversionSummary(data.output.summary || null);
      setOutputFormat(format);
      setBottomTab('output');
    } catch (err) {
      setError(`Conversion error: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [intermediateConfig, interfaceMappings]);

  // ------------------------------------------------------------------
  // Config update handlers (mutable editing)
  // ------------------------------------------------------------------

  /** Update a single security rule by index */
  const handleUpdateRule = useCallback((index, updatedRule) => {
    setIntermediateConfig(prev => {
      const policies = [...prev.security_policies];
      policies[index] = updatedRule;
      return { ...prev, security_policies: policies };
    });
  }, []);

  /** Delete a security rule by index */
  const handleDeleteRule = useCallback((index) => {
    setIntermediateConfig(prev => ({
      ...prev,
      security_policies: prev.security_policies.filter((_, i) => i !== index),
    }));
    setSelectedRule(null);
  }, []);

  /** Add a new security rule */
  const handleAddRule = useCallback(() => {
    setIntermediateConfig(prev => {
      const newIndex = (prev.security_policies?.length || 0) + 1;
      const newRule = {
        name: `new-rule-${newIndex}`,
        _rule_index: newIndex,
        action: 'deny',
        src_zones: [],
        dst_zones: [],
        src_addresses: [],
        dst_addresses: [],
        applications: [],
        services: [],
        log_start: false,
        log_end: true,
        disabled: false,
        description: '',
        tags: [],
        profile_group: '',
      };
      return {
        ...prev,
        security_policies: [...(prev.security_policies || []), newRule],
      };
    });
  }, []);

  /** Update zones */
  const handleZonesUpdate = useCallback((zones) => {
    setIntermediateConfig(prev => ({ ...prev, zones }));
  }, []);

  /** Update NAT rules */
  const handleNATUpdate = useCallback((natRules) => {
    setIntermediateConfig(prev => ({ ...prev, nat_rules: natRules }));
  }, []);

  /** Update a config section (for ObjectEditor) */
  const handleConfigUpdate = useCallback((field, items) => {
    setIntermediateConfig(prev => ({ ...prev, [field]: items }));
  }, []);

  // ------------------------------------------------------------------
  // Model / mapping handlers
  // ------------------------------------------------------------------

  const handleModelSelection = useCallback(({ sourceModel: src, targetModel: tgt }) => {
    setSourceModel(src || '');
    setTargetModel(tgt || '');
  }, []);

  const handleModelContinue = useCallback(() => {
    setShowModelSelector(false);
    if (targetModel || true) {
      setShowInterfaceMapper(true);
    }
  }, [targetModel]);

  const handleMappingComplete = useCallback((mappings) => {
    setInterfaceMappings(mappings);
    setShowInterfaceMapper(false);
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="app-container">
      {/* --- Top Navigation Bar --- */}
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>
            Firewall Policy <span className="brand-accent">Converter</span>
          </h1>
        </div>

        {/* Stats badges — shown after parsing */}
        {parseStats && (
          <div className="navbar-stats">
            {sourceModel && (
              <span className="stat-badge model-badge" onClick={() => setShowModelSelector(true)} style={{ cursor: 'pointer' }}>
                {sourceModel} <span style={{ color: 'var(--accent)', margin: '0 4px' }}>&rarr;</span> {targetModel || '?'}
              </span>
            )}
            <span className="stat-badge">
              Zones <span className="stat-value">{parseStats.zone_count}</span>
            </span>
            <span className="stat-badge">
              Rules <span className="stat-value">{parseStats.rule_count}</span>
            </span>
            <span className="stat-badge">
              Objects <span className="stat-value">{parseStats.object_count}</span>
            </span>
            <span className="stat-badge">
              NAT <span className="stat-value">{parseStats.nat_rule_count}</span>
            </span>
            {allWarnings.length > 0 && (
              <span className="stat-badge">
                Warnings <span className="stat-value" style={{ color: 'var(--warning)' }}>
                  {allWarnings.length}
                </span>
              </span>
            )}
          </div>
        )}

        <div className="navbar-actions">
          {intermediateConfig && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowModelSelector(true)}
              title="Change hardware models"
            >
              Models
            </button>
          )}
          {intermediateConfig && targetModel && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowInterfaceMapper(true)}
              title="Edit interface mappings"
            >
              Interfaces
            </button>
          )}
          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="LLM Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </nav>

      {/* --- Error banner --- */}
      {error && (
        <div style={{
          background: 'rgba(248, 113, 113, 0.1)',
          borderBottom: '1px solid rgba(248, 113, 113, 0.3)',
          padding: '8px 20px',
          fontSize: '13px',
          color: 'var(--error)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '16px' }}
          >
            x
          </button>
        </div>
      )}

      {/* --- Loading bar --- */}
      {isLoading && (
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: '60%', animation: 'indeterminate 1.5s infinite' }} />
        </div>
      )}

      {/* --- Main Content Grid --- */}
      <div className="main-content">
        {/* LEFT: Config Input */}
        <ConfigInput
          configText={configText}
          onConfigChange={setConfigText}
          onParse={handleParse}
          isLoading={isLoading}
          isParsed={!!intermediateConfig}
          sourceModel={sourceModel}
          targetModel={targetModel}
          onOpenModels={() => setShowModelSelector(true)}
        />

        {/* CENTER: Tabbed Editor Panel */}
        <div className="panel policy-table-panel">
          {intermediateConfig ? (
            <>
              {/* Tab bar */}
              <div className="panel-header" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0 }}>
                <div className="center-tab-bar">
                  <button
                    className={`center-tab-btn ${editTab === 'rules' ? 'active' : ''}`}
                    onClick={() => setEditTab('rules')}
                  >
                    Security Rules ({intermediateConfig.security_policies?.length || 0})
                  </button>
                  <button
                    className={`center-tab-btn ${editTab === 'zones' ? 'active' : ''}`}
                    onClick={() => setEditTab('zones')}
                  >
                    Zones ({intermediateConfig.zones?.length || 0})
                  </button>
                  <button
                    className={`center-tab-btn ${editTab === 'objects' ? 'active' : ''}`}
                    onClick={() => setEditTab('objects')}
                  >
                    Objects
                  </button>
                  <button
                    className={`center-tab-btn ${editTab === 'nat' ? 'active' : ''}`}
                    onClick={() => setEditTab('nat')}
                  >
                    NAT ({intermediateConfig.nat_rules?.length || 0})
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleConvert('set')}
                    disabled={isLoading}
                    style={{ margin: '6px 12px' }}
                  >
                    Convert to SRX
                  </button>
                </div>
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {editTab === 'rules' && (
                  <PolicyTable
                    policies={intermediateConfig.security_policies || []}
                    warnings={allWarnings}
                    selectedRule={selectedRule}
                    onSelectRule={setSelectedRule}
                    onUpdateRule={handleUpdateRule}
                    onDeleteRule={handleDeleteRule}
                    onAddRule={handleAddRule}
                  />
                )}
                {editTab === 'zones' && (
                  <ZoneEditor
                    zones={intermediateConfig.zones || []}
                    onZonesUpdate={handleZonesUpdate}
                  />
                )}
                {editTab === 'objects' && (
                  <ObjectEditor
                    intermediateConfig={intermediateConfig}
                    onConfigUpdate={handleConfigUpdate}
                  />
                )}
                {editTab === 'nat' && (
                  <NATEditor
                    natRules={intermediateConfig.nat_rules || []}
                    onNATUpdate={handleNATUpdate}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="panel-header">
                <h2>Security Policies</h2>
              </div>
              <div className="panel-body">
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  <h3>No configuration loaded</h3>
                  <p>Paste a PAN-OS XML configuration in the left panel and click "Parse" to view security policies here.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Interview / Rule Details */}
        <InterviewPanel
          selectedRule={selectedRule}
          intermediateConfig={intermediateConfig}
          warnings={allWarnings}
          onUpdateRule={(updatedRule) => {
            if (!selectedRule || !intermediateConfig) return;
            const index = intermediateConfig.security_policies.findIndex(
              r => r.name === selectedRule.name && r._rule_index === selectedRule._rule_index
            );
            if (index >= 0) {
              handleUpdateRule(index, updatedRule);
              setSelectedRule(updatedRule);
            }
          }}
          targetModel={targetModel}
        />

        {/* BOTTOM: SRX Output + Warnings */}
        <div className="panel output-panel">
          <div className="panel-header">
            <div className="tab-bar">
              <button
                className={`tab-btn ${bottomTab === 'output' ? 'active' : ''}`}
                onClick={() => setBottomTab('output')}
              >
                SRX Output
              </button>
              <button
                className={`tab-btn ${bottomTab === 'warnings' ? 'active' : ''}`}
                onClick={() => setBottomTab('warnings')}
              >
                Warnings
                {allWarnings.length > 0 && (
                  <span className="tab-badge warning-count">{allWarnings.length}</span>
                )}
              </button>
            </div>
            {bottomTab === 'output' && srxOutput && (
              <div className="output-toolbar">
                <div className="output-format-toggle">
                  <button
                    className={`format-btn ${outputFormat === 'set' ? 'active' : ''}`}
                    onClick={() => handleConvert('set')}
                  >
                    Set Commands
                  </button>
                  <button
                    className={`format-btn ${outputFormat === 'xml' ? 'active' : ''}`}
                    onClick={() => handleConvert('xml')}
                  >
                    XML
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="panel-body">
            {bottomTab === 'output' ? (
              <SRXOutput
                output={srxOutput}
                format={outputFormat}
                summary={conversionSummary}
                isParsed={!!intermediateConfig}
              />
            ) : (
              <WarningsPanel warnings={allWarnings} />
            )}
          </div>
        </div>
      </div>

      {/* --- Modals --- */}
      {showSettings && (
        <LLMSettings onClose={() => setShowSettings(false)} />
      )}

      {showModelSelector && intermediateConfig && (
        <ModelSelector
          intermediateConfig={intermediateConfig}
          sourceModel={sourceModel}
          targetModel={targetModel}
          onModelSelection={handleModelSelection}
          onContinue={handleModelContinue}
          onClose={() => setShowModelSelector(false)}
        />
      )}

      {showInterfaceMapper && intermediateConfig && (
        <InterfaceMapper
          intermediateConfig={intermediateConfig}
          sourceModel={sourceModel}
          targetModel={targetModel}
          interfaceMappings={interfaceMappings}
          onMappingComplete={handleMappingComplete}
          onClose={() => setShowInterfaceMapper(false)}
        />
      )}
    </div>
  );
}
