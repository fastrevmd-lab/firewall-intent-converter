/**
 * QoSEditor Component
 *
 * Card-based editor for QoS / CoS profiles and policies.
 * Conditional field display based on type (scheduler, interface-cos, shaping-profile, shaping-policy, policy-map).
 */
import React from 'react';

export default function QoSEditor({ qosConfig, onQoSUpdate, viewMode }) {

  const handleChange = (index, field, value) => {
    const updated = qosConfig.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    onQoSUpdate(updated);
  };

  const handleAdd = () => {
    onQoSUpdate([...qosConfig, {
      name: `qos-${qosConfig.length + 1}`,
      type: 'scheduler',
      max_bandwidth: 0,
      transmit_rate: '',
      buffer_size: '',
      priority: '',
      drop_profile: '',
      interface: '',
      scheduler_map: '',
      shaping_rate: '',
      traffic_shaper: '',
      traffic_shaper_reverse: '',
      per_ip_shaper: '',
      srcintf: '',
      dstintf: '',
      classes: [],
    }]);
  };

  const handleDelete = (index) => {
    onQoSUpdate(qosConfig.filter((_, i) => i !== index));
  };

  /* ---- Class sub-list handlers ---- */
  const handleClassAdd = (index) => {
    const updated = qosConfig.map((entry, i) =>
      i === index ? { ...entry, classes: [...(entry.classes || []), { name: '', priority: '', guaranteed_bandwidth: '', maximum_bandwidth: '', police_rate: '', police_burst: '' }] } : entry
    );
    onQoSUpdate(updated);
  };

  const handleClassDelete = (entryIdx, classIdx) => {
    const updated = qosConfig.map((entry, i) =>
      i === entryIdx ? { ...entry, classes: (entry.classes || []).filter((_, j) => j !== classIdx) } : entry
    );
    onQoSUpdate(updated);
  };

  const handleClassChange = (entryIdx, classIdx, field, value) => {
    const updated = qosConfig.map((entry, i) => {
      if (i !== entryIdx) return entry;
      const classes = (entry.classes || []).map((c, j) =>
        j === classIdx ? { ...c, [field]: value } : c
      );
      return { ...entry, classes };
    });
    onQoSUpdate(updated);
  };

  if (!qosConfig || qosConfig.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No QoS / CoS profiles defined.</p>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add QoS Profile</button>
        </div>
      </div>
    );
  }

  const sectionLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' };
  const type = (entry) => entry.type || 'scheduler';

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="editor-list">
        {qosConfig.map((entry, index) => (
          <div key={index} className="editor-card">
            <div className="editor-card-header">
              <input className="editor-inline-input editor-name-input"
                value={entry.name || ''}
                onChange={(e) => handleChange(index, 'name', e.target.value)} />
              <select className="cell-select" style={{ width: 150 }}
                value={type(entry)}
                onChange={(e) => handleChange(index, 'type', e.target.value)}>
                <option value="scheduler">Scheduler</option>
                <option value="interface-cos">Interface CoS</option>
                <option value="shaping-profile">Shaping Profile</option>
                <option value="shaping-policy">Shaping Policy</option>
                <option value="policy-map">Policy Map</option>
              </select>
              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(index)} title="Delete">x</button>
            </div>

            <div className="editor-card-body">
              {/* Scheduler fields */}
              {type(entry) === 'scheduler' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Scheduler</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Transmit Rate</label>
                      <input className="cell-input" value={entry.transmit_rate || ''}
                        onChange={(e) => handleChange(index, 'transmit_rate', e.target.value)}
                        placeholder="e.g. 100m" />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Buffer Size</label>
                      <input className="cell-input" value={entry.buffer_size || ''}
                        onChange={(e) => handleChange(index, 'buffer_size', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Priority</label>
                      <input className="cell-input" value={entry.priority || ''}
                        onChange={(e) => handleChange(index, 'priority', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Drop Profile</label>
                      <input className="cell-input" value={entry.drop_profile || ''}
                        onChange={(e) => handleChange(index, 'drop_profile', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Interface CoS fields */}
              {type(entry) === 'interface-cos' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Interface CoS</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Interface</label>
                      <input className="cell-input" value={entry.interface || ''}
                        onChange={(e) => handleChange(index, 'interface', e.target.value)}
                        placeholder="e.g. ge-0/0/0" />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Scheduler Map</label>
                      <input className="cell-input" value={entry.scheduler_map || ''}
                        onChange={(e) => handleChange(index, 'scheduler_map', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Shaping Rate</label>
                      <input className="cell-input" value={entry.shaping_rate || ''}
                        onChange={(e) => handleChange(index, 'shaping_rate', e.target.value)}
                        placeholder="e.g. 1g" />
                    </div>
                  </div>
                </div>
              )}

              {/* Shaping Profile fields */}
              {type(entry) === 'shaping-profile' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Shaping Profile</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ width: 140 }}>
                      <label>Max Bandwidth</label>
                      <input className="cell-input" type="number" value={entry.max_bandwidth || 0}
                        onChange={(e) => handleChange(index, 'max_bandwidth', parseInt(e.target.value, 10) || 0)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Interface</label>
                      <input className="cell-input" value={entry.interface || ''}
                        onChange={(e) => handleChange(index, 'interface', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Shaping Policy fields */}
              {type(entry) === 'shaping-policy' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Shaping Policy</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Source Intf</label>
                      <input className="cell-input" value={entry.srcintf || ''}
                        onChange={(e) => handleChange(index, 'srcintf', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Dest Intf</label>
                      <input className="cell-input" value={entry.dstintf || ''}
                        onChange={(e) => handleChange(index, 'dstintf', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Traffic Shaper</label>
                      <input className="cell-input" value={entry.traffic_shaper || ''}
                        onChange={(e) => handleChange(index, 'traffic_shaper', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Reverse Shaper</label>
                      <input className="cell-input" value={entry.traffic_shaper_reverse || ''}
                        onChange={(e) => handleChange(index, 'traffic_shaper_reverse', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Per-IP Shaper</label>
                      <input className="cell-input" value={entry.per_ip_shaper || ''}
                        onChange={(e) => handleChange(index, 'per_ip_shaper', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Policy Map fields */}
              {type(entry) === 'policy-map' && (
                <div style={{ marginBottom: 8 }}>
                  <label style={sectionLabel}>Policy Map</label>
                  <div className="editor-field-row">
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Interface</label>
                      <input className="cell-input" value={entry.interface || ''}
                        onChange={(e) => handleChange(index, 'interface', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 140 }}>
                      <label>Max Bandwidth</label>
                      <input className="cell-input" type="number" value={entry.max_bandwidth || 0}
                        onChange={(e) => handleChange(index, 'max_bandwidth', parseInt(e.target.value, 10) || 0)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Classes sub-list */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>
                  Traffic Classes ({(entry.classes || []).length})
                </label>
                {(entry.classes || []).map((cls, cIdx) => (
                  <div key={cIdx} className="editor-field-row" style={{ marginBottom: 4 }}>
                    <div className="editor-field" style={{ flex: 1 }}>
                      <label>Name</label>
                      <input className="cell-input" value={cls.name || ''}
                        onChange={(e) => handleClassChange(index, cIdx, 'name', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 80 }}>
                      <label>Priority</label>
                      <input className="cell-input" value={cls.priority || ''}
                        onChange={(e) => handleClassChange(index, cIdx, 'priority', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 100 }}>
                      <label>Guar. BW</label>
                      <input className="cell-input" value={cls.guaranteed_bandwidth ?? ''}
                        onChange={(e) => handleClassChange(index, cIdx, 'guaranteed_bandwidth', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 100 }}>
                      <label>Max BW</label>
                      <input className="cell-input" value={cls.maximum_bandwidth ?? ''}
                        onChange={(e) => handleClassChange(index, cIdx, 'maximum_bandwidth', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 100 }}>
                      <label>Police Rate</label>
                      <input className="cell-input" value={cls.police_rate ?? ''}
                        onChange={(e) => handleClassChange(index, cIdx, 'police_rate', e.target.value)} />
                    </div>
                    <div className="editor-field" style={{ width: 100 }}>
                      <label>Police Burst</label>
                      <input className="cell-input" value={cls.police_burst ?? ''}
                        onChange={(e) => handleClassChange(index, cIdx, 'police_burst', e.target.value)} />
                    </div>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleClassDelete(index, cIdx)}
                      title="Remove" style={{ alignSelf: 'flex-end', marginBottom: 4 }}>x</button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => handleClassAdd(index)}
                  style={{ marginTop: 4, fontSize: 11 }}>+ Add Class</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add QoS Profile</button>
      </div>
    </div>
  );
}
