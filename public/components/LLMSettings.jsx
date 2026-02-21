/**
 * LLMSettings Component
 *
 * Modal dialog for configuring the LLM provider used by the interview engine.
 * Phase 1: Shows a placeholder UI with provider selection.
 * Phase 3: Full implementation with API key management, model selection,
 *          test connection, and provider-specific settings.
 *
 * Settings are stored in localStorage only — API keys never leave the browser.
 */
import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  { id: 'claude', name: 'Claude (Anthropic)', defaultModel: 'claude-sonnet-4-6' },
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o' },
  { id: 'ollama', name: 'Ollama (Local)', defaultModel: 'llama3' },
  { id: 'lmstudio', name: 'LM Studio (Local)', defaultModel: 'local-model' },
  { id: 'custom', name: 'Custom OpenAI-Compatible', defaultModel: '' },
];

export default function LLMSettings({ onClose }) {
  const [provider, setProvider] = useState('claude');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [baseUrl, setBaseUrl] = useState('');
  const [temperature, setTemperature] = useState(0.2);

  // Load saved settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('llm-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setProvider(settings.provider || 'claude');
        setApiKey(settings.apiKey || '');
        setModel(settings.model || 'claude-sonnet-4-6');
        setBaseUrl(settings.baseUrl || '');
        setTemperature(settings.temperature ?? 0.2);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  /** Save settings to localStorage */
  const handleSave = () => {
    const settings = { provider, apiKey, model, baseUrl, temperature };
    localStorage.setItem('llm-settings', JSON.stringify(settings));
    onClose();
  };

  /** Update defaults when provider changes */
  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    const p = PROVIDERS.find(pr => pr.id === newProvider);
    if (p) setModel(p.defaultModel);
    // Set default base URLs for local providers
    if (newProvider === 'ollama') setBaseUrl('http://localhost:11434');
    else if (newProvider === 'lmstudio') setBaseUrl('http://localhost:1234');
    else setBaseUrl('');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        padding: '24px',
        width: '480px',
        maxHeight: '80vh',
        overflow: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px' }}>LLM Configuration</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
          >
            x
          </button>
        </div>

        {/* Phase 3 notice */}
        <div style={{
          background: 'var(--accent-glow)',
          border: '1px solid var(--accent-dim)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          marginBottom: '20px',
          fontSize: '12px',
          color: 'var(--accent)',
        }}>
          Interview engine and LLM integration coming in Phase 2 & 3. Settings saved locally for when it's ready.
        </div>

        {/* Provider selector */}
        <SettingsField label="Provider">
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            style={selectStyle}
          >
            {PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </SettingsField>

        {/* API Key (not shown for local providers) */}
        {!['ollama', 'lmstudio'].includes(provider) && (
          <SettingsField label="API Key">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
              style={inputStyle}
            />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Stored in browser localStorage only — never sent to our server.
            </div>
          </SettingsField>
        )}

        {/* Base URL (for local/custom providers) */}
        {['ollama', 'lmstudio', 'custom'].includes(provider) && (
          <SettingsField label="Base URL">
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              style={inputStyle}
            />
          </SettingsField>
        )}

        {/* Model */}
        <SettingsField label="Model">
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model name..."
            style={inputStyle}
          />
        </SettingsField>

        {/* Temperature */}
        <SettingsField label={`Temperature: ${temperature}`}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>Precise (0.0)</span>
            <span>Creative (1.0)</span>
          </div>
        </SettingsField>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

function SettingsField({ label, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: '500',
        color: 'var(--text-secondary)',
        marginBottom: '6px',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};
