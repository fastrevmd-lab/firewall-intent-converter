/**
 * ZoneEditor Component
 *
 * Editable zone panel for the "Zones" tab in the center panel.
 * Each zone shows: name (editable), description (editable), interfaces (chip editor).
 * Supports adding new zones and deleting existing ones.
 */
import React, { useState } from 'react';

export default function ZoneEditor({ zones, onZonesUpdate }) {
  const [editingZone, setEditingZone] = useState(null); // index of zone being edited

  /** Update a single field on a zone */
  const handleFieldChange = (index, field, value) => {
    const updated = zones.map((z, i) =>
      i === index ? { ...z, [field]: value } : z
    );
    onZonesUpdate(updated);
  };

  /** Add a new blank zone */
  const handleAdd = () => {
    onZonesUpdate([
      ...zones,
      { name: `zone-${zones.length + 1}`, description: '', interfaces: [] },
    ]);
  };

  /** Delete a zone */
  const handleDelete = (index) => {
    onZonesUpdate(zones.filter((_, i) => i !== index));
  };

  /** Add an interface to a zone */
  const handleAddInterface = (zoneIndex, ifaceName) => {
    if (!ifaceName.trim()) return;
    const zone = zones[zoneIndex];
    if (zone.interfaces.includes(ifaceName.trim())) return;
    handleFieldChange(zoneIndex, 'interfaces', [...zone.interfaces, ifaceName.trim()]);
  };

  /** Remove an interface from a zone */
  const handleRemoveInterface = (zoneIndex, ifaceName) => {
    const zone = zones[zoneIndex];
    handleFieldChange(zoneIndex, 'interfaces', zone.interfaces.filter(i => i !== ifaceName));
  };

  if (!zones || zones.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No zones defined.</p>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add Zone</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-body" style={{ padding: 0 }}>
      <div className="editor-list">
        {zones.map((zone, index) => (
          <div key={index} className="editor-card">
            <div className="editor-card-header">
              <input
                className="editor-inline-input editor-name-input"
                value={zone.name}
                onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                placeholder="Zone name"
              />
              <button
                className="btn-icon btn-icon-danger"
                onClick={() => handleDelete(index)}
                title="Delete zone"
              >
                x
              </button>
            </div>

            <div className="editor-card-body">
              <div className="editor-field">
                <label>Description</label>
                <input
                  className="editor-inline-input"
                  value={zone.description || ''}
                  onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                  placeholder="Optional description"
                />
              </div>

              <div className="editor-field">
                <label>Interfaces</label>
                <ChipEditor
                  values={zone.interfaces}
                  onAdd={(val) => handleAddInterface(index, val)}
                  onRemove={(val) => handleRemoveInterface(index, val)}
                  placeholder="Add interface..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>
          + Add Zone
        </button>
      </div>
    </div>
  );
}

/** Reusable chip editor for string arrays */
export function ChipEditor({ values, onAdd, onRemove, placeholder }) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      onAdd(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="chip-editor">
      {(values || []).map((val, i) => (
        <span key={i} className="chip">
          {val}
          <button className="chip-remove" onClick={() => onRemove(val)}>x</button>
        </span>
      ))}
      <input
        className="chip-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type and press Enter'}
      />
    </div>
  );
}
