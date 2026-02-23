/**
 * HAEditor Component
 *
 * Single-object editor for HA / Chassis Cluster configuration.
 * When ha_config is null, shows empty state with "Enable HA" button.
 * When present, shows a single card form for editing all HA fields.
 */
import React, { useState } from 'react';
import { ChipEditor } from './ZoneEditor.jsx';

export default function HAEditor({ haConfig, onHAUpdate, viewMode }) {
  const isSrx = viewMode === 'srx';

  const handleChange = (field, value) => {
    onHAUpdate({ ...haConfig, [field]: value });
  };

  const handleEnable = () => {
    onHAUpdate({
      enabled: true,
      mode: 'active-passive',
      group_id: 1,
      priority: 100,
      preempt: true,
      peer_ip: '',
      ha_interfaces: [],
      monitoring: { link_groups: [], path_groups: [] },
      description: '',
    });
  };

  const handleDisable = () => {
    onHAUpdate(null);
  };

  /* ---- HA Interface handlers ---- */
  const handleInterfaceAdd = () => {
    const ifaces = [...(haConfig.ha_interfaces || []), { name: '', ip: '', netmask: '', interface: '' }];
    onHAUpdate({ ...haConfig, ha_interfaces: ifaces });
  };

  const handleInterfaceDelete = (idx) => {
    onHAUpdate({ ...haConfig, ha_interfaces: haConfig.ha_interfaces.filter((_, i) => i !== idx) });
  };

  const handleInterfaceChange = (idx, field, value) => {
    const ifaces = haConfig.ha_interfaces.map((iface, i) =>
      i === idx ? { ...iface, [field]: value } : iface
    );
    onHAUpdate({ ...haConfig, ha_interfaces: ifaces });
  };

  /* ---- Link Group handlers ---- */
  const handleLinkGroupAdd = () => {
    const monitoring = { ...haConfig.monitoring };
    monitoring.link_groups = [...(monitoring.link_groups || []), { name: 'default', enabled: true, interfaces: [] }];
    onHAUpdate({ ...haConfig, monitoring });
  };

  const handleLinkGroupDelete = (idx) => {
    const monitoring = { ...haConfig.monitoring };
    monitoring.link_groups = monitoring.link_groups.filter((_, i) => i !== idx);
    onHAUpdate({ ...haConfig, monitoring });
  };

  const handleLinkGroupChange = (idx, field, value) => {
    const monitoring = { ...haConfig.monitoring };
    monitoring.link_groups = monitoring.link_groups.map((g, i) =>
      i === idx ? { ...g, [field]: value } : g
    );
    onHAUpdate({ ...haConfig, monitoring });
  };

  const handleLinkGroupInterfaceAdd = (groupIdx, value) => {
    const monitoring = { ...haConfig.monitoring };
    monitoring.link_groups = monitoring.link_groups.map((g, i) =>
      i === groupIdx ? { ...g, interfaces: [...(g.interfaces || []), value] } : g
    );
    onHAUpdate({ ...haConfig, monitoring });
  };

  const handleLinkGroupInterfaceRemove = (groupIdx, value) => {
    const monitoring = { ...haConfig.monitoring };
    monitoring.link_groups = monitoring.link_groups.map((g, i) =>
      i === groupIdx ? { ...g, interfaces: (g.interfaces || []).filter(v => v !== value) } : g
    );
    onHAUpdate({ ...haConfig, monitoring });
  };

  /* ---- Path Group handlers ---- */
  const handlePathGroupAdd = () => {
    const monitoring = { ...haConfig.monitoring };
    monitoring.path_groups = [...(monitoring.path_groups || []), { name: 'default', enabled: true }];
    onHAUpdate({ ...haConfig, monitoring });
  };

  const handlePathGroupDelete = (idx) => {
    const monitoring = { ...haConfig.monitoring };
    monitoring.path_groups = monitoring.path_groups.filter((_, i) => i !== idx);
    onHAUpdate({ ...haConfig, monitoring });
  };

  const handlePathGroupChange = (idx, field, value) => {
    const monitoring = { ...haConfig.monitoring };
    monitoring.path_groups = monitoring.path_groups.map((g, i) =>
      i === idx ? { ...g, [field]: value } : g
    );
    onHAUpdate({ ...haConfig, monitoring });
  };

  /* ---- Empty state ---- */
  if (!haConfig || !haConfig.enabled) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No HA / Chassis Cluster configuration defined.</p>
          <button className="btn btn-primary btn-sm" onClick={handleEnable}>Enable HA</button>
        </div>
      </div>
    );
  }

  const sectionLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' };

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="editor-list">
        <div className="editor-card">
          <div className="editor-card-header">
            <select
              className="cell-select"
              value={haConfig.mode || 'active-passive'}
              onChange={(e) => handleChange('mode', e.target.value)}
              style={{ width: 160 }}
            >
              <option value="standalone">Standalone</option>
              <option value="active-passive">Active-Passive</option>
              <option value="active-active">Active-Active</option>
              <option value="cluster">Cluster</option>
            </select>
            <span style={{ flex: 1 }} />
            <button className="btn-icon btn-icon-danger" onClick={handleDisable} title="Disable HA">x</button>
          </div>

          <div className="editor-card-body">
            {/* General */}
            <div style={{ marginBottom: 8 }}>
              <label style={sectionLabel}>General</label>
              <div className="editor-field-row">
                <div className="editor-field" style={{ width: 80 }}>
                  <label>Group ID</label>
                  <input className="cell-input" type="number" value={haConfig.group_id ?? 0}
                    onChange={(e) => handleChange('group_id', parseInt(e.target.value, 10) || 0)} />
                </div>
                <div className="editor-field" style={{ width: 80 }}>
                  <label>Priority</label>
                  <input className="cell-input" type="number" value={haConfig.priority ?? 100}
                    onChange={(e) => handleChange('priority', parseInt(e.target.value, 10) || 0)} />
                </div>
                <div className="editor-field" style={{ width: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={haConfig.preempt ?? false}
                    onChange={(e) => handleChange('preempt', e.target.checked)} />
                  <label>Preempt</label>
                </div>
                <div className="editor-field" style={{ flex: 1 }}>
                  <label>Peer IP</label>
                  <input className="cell-input" value={haConfig.peer_ip || ''}
                    onChange={(e) => handleChange('peer_ip', e.target.value)} placeholder="Peer node address" />
                </div>
              </div>
            </div>

            {/* HA Interfaces */}
            <div style={{ marginBottom: 8 }}>
              <label style={sectionLabel}>
                HA Interfaces ({(haConfig.ha_interfaces || []).length})
              </label>
              {(haConfig.ha_interfaces || []).map((iface, idx) => (
                <div key={idx} className="editor-field-row" style={{ marginBottom: 4 }}>
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>Role</label>
                    <input className="cell-input" value={iface.name || ''}
                      onChange={(e) => handleInterfaceChange(idx, 'name', e.target.value)}
                      placeholder={isSrx ? 'fab0, fxp0' : 'HA1, HA2'} />
                  </div>
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>IP</label>
                    <input className="cell-input" value={iface.ip || ''}
                      onChange={(e) => handleInterfaceChange(idx, 'ip', e.target.value)} />
                  </div>
                  <div className="editor-field" style={{ width: 120 }}>
                    <label>Netmask</label>
                    <input className="cell-input" value={iface.netmask || ''}
                      onChange={(e) => handleInterfaceChange(idx, 'netmask', e.target.value)} />
                  </div>
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>Interface</label>
                    <input className="cell-input" value={iface.interface || ''}
                      onChange={(e) => handleInterfaceChange(idx, 'interface', e.target.value)}
                      placeholder={isSrx ? 'ge-0/0/0' : 'ethernet1/1'} />
                  </div>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleInterfaceDelete(idx)}
                    title="Remove" style={{ alignSelf: 'flex-end', marginBottom: 4 }}>x</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={handleInterfaceAdd}
                style={{ marginTop: 4, fontSize: 11 }}>+ Add HA Interface</button>
            </div>

            {/* Monitoring - Link Groups */}
            <div style={{ marginBottom: 8 }}>
              <label style={sectionLabel}>
                Monitoring — Link Groups ({(haConfig.monitoring?.link_groups || []).length})
              </label>
              {(haConfig.monitoring?.link_groups || []).map((group, idx) => (
                <div key={idx} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: '2px solid var(--border-color)' }}>
                  <div className="editor-field-row" style={{ marginBottom: 4 }}>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Name</label>
                      <input className="cell-input" value={group.name || ''}
                        onChange={(e) => handleLinkGroupChange(idx, 'name', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={group.enabled ?? true}
                        onChange={(e) => handleLinkGroupChange(idx, 'enabled', e.target.checked)} />
                      <label>Enabled</label>
                    </div>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleLinkGroupDelete(idx)}
                      title="Remove" style={{ alignSelf: 'flex-end', marginBottom: 4 }}>x</button>
                  </div>
                  <div style={{ marginLeft: 4 }}>
                    <label style={{ fontSize: 10, color: '#64748b' }}>Interfaces</label>
                    <ChipEditor
                      values={group.interfaces || []}
                      onAdd={(val) => handleLinkGroupInterfaceAdd(idx, val)}
                      onRemove={(val) => handleLinkGroupInterfaceRemove(idx, val)}
                      placeholder="Add interface"
                    />
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={handleLinkGroupAdd}
                style={{ marginTop: 4, fontSize: 11 }}>+ Add Link Group</button>
            </div>

            {/* Monitoring - Path Groups */}
            <div style={{ marginBottom: 8 }}>
              <label style={sectionLabel}>
                Monitoring — Path Groups ({(haConfig.monitoring?.path_groups || []).length})
              </label>
              {(haConfig.monitoring?.path_groups || []).map((group, idx) => (
                <div key={idx} className="editor-field-row" style={{ marginBottom: 4 }}>
                  <div className="editor-field" style={{ flex: 1 }}>
                    <label>Name</label>
                    <input className="cell-input" value={group.name || ''}
                      onChange={(e) => handlePathGroupChange(idx, 'name', e.target.value)} />
                  </div>
                  <div className="editor-field" style={{ width: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={group.enabled ?? true}
                      onChange={(e) => handlePathGroupChange(idx, 'enabled', e.target.checked)} />
                    <label>Enabled</label>
                  </div>
                  <button className="btn-icon btn-icon-danger" onClick={() => handlePathGroupDelete(idx)}
                    title="Remove" style={{ alignSelf: 'flex-end', marginBottom: 4 }}>x</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={handlePathGroupAdd}
                style={{ marginTop: 4, fontSize: 11 }}>+ Add Path Group</button>
            </div>

            {/* Description */}
            <div className="editor-field-row">
              <div className="editor-field" style={{ flex: 1 }}>
                <label>Description</label>
                <input className="editor-inline-input" value={haConfig.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)} placeholder="HA description" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
