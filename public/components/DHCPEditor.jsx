/**
 * DHCPEditor Component
 *
 * Card-based editor for DHCP configurations (server, relay, pool).
 * Conditional field display based on type.
 */
import React from 'react';
import { ChipEditor } from './ZoneEditor.jsx';

export default function DHCPEditor({ dhcpConfig, onDHCPUpdate, viewMode }) {

  const handleChange = (index, field, value) => {
    const updated = dhcpConfig.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    onDHCPUpdate(updated);
  };

  const handleAdd = () => {
    onDHCPUpdate([...dhcpConfig, {
      type: 'server',
      name: `dhcp-${dhcpConfig.length + 1}`,
      interface: '',
      pools: [],
      gateway: '',
      dns_servers: [],
      lease_time: 86400,
      netmask: '',
      domain: '',
      servers: [],
      group: '',
      network: '',
      ranges: [],
      router: '',
      interfaces: [],
    }]);
  };

  const handleDelete = (index) => {
    onDHCPUpdate(dhcpConfig.filter((_, i) => i !== index));
  };

  /* ---- Chip array handlers ---- */
  const handleChipAdd = (index, field, value) => {
    const updated = dhcpConfig.map((entry, i) =>
      i === index ? { ...entry, [field]: [...(entry[field] || []), value] } : entry
    );
    onDHCPUpdate(updated);
  };

  const handleChipRemove = (index, field, value) => {
    const updated = dhcpConfig.map((entry, i) =>
      i === index ? { ...entry, [field]: (entry[field] || []).filter(v => v !== value) } : entry
    );
    onDHCPUpdate(updated);
  };

  /* ---- Range handlers (for pool type) ---- */
  const handleRangeAdd = (index) => {
    const updated = dhcpConfig.map((entry, i) =>
      i === index ? { ...entry, ranges: [...(entry.ranges || []), { name: `range${(entry.ranges || []).length + 1}`, low: '', high: '' }] } : entry
    );
    onDHCPUpdate(updated);
  };

  const handleRangeDelete = (entryIdx, rangeIdx) => {
    const updated = dhcpConfig.map((entry, i) =>
      i === entryIdx ? { ...entry, ranges: (entry.ranges || []).filter((_, j) => j !== rangeIdx) } : entry
    );
    onDHCPUpdate(updated);
  };

  const handleRangeChange = (entryIdx, rangeIdx, field, value) => {
    const updated = dhcpConfig.map((entry, i) => {
      if (i !== entryIdx) return entry;
      const ranges = (entry.ranges || []).map((r, j) =>
        j === rangeIdx ? { ...r, [field]: value } : r
      );
      return { ...entry, ranges };
    });
    onDHCPUpdate(updated);
  };

  if (!dhcpConfig || dhcpConfig.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No DHCP configurations defined.</p>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add DHCP Config</button>
        </div>
      </div>
    );
  }

  const sectionLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' };

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="editor-list">
        {dhcpConfig.map((entry, index) => (
          <div key={index} className="editor-card">
            <div className="editor-card-header">
              <input className="editor-inline-input editor-name-input"
                value={entry.name || ''}
                onChange={(e) => handleChange(index, 'name', e.target.value)} />
              <select className="cell-select" style={{ width: 100 }}
                value={entry.type || 'server'}
                onChange={(e) => handleChange(index, 'type', e.target.value)}>
                <option value="server">Server</option>
                <option value="relay">Relay</option>
                <option value="pool">Pool</option>
              </select>
              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(index)} title="Delete">x</button>
            </div>

            <div className="editor-card-body">
              {/* Common: interface */}
              {(entry.type === 'server' || entry.type === 'relay') && (
                <div style={{ marginBottom: 8 }}>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Interface</label>
                      <input className="cell-input" value={entry.interface || ''}
                        onChange={(e) => handleChange(index, 'interface', e.target.value)}
                        placeholder="e.g. ge-0/0/0.0" />
                    </div>
                  </div>
                </div>
              )}

              {/* Server fields */}
              {entry.type === 'server' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Server Settings</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Gateway</label>
                      <input className="cell-input" value={entry.gateway || ''}
                        onChange={(e) => handleChange(index, 'gateway', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 140 }}>
                      <label>Netmask</label>
                      <input className="cell-input" value={entry.netmask || ''}
                        onChange={(e) => handleChange(index, 'netmask', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Domain</label>
                      <input className="cell-input" value={entry.domain || ''}
                        onChange={(e) => handleChange(index, 'domain', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 100 }}>
                      <label>Lease (s)</label>
                      <input className="cell-input" type="number" value={entry.lease_time ?? 86400}
                        onChange={(e) => handleChange(index, 'lease_time', parseInt(e.target.value, 10) || 0)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 10, color: '#64748b' }}>Address Pools</label>
                    <ChipEditor
                      values={entry.pools || []}
                      onAdd={(val) => handleChipAdd(index, 'pools', val)}
                      onRemove={(val) => handleChipRemove(index, 'pools', val)}
                      placeholder="e.g. 10.0.0.10-10.0.0.200"
                    />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 10, color: '#64748b' }}>DNS Servers</label>
                    <ChipEditor
                      values={entry.dns_servers || []}
                      onAdd={(val) => handleChipAdd(index, 'dns_servers', val)}
                      onRemove={(val) => handleChipRemove(index, 'dns_servers', val)}
                      placeholder="e.g. 8.8.8.8"
                    />
                  </div>
                </div>
              )}

              {/* Relay fields */}
              {entry.type === 'relay' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Relay Servers</label>
                  <ChipEditor
                    values={entry.servers || []}
                    onAdd={(val) => handleChipAdd(index, 'servers', val)}
                    onRemove={(val) => handleChipRemove(index, 'servers', val)}
                    placeholder="Relay server IP"
                  />
                </div>
              )}

              {/* Pool fields */}
              {entry.type === 'pool' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Pool Settings</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Group</label>
                      <input className="cell-input" value={entry.group || ''}
                        onChange={(e) => handleChange(index, 'group', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Network</label>
                      <input className="cell-input" value={entry.network || ''}
                        onChange={(e) => handleChange(index, 'network', e.target.value)}
                        placeholder="e.g. 10.0.0.0/24" />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Router</label>
                      <input className="cell-input" value={entry.router || ''}
                        onChange={(e) => handleChange(index, 'router', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 10, color: '#64748b' }}>Interfaces</label>
                    <ChipEditor
                      values={entry.interfaces || []}
                      onAdd={(val) => handleChipAdd(index, 'interfaces', val)}
                      onRemove={(val) => handleChipRemove(index, 'interfaces', val)}
                      placeholder="Interface name"
                    />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <label style={{ fontSize: 10, color: '#64748b' }}>DNS Servers</label>
                    <ChipEditor
                      values={entry.dns_servers || []}
                      onAdd={(val) => handleChipAdd(index, 'dns_servers', val)}
                      onRemove={(val) => handleChipRemove(index, 'dns_servers', val)}
                      placeholder="e.g. 8.8.8.8"
                    />
                  </div>

                  {/* Ranges */}
                  <div style={{ marginTop: 8 }}>
                    <label style={sectionLabel}>
                      Address Ranges ({(entry.ranges || []).length})
                    </label>
                    {(entry.ranges || []).map((range, rIdx) => (
                      <div key={rIdx} className="editor-field-row" style={{ marginBottom: 4 }}>
                        <div className="editor-field" style={{ flex: 1 }}>
                          <label>Name</label>
                          <input className="cell-input" value={range.name || ''}
                            onChange={(e) => handleRangeChange(index, rIdx, 'name', e.target.value)} />
                        </div>
                        <div className="editor-field" style={{ flex: 1 }}>
                          <label>Low</label>
                          <input className="cell-input" value={range.low || ''}
                            onChange={(e) => handleRangeChange(index, rIdx, 'low', e.target.value)} />
                        </div>
                        <div className="editor-field" style={{ flex: 1 }}>
                          <label>High</label>
                          <input className="cell-input" value={range.high || ''}
                            onChange={(e) => handleRangeChange(index, rIdx, 'high', e.target.value)} />
                        </div>
                        <button className="btn-icon btn-icon-danger" onClick={() => handleRangeDelete(index, rIdx)}
                          title="Remove" style={{ alignSelf: 'flex-end', marginBottom: 4 }}>x</button>
                      </div>
                    ))}
                    <button className="btn btn-secondary btn-sm" onClick={() => handleRangeAdd(index)}
                      style={{ marginTop: 4, fontSize: 11 }}>+ Add Range</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add DHCP Config</button>
      </div>
    </div>
  );
}
