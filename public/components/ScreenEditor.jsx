/**
 * ScreenEditor Component
 *
 * Card-based editor for Screen / DDoS protection profiles.
 * Each card shows: ICMP, TCP, UDP, IP protections + session limits.
 */
import React from 'react';

export default function ScreenEditor({ screenConfig, onScreenUpdate, viewMode }) {

  /** Deep update using dot-path (e.g., 'icmp.flood_threshold') */
  const handleChange = (index, path, value) => {
    const updated = screenConfig.map((screen, i) => {
      if (i !== index) return screen;
      const parts = path.split('.');
      if (parts.length === 1) {
        return { ...screen, [parts[0]]: value };
      }
      const clone = { ...screen };
      clone[parts[0]] = { ...clone[parts[0]], [parts[1]]: value };
      return clone;
    });
    onScreenUpdate(updated);
  };

  const handleAdd = () => {
    onScreenUpdate([...screenConfig, {
      name: `screen-${screenConfig.length + 1}`,
      zone: '',
      icmp: { flood_threshold: null, ping_death: false, fragment: false },
      tcp: { syn_flood_threshold: null, syn_flood_timeout: null, land_attack: false, winnuke: false, tcp_no_flag: false },
      udp: { flood_threshold: null },
      ip: { spoofing: false, source_route: false, tear_drop: false, record_route: false, timestamp: false },
      limit_session: { source_based: null, destination_based: null },
      description: '',
    }]);
  };

  const handleDelete = (index) => {
    onScreenUpdate(screenConfig.filter((_, i) => i !== index));
  };

  /** Convert empty string to null, otherwise to number */
  const toNullableNum = (val) => val === '' ? null : Number(val);

  if (!screenConfig || screenConfig.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <p>No screen / DDoS profiles defined.</p>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add Screen Profile</button>
        </div>
      </div>
    );
  }

  const sectionLabel = { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' };
  const checkField = { width: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 };

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div className="editor-list">
        {screenConfig.map((screen, index) => (
          <div key={index} className="editor-card">
            <div className="editor-card-header">
              <input className="editor-inline-input editor-name-input"
                value={screen.name || ''}
                onChange={(e) => handleChange(index, 'name', e.target.value)} />
              <div className="editor-field" style={{ width: 140, margin: 0 }}>
                <input className="cell-input" value={screen.zone || ''}
                  onChange={(e) => handleChange(index, 'zone', e.target.value)}
                  placeholder="Zone" />
              </div>
              <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(index)} title="Delete">x</button>
            </div>

            <div className="editor-card-body">
              {/* ICMP */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>ICMP Protection</label>
                <div className="editor-field-row">
                  <div className="editor-field" style={{ width: 140 }}>
                    <label>Flood Threshold</label>
                    <input className="cell-input" type="number"
                      value={screen.icmp?.flood_threshold ?? ''}
                      onChange={(e) => handleChange(index, 'icmp.flood_threshold', toNullableNum(e.target.value))}
                      placeholder="pps" />
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.icmp?.ping_death ?? false}
                      onChange={(e) => handleChange(index, 'icmp.ping_death', e.target.checked)} />
                    <label>Ping of Death</label>
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.icmp?.fragment ?? false}
                      onChange={(e) => handleChange(index, 'icmp.fragment', e.target.checked)} />
                    <label>Fragment</label>
                  </div>
                </div>
              </div>

              {/* TCP */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>TCP Protection</label>
                <div className="editor-field-row">
                  <div className="editor-field" style={{ width: 140 }}>
                    <label>SYN Flood Threshold</label>
                    <input className="cell-input" type="number"
                      value={screen.tcp?.syn_flood_threshold ?? ''}
                      onChange={(e) => handleChange(index, 'tcp.syn_flood_threshold', toNullableNum(e.target.value))}
                      placeholder="pps" />
                  </div>
                  <div className="editor-field" style={{ width: 120 }}>
                    <label>SYN Timeout (s)</label>
                    <input className="cell-input" type="number"
                      value={screen.tcp?.syn_flood_timeout ?? ''}
                      onChange={(e) => handleChange(index, 'tcp.syn_flood_timeout', toNullableNum(e.target.value))}
                      placeholder="sec" />
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.tcp?.land_attack ?? false}
                      onChange={(e) => handleChange(index, 'tcp.land_attack', e.target.checked)} />
                    <label>Land Attack</label>
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.tcp?.winnuke ?? false}
                      onChange={(e) => handleChange(index, 'tcp.winnuke', e.target.checked)} />
                    <label>WinNuke</label>
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.tcp?.tcp_no_flag ?? false}
                      onChange={(e) => handleChange(index, 'tcp.tcp_no_flag', e.target.checked)} />
                    <label>No Flag</label>
                  </div>
                </div>
              </div>

              {/* UDP */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>UDP Protection</label>
                <div className="editor-field-row">
                  <div className="editor-field" style={{ width: 140 }}>
                    <label>Flood Threshold</label>
                    <input className="cell-input" type="number"
                      value={screen.udp?.flood_threshold ?? ''}
                      onChange={(e) => handleChange(index, 'udp.flood_threshold', toNullableNum(e.target.value))}
                      placeholder="pps" />
                  </div>
                </div>
              </div>

              {/* IP */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>IP Protection</label>
                <div className="editor-field-row">
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.ip?.spoofing ?? false}
                      onChange={(e) => handleChange(index, 'ip.spoofing', e.target.checked)} />
                    <label>Spoofing</label>
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.ip?.source_route ?? false}
                      onChange={(e) => handleChange(index, 'ip.source_route', e.target.checked)} />
                    <label>Source Route</label>
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.ip?.tear_drop ?? false}
                      onChange={(e) => handleChange(index, 'ip.tear_drop', e.target.checked)} />
                    <label>Tear Drop</label>
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.ip?.record_route ?? false}
                      onChange={(e) => handleChange(index, 'ip.record_route', e.target.checked)} />
                    <label>Record Route</label>
                  </div>
                  <div className="editor-field" style={checkField}>
                    <input type="checkbox" checked={screen.ip?.timestamp ?? false}
                      onChange={(e) => handleChange(index, 'ip.timestamp', e.target.checked)} />
                    <label>Timestamp</label>
                  </div>
                </div>
              </div>

              {/* Session Limits */}
              <div style={{ marginBottom: 8 }}>
                <label style={sectionLabel}>Session Limits</label>
                <div className="editor-field-row">
                  <div className="editor-field" style={{ width: 160 }}>
                    <label>Source-Based</label>
                    <input className="cell-input" type="number"
                      value={screen.limit_session?.source_based ?? ''}
                      onChange={(e) => handleChange(index, 'limit_session.source_based', toNullableNum(e.target.value))}
                      placeholder="Max sessions" />
                  </div>
                  <div className="editor-field" style={{ width: 160 }}>
                    <label>Destination-Based</label>
                    <input className="cell-input" type="number"
                      value={screen.limit_session?.destination_based ?? ''}
                      onChange={(e) => handleChange(index, 'limit_session.destination_based', toNullableNum(e.target.value))}
                      placeholder="Max sessions" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="editor-field-row">
                <div className="editor-field" style={{ flex: 1 }}>
                  <label>Description</label>
                  <input className="editor-inline-input" value={screen.description || ''}
                    onChange={(e) => handleChange(index, 'description', e.target.value)}
                    placeholder="Optional description" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add Screen Profile</button>
      </div>
    </div>
  );
}
