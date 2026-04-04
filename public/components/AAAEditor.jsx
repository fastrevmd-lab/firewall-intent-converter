/**
 * AAAEditor Component
 *
 * Card-based editor for AAA (RADIUS, TACACS+, LDAP) configuration.
 * Supports server entries, access profiles, and authentication order.
 */
import React from 'react';

export default function AAAEditor({ aaaConfig, onAAAUpdate, viewMode }) {

  const handleChange = (index, field, value) => {
    const updated = aaaConfig.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    onAAAUpdate(updated);
  };

  const handleAdd = (type) => {
    const defaults = {
      radius: {
        type: 'radius',
        name: `radius-${aaaConfig.filter(e => e.type === 'radius').length + 1}`,
        server: '',
        port: 1812,
        secret: '',
        timeout: 5,
        retry: 3,
        source_address: '',
      },
      tacplus: {
        type: 'tacplus',
        name: `tacplus-${aaaConfig.filter(e => e.type === 'tacplus').length + 1}`,
        server: '',
        port: 49,
        secret: '',
        timeout: 5,
        single_connection: false,
        source_address: '',
      },
      ldap: {
        type: 'ldap',
        name: `ldap-${aaaConfig.filter(e => e.type === 'ldap').length + 1}`,
        server: '',
        port: 389,
        base_dn: '',
        bind_dn: '',
        ssl: false,
      },
      profile: {
        type: 'profile',
        name: `auth-profile-${aaaConfig.filter(e => e.type === 'profile').length + 1}`,
        authentication_order: ['radius'],
      },
    };
    onAAAUpdate([...aaaConfig, defaults[type]]);
  };

  const handleDelete = (index) => {
    onAAAUpdate(aaaConfig.filter((_, i) => i !== index));
  };

  /* ---- Auth order sub-list handlers ---- */
  const handleAuthOrderAdd = (index) => {
    const updated = aaaConfig.map((entry, i) =>
      i === index ? { ...entry, authentication_order: [...(entry.authentication_order || []), 'password'] } : entry
    );
    onAAAUpdate(updated);
  };

  const handleAuthOrderChange = (entryIdx, orderIdx, value) => {
    const updated = aaaConfig.map((entry, i) => {
      if (i !== entryIdx) return entry;
      const order = (entry.authentication_order || []).map((m, j) => j === orderIdx ? value : m);
      return { ...entry, authentication_order: order };
    });
    onAAAUpdate(updated);
  };

  const handleAuthOrderDelete = (entryIdx, orderIdx) => {
    const updated = aaaConfig.map((entry, i) =>
      i === entryIdx ? { ...entry, authentication_order: (entry.authentication_order || []).filter((_, j) => j !== orderIdx) } : entry
    );
    onAAAUpdate(updated);
  };

  if (!aaaConfig || aaaConfig.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No AAA configuration defined.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => handleAdd('radius')}>Add RADIUS Server</button>
            <button className="btn btn-primary btn-sm" onClick={() => handleAdd('tacplus')}>Add TACACS+ Server</button>
            <button className="btn btn-primary btn-sm" onClick={() => handleAdd('ldap')}>Add LDAP Server</button>
            <button className="btn btn-primary btn-sm" onClick={() => handleAdd('profile')}>Add Auth Profile</button>
          </div>
        </div>
      </div>
    );
  }

  const sectionLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' };
  const typeColors = { radius: '#3b82f6', tacplus: '#f59e0b', ldap: '#10b981', profile: '#8b5cf6', 'auth-order': '#8b5cf6' };
  const typeLabels = { radius: 'RADIUS', tacplus: 'TACACS+', ldap: 'LDAP', profile: 'Auth Profile', 'auth-order': 'System Auth Order' };

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="editor-list">
        {aaaConfig.map((entry, index) => (
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
              {/* RADIUS / TACACS+ server fields */}
              {(entry.type === 'radius' || entry.type === 'tacplus') && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <label style={sectionLabel}>Connection</label>
                    <div className="editor-field-row">
                      <div className="editor-field" style={{ flex: 2 }}>
                        <label>Server</label>
                        <input className="cell-input" value={entry.server || ''}
                          onChange={(e) => handleChange(index, 'server', e.target.value)}
                          placeholder="IP address" />
                      </div>
                      <div className="editor-field" style={{ width: 80 }}>
                        <label>Port</label>
                        <input className="cell-input" type="number" value={entry.port ?? (entry.type === 'radius' ? 1812 : 49)}
                          onChange={(e) => handleChange(index, 'port', parseInt(e.target.value, 10) || 0)} />
                      </div>
                      <div className="editor-field" style={{ width: 80 }}>
                        <label>Timeout</label>
                        <input className="cell-input" type="number" value={entry.timeout ?? 5}
                          onChange={(e) => handleChange(index, 'timeout', parseInt(e.target.value, 10) || 0)} />
                      </div>
                      {entry.type === 'radius' && (
                        <div className="editor-field" style={{ width: 70 }}>
                          <label>Retry</label>
                          <input className="cell-input" type="number" value={entry.retry ?? 3}
                            onChange={(e) => handleChange(index, 'retry', parseInt(e.target.value, 10) || 0)} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div className="editor-field-row">
                      <div className="editor-field" style={{ flex: 1 }}>
                        <label>Shared Secret</label>
                        <input className="cell-input" type="password" value={entry.secret || ''}
                          onChange={(e) => handleChange(index, 'secret', e.target.value)}
                          placeholder="Shared secret (sanitized)" />
                      </div>
                      <div className="editor-field" style={{ flex: 1 }}>
                        <label>Source Address</label>
                        <input className="cell-input" value={entry.source_address || ''}
                          onChange={(e) => handleChange(index, 'source_address', e.target.value)}
                          placeholder="Optional source IP" />
                      </div>
                    </div>
                  </div>
                  {entry.type === 'tacplus' && (
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={entry.single_connection || false}
                          onChange={(e) => handleChange(index, 'single_connection', e.target.checked)} />
                        Single connection mode
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* LDAP server fields */}
              {entry.type === 'ldap' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Connection</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ flex: 2 }}>
                      <label>Server</label>
                      <input className="cell-input" value={entry.server || ''}
                        onChange={(e) => handleChange(index, 'server', e.target.value)}
                        placeholder="LDAP server IP" />
                    </div>
                    <div className="editor-field" style={{ width: 80 }}>
                      <label>Port</label>
                      <input className="cell-input" type="number" value={entry.port ?? 389}
                        onChange={(e) => handleChange(index, 'port', parseInt(e.target.value, 10) || 0)} />
                    </div>
                    <div className="editor-field" style={{ width: 80 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" checked={entry.ssl || false}
                          onChange={(e) => handleChange(index, 'ssl', e.target.checked)} />
                        SSL
                      </label>
                    </div>
                  </div>
                  <div className="editor-field-row" style={{ marginTop: 6 }}>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Base DN</label>
                      <input className="cell-input" value={entry.base_dn || ''}
                        onChange={(e) => handleChange(index, 'base_dn', e.target.value)}
                        placeholder="dc=example,dc=com" />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Bind DN</label>
                      <input className="cell-input" value={entry.bind_dn || ''}
                        onChange={(e) => handleChange(index, 'bind_dn', e.target.value)}
                        placeholder="cn=admin,dc=example,dc=com" />
                    </div>
                  </div>
                </div>
              )}

              {/* Auth profile / auth-order fields */}
              {(entry.type === 'profile' || entry.type === 'auth-order') && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Authentication Order</label>
                  {(entry.authentication_order || []).map((method, mi) => (
                    <div key={mi} className="editor-field-row" style={{ marginBottom: 4 }}>
                      <select className="cell-select" style={{ flex: 1 }} value={method}
                        onChange={(e) => handleAuthOrderChange(index, mi, e.target.value)}>
                        <option value="radius">RADIUS</option>
                        <option value="tacplus">TACACS+</option>
                        <option value="ldap">LDAP</option>
                        <option value="password">Local Password</option>
                      </select>
                      <button className="btn-icon btn-icon-danger" onClick={() => handleAuthOrderDelete(index, mi)} title="Remove">x</button>
                    </div>
                  ))}
                  <button className="btn btn-sm" onClick={() => handleAuthOrderAdd(index)}>+ Method</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdd('radius')}>+ RADIUS</button>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdd('tacplus')}>+ TACACS+</button>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdd('ldap')}>+ LDAP</button>
        <button className="btn btn-primary btn-sm" onClick={() => handleAdd('profile')}>+ Auth Profile</button>
      </div>
    </div>
  );
}
