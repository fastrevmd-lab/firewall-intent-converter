/**
 * SNMPEditor Component
 *
 * Card-based editor for SNMP configuration items.
 * Supports community strings, trap groups, and SNMPv3 users.
 */
import React from 'react';

export default function SNMPEditor({ snmpConfig, onSNMPUpdate, viewMode }) {

  const handleChange = (index, field, value) => {
    const updated = snmpConfig.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    onSNMPUpdate(updated);
  };

  const handleAdd = (type) => {
    const defaults = {
      community: {
        type: 'community',
        name: `community-${snmpConfig.filter(e => e.type === 'community').length + 1}`,
        authorization: 'read-only',
        clients: [],
        contact: '',
        location: '',
      },
      'trap-group': {
        type: 'trap-group',
        name: `trap-group-${snmpConfig.filter(e => e.type === 'trap-group').length + 1}`,
        targets: [],
        categories: [],
        version: 'v2c',
      },
      'v3-user': {
        type: 'v3-user',
        name: `v3-user-${snmpConfig.filter(e => e.type === 'v3-user').length + 1}`,
        auth_protocol: 'sha',
        privacy_protocol: 'aes128',
        contact: '',
        location: '',
      },
    };
    onSNMPUpdate([...snmpConfig, defaults[type]]);
  };

  const handleDelete = (index) => {
    onSNMPUpdate(snmpConfig.filter((_, i) => i !== index));
  };

  /* ---- Trap targets sub-list handlers ---- */
  const handleTargetAdd = (index) => {
    const updated = snmpConfig.map((entry, i) =>
      i === index ? { ...entry, targets: [...(entry.targets || []), ''] } : entry
    );
    onSNMPUpdate(updated);
  };

  const handleTargetChange = (entryIdx, targetIdx, value) => {
    const updated = snmpConfig.map((entry, i) => {
      if (i !== entryIdx) return entry;
      const targets = (entry.targets || []).map((t, j) => j === targetIdx ? value : t);
      return { ...entry, targets };
    });
    onSNMPUpdate(updated);
  };

  const handleTargetDelete = (entryIdx, targetIdx) => {
    const updated = snmpConfig.map((entry, i) =>
      i === entryIdx ? { ...entry, targets: (entry.targets || []).filter((_, j) => j !== targetIdx) } : entry
    );
    onSNMPUpdate(updated);
  };

  /* ---- Client restriction sub-list handlers ---- */
  const handleClientAdd = (index) => {
    const updated = snmpConfig.map((entry, i) =>
      i === index ? { ...entry, clients: [...(entry.clients || []), ''] } : entry
    );
    onSNMPUpdate(updated);
  };

  const handleClientChange = (entryIdx, clientIdx, value) => {
    const updated = snmpConfig.map((entry, i) => {
      if (i !== entryIdx) return entry;
      const clients = (entry.clients || []).map((c, j) => j === clientIdx ? value : c);
      return { ...entry, clients };
    });
    onSNMPUpdate(updated);
  };

  const handleClientDelete = (entryIdx, clientIdx) => {
    const updated = snmpConfig.map((entry, i) =>
      i === entryIdx ? { ...entry, clients: (entry.clients || []).filter((_, j) => j !== clientIdx) } : entry
    );
    onSNMPUpdate(updated);
  };

  if (!snmpConfig || snmpConfig.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No SNMP configuration defined.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={() => handleAdd('community')}>Add Community</button>
            <button className="btn btn-primary btn-sm" onClick={() => handleAdd('trap-group')}>Add Trap Group</button>
            <button className="btn btn-primary btn-sm" onClick={() => handleAdd('v3-user')}>Add v3 User</button>
          </div>
        </div>
      </div>
    );
  }

  const sectionLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' };
  const typeColors = { community: '#f59e0b', 'trap-group': '#3b82f6', 'v3-user': '#8b5cf6' };
  const typeLabels = { community: 'Community', 'trap-group': 'Trap Group', 'v3-user': 'SNMPv3 User' };

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="editor-list">
        {snmpConfig.map((entry, index) => (
          <div key={index} className="editor-card">
            <div className="editor-card-header">
              <span style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                color: typeColors[entry.type] || '#94a3b8',
                marginRight: 8, whiteSpace: 'nowrap',
              }}>{typeLabels[entry.type] || entry.type}</span>
              <input className="editor-inline-input editor-name-input"
                value={entry.name || ''}
                onChange={(e) => handleChange(index, 'name', e.target.value)} />
              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(index)} title="Delete">x</button>
            </div>

            <div className="editor-card-body">
              {/* Community-specific fields */}
              {entry.type === 'community' && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <label style={sectionLabel}>Authorization</label>
                    <div className="editor-field-row">
                      <div className="editor-field" style={{ width: 160 }}>
                        <select className="cell-select" value={entry.authorization || 'read-only'}
                          onChange={(e) => handleChange(index, 'authorization', e.target.value)}>
                          <option value="read-only">read-only</option>
                          <option value="read-write">read-write</option>
                        </select>
                      </div>
                      <div className="editor-field" style={{ flex: 1 }}>
                        <label>Contact</label>
                        <input className="cell-input" value={entry.contact || ''}
                          onChange={(e) => handleChange(index, 'contact', e.target.value)}
                          placeholder="Contact info" />
                      </div>
                      <div className="editor-field" style={{ flex: 1 }}>
                        <label>Location</label>
                        <input className="cell-input" value={entry.location || ''}
                          onChange={(e) => handleChange(index, 'location', e.target.value)}
                          placeholder="Location string" />
                      </div>
                    </div>
                  </div>
                  {/* Allowed clients */}
                  <div style={{ marginBottom: 8 }}>
                    <label style={sectionLabel}>Allowed Clients</label>
                    {(entry.clients || []).map((client, ci) => (
                      <div key={ci} className="editor-field-row" style={{ marginBottom: 4 }}>
                        <input className="cell-input" style={{ flex: 1 }} value={client}
                          onChange={(e) => handleClientChange(index, ci, e.target.value)}
                          placeholder="IP or subnet" />
                        <button className="btn-icon btn-icon-danger" onClick={() => handleClientDelete(index, ci)} title="Remove">x</button>
                      </div>
                    ))}
                    <button className="btn btn-sm" onClick={() => handleClientAdd(index)}>+ Client</button>
                  </div>
                </>
              )}

              {/* Trap group fields */}
              {entry.type === 'trap-group' && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <label style={sectionLabel}>Settings</label>
                    <div className="editor-field-row">
                      <div className="editor-field" style={{ width: 120 }}>
                        <label>Version</label>
                        <select className="cell-select" value={entry.version || 'v2c'}
                          onChange={(e) => handleChange(index, 'version', e.target.value)}>
                          <option value="v1">v1</option>
                          <option value="v2">v2c</option>
                          <option value="v3">v3</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* Trap targets */}
                  <div style={{ marginBottom: 8 }}>
                    <label style={sectionLabel}>Targets</label>
                    {(entry.targets || []).map((target, ti) => (
                      <div key={ti} className="editor-field-row" style={{ marginBottom: 4 }}>
                        <input className="cell-input" style={{ flex: 1 }} value={target}
                          onChange={(e) => handleTargetChange(index, ti, e.target.value)}
                          placeholder="Trap receiver IP" />
                        <button className="btn-icon btn-icon-danger" onClick={() => handleTargetDelete(index, ti)} title="Remove">x</button>
                      </div>
                    ))}
                    <button className="btn btn-sm" onClick={() => handleTargetAdd(index)}>+ Target</button>
                  </div>
                </>
              )}

              {/* v3 user fields */}
              {entry.type === 'v3-user' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Security</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ width: 160 }}>
                      <label>Auth Protocol</label>
                      <select className="cell-select" value={entry.auth_protocol || 'none'}
                        onChange={(e) => handleChange(index, 'auth_protocol', e.target.value)}>
                        <option value="none">None</option>
                        <option value="md5">MD5</option>
                        <option value="sha">SHA</option>
                      </select>
                    </div>
                    <div className="editor-field" style={{ width: 160 }}>
                      <label>Privacy Protocol</label>
                      <select className="cell-select" value={entry.privacy_protocol || 'none'}
                        onChange={(e) => handleChange(index, 'privacy_protocol', e.target.value)}>
                        <option value="none">None</option>
                        <option value="des">DES</option>
                        <option value="aes128">AES-128</option>
                      </select>
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Contact</label>
                      <input className="cell-input" value={entry.contact || ''}
                        onChange={(e) => handleChange(index, 'contact', e.target.value)}
                        placeholder="Contact info" />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Location</label>
                      <input className="cell-input" value={entry.location || ''}
                        onChange={(e) => handleChange(index, 'location', e.target.value)}
                        placeholder="Location string" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdd('community')}>+ Community</button>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdd('trap-group')}>+ Trap Group</button>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdd('v3-user')}>+ v3 User</button>
      </div>
    </div>
  );
}
