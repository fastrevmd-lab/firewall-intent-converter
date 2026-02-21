/**
 * InterviewPanel Component
 *
 * Right panel showing editable rule details + AI-powered suggestions.
 * When a rule is selected, all fields are editable inline.
 * "Get AI Suggestions" calls the configured LLM for best-practice advice.
 */
import React, { useState } from 'react';
import { getLLMSuggestion, getLLMStatus, buildRuleSuggestionPrompt } from '../utils/llm-client.js';

export default function InterviewPanel({
  selectedRule,
  intermediateConfig,
  warnings,
  onUpdateRule,
  targetModel,
}) {
  const [suggestion, setSuggestion] = useState('');
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');

  const ruleWarnings = selectedRule
    ? (warnings || []).filter(w => w.element?.includes(selectedRule.name))
    : [];

  const llmStatus = getLLMStatus();

  /** Request LLM suggestions for the selected rule */
  const handleGetSuggestion = async () => {
    if (!selectedRule) return;
    setIsLoadingSuggestion(true);
    setSuggestionError('');
    setSuggestion('');

    try {
      const prompt = buildRuleSuggestionPrompt(
        selectedRule,
        targetModel,
        intermediateConfig?.zones
      );
      const result = await getLLMSuggestion(prompt.user, prompt.system);
      setSuggestion(result);
    } catch (err) {
      setSuggestionError(err.message);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  /** Update a field on the selected rule */
  const handleFieldChange = (field, value) => {
    if (!selectedRule || !onUpdateRule) return;
    onUpdateRule({ ...selectedRule, [field]: value });
  };

  /** Handle toggling boolean fields */
  const handleToggle = (field) => {
    handleFieldChange(field, !selectedRule[field]);
  };

  // --- No rule selected ---
  if (!selectedRule) {
    return (
      <div className="panel interview-panel">
        <div className="panel-header">
          <h2>Rule Details</h2>
        </div>
        <div className="panel-body">
          {intermediateConfig ? (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
              </svg>
              <p>Click a rule in the table to see its full details, edit fields, and get AI suggestions.</p>
            </div>
          ) : (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3>Interview Engine</h3>
              <p>After parsing, this panel will show rule details, inline editing, and AI-powered best-practice suggestions.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Rule detail view with editing ---
  return (
    <div className="panel interview-panel">
      <div className="panel-header">
        <h2>Rule Details</h2>
        <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          #{selectedRule._rule_index}
        </span>
      </div>
      <div className="panel-body">
        {/* General */}
        <div className="detail-section">
          <h3>General</h3>
          <EditableField label="Name" value={selectedRule.name} onChange={(v) => handleFieldChange('name', v)} />
          <div className="detail-field">
            <span className="field-label">Action</span>
            <select
              className="field-select"
              value={selectedRule.action}
              onChange={(e) => handleFieldChange('action', e.target.value)}
            >
              <option value="allow">allow</option>
              <option value="deny">deny</option>
              <option value="drop">drop</option>
              <option value="reset-client">reset-client</option>
              <option value="reset-server">reset-server</option>
              <option value="reset-both">reset-both</option>
            </select>
          </div>
          <div className="detail-field">
            <span className="field-label">Disabled</span>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={selectedRule.disabled || false}
                onChange={() => handleToggle('disabled')}
              />
              <span>{selectedRule.disabled ? 'Yes' : 'No'}</span>
            </label>
          </div>
          <EditableField
            label="Description"
            value={selectedRule.description || ''}
            onChange={(v) => handleFieldChange('description', v)}
            placeholder="Add description..."
          />
        </div>

        {/* Zones */}
        <div className="detail-section">
          <h3>Zones</h3>
          <EditableChipsField
            label="Source"
            values={selectedRule.src_zones}
            onChange={(v) => handleFieldChange('src_zones', v)}
          />
          <EditableChipsField
            label="Destination"
            values={selectedRule.dst_zones}
            onChange={(v) => handleFieldChange('dst_zones', v)}
          />
        </div>

        {/* Addresses */}
        <div className="detail-section">
          <h3>Addresses</h3>
          <EditableChipsField
            label="Source"
            values={selectedRule.src_addresses}
            onChange={(v) => handleFieldChange('src_addresses', v)}
          />
          <EditableChipsField
            label="Destination"
            values={selectedRule.dst_addresses}
            onChange={(v) => handleFieldChange('dst_addresses', v)}
          />
        </div>

        {/* Applications / Services */}
        <div className="detail-section">
          <h3>Applications & Services</h3>
          <EditableChipsField
            label="Applications"
            values={selectedRule.applications}
            onChange={(v) => handleFieldChange('applications', v)}
          />
          <EditableChipsField
            label="Services"
            values={selectedRule.services}
            onChange={(v) => handleFieldChange('services', v)}
          />
        </div>

        {/* Logging */}
        <div className="detail-section">
          <h3>Logging</h3>
          <div className="detail-field">
            <span className="field-label">Log Start</span>
            <label className="toggle-label">
              <input type="checkbox" checked={selectedRule.log_start || false} onChange={() => handleToggle('log_start')} />
              <span>{selectedRule.log_start ? 'Yes' : 'No'}</span>
            </label>
          </div>
          <div className="detail-field">
            <span className="field-label">Log End</span>
            <label className="toggle-label">
              <input type="checkbox" checked={selectedRule.log_end || false} onChange={() => handleToggle('log_end')} />
              <span>{selectedRule.log_end ? 'Yes' : 'No'}</span>
            </label>
          </div>
        </div>

        {/* Security Profiles */}
        <div className="detail-section">
          <h3>Security Profiles</h3>
          <EditableField
            label="Profile Group"
            value={selectedRule.profile_group || ''}
            onChange={(v) => handleFieldChange('profile_group', v)}
            placeholder="None"
          />
        </div>

        {/* Tags */}
        <div className="detail-section">
          <h3>Tags</h3>
          <EditableChipsField
            label="Tags"
            values={selectedRule.tags || []}
            onChange={(v) => handleFieldChange('tags', v)}
          />
        </div>

        {/* Warnings for this rule */}
        {ruleWarnings.length > 0 && (
          <div className="detail-section">
            <h3>Conversion Notes ({ruleWarnings.length})</h3>
            {ruleWarnings.map((w, i) => (
              <div key={i} className="warning-item" style={{ padding: '8px 0' }}>
                <WarningIcon severity={w.severity} />
                <div className="warning-body">
                  <div className="warning-message">{w.message}</div>
                  {w.suggestion && (
                    <div className="warning-suggestion">{w.suggestion}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LLM Suggestions */}
        <div className="detail-section">
          <h3>AI Suggestions</h3>
          <button
            className="btn btn-secondary btn-sm btn-block"
            onClick={handleGetSuggestion}
            disabled={isLoadingSuggestion || !llmStatus.configured}
            style={{ marginBottom: 8 }}
          >
            {isLoadingSuggestion ? (
              <>
                <span className="loading-spinner" style={{ width: 12, height: 12 }} />
                Analyzing...
              </>
            ) : (
              'Get AI Suggestions'
            )}
          </button>

          {!llmStatus.configured && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Configure an LLM provider in Settings to enable AI suggestions.
            </p>
          )}

          {suggestionError && (
            <div className="suggestion-error">
              {suggestionError}
            </div>
          )}

          {suggestion && (
            <div className="suggestion-card">
              <div className="suggestion-content">{suggestion}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Editable text field */
function EditableField({ label, value, onChange, placeholder }) {
  return (
    <div className="detail-field">
      <span className="field-label">{label}</span>
      <input
        className="field-edit-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Editable chips field for arrays */
function EditableChipsField({ label, values, onChange }) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || (values || []).includes(trimmed)) return;
    onChange([...(values || []), trimmed]);
    setInputValue('');
  };

  const handleRemove = (val) => {
    onChange((values || []).filter(v => v !== val));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="detail-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <span className="field-label">{label}</span>
      <div className="field-chips-container">
        {(values || []).length === 0 && (
          <span className="cell-chip" style={{ opacity: 0.5 }}>any</span>
        )}
        {(values || []).map((v, i) => (
          <span key={i} className="chip">
            {v}
            <button className="chip-remove" onClick={() => handleRemove(v)}>x</button>
          </span>
        ))}
        <input
          className="chip-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add..."
          style={{ minWidth: 60, flex: 1 }}
        />
      </div>
    </div>
  );
}

/** Small severity icon */
function WarningIcon({ severity }) {
  const symbols = {
    clean: '\u2705',
    warning: '\u26A0\uFE0F',
    unsupported: '\u274C',
    interview_required: '\uD83D\uDCAC',
  };
  return (
    <span className={`warning-icon ${severity}`}>
      {symbols[severity] || '?'}
    </span>
  );
}
