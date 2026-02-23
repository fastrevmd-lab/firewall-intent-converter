/**
 * SyslogEditor Component
 *
 * Card-based editor for syslog server configurations.
 * Each card shows: server, port, transport, facility, optional vendor-specific fields.
 */
import React from 'react';

export default function SyslogEditor({ syslogConfig, onSyslogUpdate, viewMode }) {

  const handleChange = (index, field, value) => {
    const updated = syslogConfig.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    onSyslogUpdate(updated);
  };

  const handleAdd = () => {
    onSyslogUpdate([...syslogConfig, {
      name: `syslog-${syslogConfig.length + 1}`,
      server: '',
      port: 514,
      transport: 'udp',
      facility: 'local0',
      source_address: '',
      structured_data: false,
      facilities: [],
      profile: '',
      interface: '',
      level: '',
      source_ip: '',
    }]);
  };

  const handleDelete = (index) => {
    onSyslogUpdate(syslogConfig.filter((_, i) => i !== index));
  };

  /* ---- Facilities sub-list handlers ---- */
  const handleFacilityAdd = (index) => {
    const updated = syslogConfig.map((entry, i) =>
      i === index ? { ...entry, facilities: [...(entry.facilities || []), { facility: 'any', level: 'any' }] } : entry
    );
    onSyslogUpdate(updated);
  };

  const handleFacilityDelete = (entryIdx, facIdx) => {
    const updated = syslogConfig.map((entry, i) =>
      i === entryIdx ? { ...entry, facilities: (entry.facilities || []).filter((_, j) => j !== facIdx) } : entry
    );
    onSyslogUpdate(updated);
  };

  const handleFacilityChange = (entryIdx, facIdx, field, value) => {
    const updated = syslogConfig.map((entry, i) => {
      if (i !== entryIdx) return entry;
      const facs = (entry.facilities || []).map((f, j) =>
        j === facIdx ? { ...f, [field]: value } : f
      );
      return { ...entry, facilities: facs };
    });
    onSyslogUpdate(updated);
  };

  if (!syslogConfig || syslogConfig.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No syslog servers defined.</p>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add Syslog Server</button>
        </div>
      </div>
    );
  }

  const sectionLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' };
  const checkField = { width: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 };

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="editor-list">
        {syslogConfig.map((entry, index) => (
          <div key={index} className="editor-card">
            <div className="editor-card-header">
              <input className="editor-inline-input editor-name-input"
                value={entry.name || ''}
                onChange={(e) => handleChange(index, 'name', e.target.value)} />
              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(index)} title="Delete">x</button>
            </div>

            <div className="editor-card-body">
              {/* Connection */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>Connection</label>
                <div className="editor-field-row">
                  <div className="editor-field" style={{ flex: 2 }}>
                    <label>Server</label>
                    <input className="cell-input" value={entry.server || ''}
                      onChange={(e) => handleChange(index, 'server', e.target.value)}
                      placeholder="IP or hostname" />
                  </div>
                  <div className="editor-field" style={{ width: 80 }}>
                    <label>Port</label>
                    <input className="cell-input" type="number" value={entry.port ?? 514}
                      onChange={(e) => handleChange(index, 'port', parseInt(e.target.value, 10) || 0)} />
                  </div>
                  <div className="editor-field" style={{ width: 100 }}>
                    <label>Transport</label>
                    <select className="cell-select" value={entry.transport || 'udp'}
                      onChange={(e) => handleChange(index, 'transport', e.target.value)}>
                      <option value="udp">UDP</option>
                      <option value="tcp">TCP</option>
                      <option value="tls">TLS</option>
                    </select>
                  </div>
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>Facility</label>
                    <input className="cell-input" value={entry.facility || ''}
                      onChange={(e) => handleChange(index, 'facility', e.target.value)}
                      placeholder="e.g. local0" />
                  </div>
                </div>
              </div>

              {/* Optional fields */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>Options</label>
                <div className="editor-field-row">
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>Source Address</label>
                    <input className="cell-input" value={entry.source_address || entry.source_ip || ''}
                      onChange={(e) => handleChange(index, 'source_address', e.target.value)}
                      placeholder="Source IP" />
                  </div>
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>Profile</label>
                    <input className="cell-input" value={entry.profile || ''}
                      onChange={(e) => handleChange(index, 'profile', e.target.value)} />
                  </div>
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>Interface</label>
                    <input className="cell-input" value={entry.interface || ''}
                      onChange={(e) => handleChange(index, 'interface', e.target.value)} />
                  </div>
                  <div className="editor-field" style={{ width: 80 }}>
                    <label>Level</label>
                    <input className="cell-input" value={entry.level || ''}
                      onChange={(e) => handleChange(index, 'level', e.target.value)} />
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={entry.structured_data ?? false}
                      onChange={(e) => handleChange(index, 'structured_data', e.target.checked)} />
                    <label>Structured</label>
                  </div>
                </div>
              </div>

              {/* Facilities sub-list */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>
                  Facility/Severity Pairs ({(entry.facilities || []).length})
                </label>
                {(entry.facilities || []).map((fac, facIdx) => (
                  <div key={facIdx} className="editor-field-row" style={{ marginBottom: 4 }}>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Facility</label>
                      <input className="cell-input" value={fac.facility || ''}
                        onChange={(e) => handleFacilityChange(index, facIdx, 'facility', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 140 }}>
                      <label>Level</label>
                      <select className="cell-select" value={fac.level || 'any'}
                        onChange={(e) => handleFacilityChange(index, facIdx, 'level', e.target.value)}>
                        <option value="any">any</option>
                        <option value="emergency">emergency</option>
                        <option value="alert">alert</option>
                        <option value="critical">critical</option>
                        <option value="error">error</option>
                        <option value="warning">warning</option>
                        <option value="notice">notice</option>
                        <option value="info">info</option>
                      </select>
                    </div>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleFacilityDelete(index, facIdx)}
                      title="Remove" style={{ alignSelf: 'flex-end', marginBottom: 4 }}>x</button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => handleFacilityAdd(index)}
                  style={{ marginTop: 4, fontSize: 11 }}>+ Add Facility</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add Syslog Server</button>
      </div>
    </div>
  );
}
