/**
 * NATEditor Component
 *
 * Editable NAT rule table for the "NAT" tab in the center panel.
 * Each NAT rule shows: name, type, zones, addresses, translated addresses/ports.
 * Supports add/edit/delete.
 */
import React from 'react';
import { ChipEditor } from './ZoneEditor.jsx';

export default function NATEditor({ natRules, onNATUpdate, viewMode }) {
  const isSrx = viewMode === 'srx';
  const handleChange = (index, field, value) => {
    const updated = natRules.map((rule, i) =>
      i === index ? { ...rule, [field]: value } : rule
    );
    onNATUpdate(updated);
  };

  const handleChipAdd = (index, field, value) => {
    const rule = natRules[index];
    const current = rule[field] || [];
    if (current.includes(value)) return;
    handleChange(index, field, [...current, value]);
  };

  const handleChipRemove = (index, field, value) => {
    const rule = natRules[index];
    handleChange(index, field, (rule[field] || []).filter(v => v !== value));
  };

  const handleAdd = () => {
    onNATUpdate([...natRules, {
      name: `nat-rule-${natRules.length + 1}`,
      type: 'source',
      src_zones: [],
      dst_zones: [],
      src_addresses: [],
      dst_addresses: [],
      translated_src: null,
      translated_dst: '',
      translated_port: '',
      description: '',
      _rule_index: natRules.length + 1,
    }]);
  };

  const handleDelete = (index) => {
    onNATUpdate(natRules.filter((_, i) => i !== index));
  };

  /** Update translated_src nested object */
  const handleTranslatedSrcChange = (index, translationType) => {
    let translatedSrc = null;
    if (translationType === 'interface') {
      translatedSrc = { type: 'interface', interface: '' };
    } else if (translationType === 'dynamic-ip-pool') {
      translatedSrc = { type: 'dynamic-ip-pool', addresses: [] };
    } else if (translationType === 'static') {
      translatedSrc = { type: 'static', address: '' };
    }
    handleChange(index, 'translated_src', translatedSrc);
  };

  if (!natRules || natRules.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No NAT rules defined.</p>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add NAT Rule</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="editor-list">
        {natRules.map((rule, index) => (
          <div key={index} className="editor-card">
            <div className="editor-card-header">
              <input
                className="editor-inline-input editor-name-input"
                value={rule.name}
                onChange={(e) => handleChange(index, 'name', e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  className="cell-select"
                  value={rule.type}
                  onChange={(e) => handleChange(index, 'type', e.target.value)}
                  style={{ width: 130 }}
                >
                  <option value="source">{isSrx ? 'source-nat rule-set' : 'Source NAT'}</option>
                  <option value="destination">{isSrx ? 'destination-nat rule-set' : 'Destination NAT'}</option>
                  <option value="static">{isSrx ? 'static-nat rule-set' : 'Static NAT'}</option>
                </select>
                <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(index)} title="Delete">x</button>
              </div>
            </div>

            <div className="editor-card-body">
              <div className="editor-field-row">
                <div className="editor-field" style={{ flex: 1 }}>
                  <label>Source Zones</label>
                  <ChipEditor
                    values={rule.src_zones}
                    onAdd={(v) => handleChipAdd(index, 'src_zones', v)}
                    onRemove={(v) => handleChipRemove(index, 'src_zones', v)}
                    placeholder="Zone..."
                  />
                </div>
                <div className="editor-field" style={{ flex: 1 }}>
                  <label>Destination Zones</label>
                  <ChipEditor
                    values={rule.dst_zones}
                    onAdd={(v) => handleChipAdd(index, 'dst_zones', v)}
                    onRemove={(v) => handleChipRemove(index, 'dst_zones', v)}
                    placeholder="Zone..."
                  />
                </div>
              </div>

              <div className="editor-field-row">
                <div className="editor-field" style={{ flex: 1 }}>
                  <label>Source Addresses</label>
                  <ChipEditor
                    values={rule.src_addresses}
                    onAdd={(v) => handleChipAdd(index, 'src_addresses', v)}
                    onRemove={(v) => handleChipRemove(index, 'src_addresses', v)}
                    placeholder="Address..."
                  />
                </div>
                <div className="editor-field" style={{ flex: 1 }}>
                  <label>Destination Addresses</label>
                  <ChipEditor
                    values={rule.dst_addresses}
                    onAdd={(v) => handleChipAdd(index, 'dst_addresses', v)}
                    onRemove={(v) => handleChipRemove(index, 'dst_addresses', v)}
                    placeholder="Address..."
                  />
                </div>
              </div>

              {/* Translation config — varies by NAT type */}
              {(rule.type === 'source' || rule.type === 'static') && (
                <div className="editor-field">
                  <label>Source Translation</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="cell-select"
                      value={rule.translated_src?.type || ''}
                      onChange={(e) => handleTranslatedSrcChange(index, e.target.value)}
                      style={{ width: 160 }}
                    >
                      <option value="">None</option>
                      <option value="interface">Interface</option>
                      <option value="dynamic-ip-pool">Dynamic IP Pool</option>
                      <option value="static">Static IP</option>
                    </select>
                    {rule.translated_src?.type === 'interface' && (
                      <input
                        className="cell-input"
                        value={rule.translated_src.interface || ''}
                        onChange={(e) => handleChange(index, 'translated_src', { ...rule.translated_src, interface: e.target.value })}
                        placeholder="Interface name"
                        style={{ flex: 1 }}
                      />
                    )}
                    {rule.translated_src?.type === 'static' && (
                      <input
                        className="cell-input"
                        value={rule.translated_src.address || ''}
                        onChange={(e) => handleChange(index, 'translated_src', { ...rule.translated_src, address: e.target.value })}
                        placeholder="Static IP address"
                        style={{ flex: 1 }}
                      />
                    )}
                  </div>
                </div>
              )}

              {(rule.type === 'destination' || rule.type === 'static') && (
                <div className="editor-field-row">
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>Translated Destination</label>
                    <input
                      className="cell-input"
                      value={typeof rule.translated_dst === 'string' ? rule.translated_dst : ''}
                      onChange={(e) => handleChange(index, 'translated_dst', e.target.value)}
                      placeholder="Translated IP"
                    />
                  </div>
                  <div className="editor-field" style={{ width: 120 }}>
                    <label>Translated Port</label>
                    <input
                      className="cell-input"
                      value={rule.translated_port || ''}
                      onChange={(e) => handleChange(index, 'translated_port', e.target.value)}
                      placeholder="Port"
                    />
                  </div>
                </div>
              )}

              <div className="editor-field">
                <label>Description</label>
                <input
                  className="editor-inline-input"
                  value={rule.description || ''}
                  onChange={(e) => handleChange(index, 'description', e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add NAT Rule</button>
      </div>
    </div>
  );
}
