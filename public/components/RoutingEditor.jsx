/**
 * RoutingEditor Component
 *
 * Displays interfaces, routing contexts, and static routes
 * in the "Intf/Routing" tab of the center panel.
 * Supports viewing, adding, editing, and deleting.
 */
import React, { useState } from 'react';

export default function RoutingEditor({ routingContexts, staticRoutes, onRoutesUpdate, interfaces, onInterfacesUpdate }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingIfIndex, setEditingIfIndex] = useState(null);

  /* ---- Static route handlers ---- */
  const handleChange = (index, field, value) => {
    const updated = staticRoutes.map((route, i) =>
      i === index ? { ...route, [field]: value } : route
    );
    onRoutesUpdate(updated);
  };

  const handleAdd = () => {
    onRoutesUpdate([...staticRoutes, {
      name: `route-${staticRoutes.length + 1}`,
      destination: '',
      next_hop: '',
      next_hop_type: 'ip-address',
      interface: '',
      metric: 10,
      admin_distance: null,
      description: '',
      vrf: '',
      routing_context: '',
    }]);
    setEditingIndex(staticRoutes.length);
  };

  const handleDelete = (index) => {
    onRoutesUpdate(staticRoutes.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  /* ---- Interface handlers ---- */
  const handleIfChange = (index, field, value) => {
    const updated = interfaces.map((iface, i) =>
      i === index ? { ...iface, [field]: value } : iface
    );
    onInterfacesUpdate(updated);
  };

  const handleIfAdd = () => {
    onInterfacesUpdate([...(interfaces || []), {
      name: '',
      ip: '',
      zone: '',
      vlan: '',
      type: 'physical',
      description: '',
      status: 'up',
      speed: '',
    }]);
    setEditingIfIndex((interfaces || []).length);
  };

  const handleIfDelete = (index) => {
    onInterfacesUpdate(interfaces.filter((_, i) => i !== index));
    if (editingIfIndex === index) setEditingIfIndex(null);
  };

  const inputStyle = { width: '100%', background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0', padding: '2px 4px', borderRadius: 3, fontSize: 12 };
  const selectStyle = { background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0', padding: '2px 4px', borderRadius: 3, fontSize: 11 };

  return (
    <div style={{ padding: '12px', overflowY: 'auto', height: '100%' }}>
      {/* Interfaces Table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
            Interfaces ({(interfaces || []).length})
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={handleIfAdd} style={{ fontSize: 11 }}>
            + Add Interface
          </button>
        </div>

        {(!interfaces || interfaces.length === 0) ? (
          <div style={{ color: '#64748b', fontSize: 13, padding: 20, textAlign: 'center' }}>
            No interface configurations found in source configuration.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Interface</th>
                <th style={{ padding: '6px 8px' }}>IP Address</th>
                <th style={{ padding: '6px 8px' }}>Zone</th>
                <th style={{ padding: '6px 8px' }}>VLAN</th>
                <th style={{ padding: '6px 8px' }}>Type</th>
                <th style={{ padding: '6px 8px' }}>Description</th>
                <th style={{ padding: '6px 8px', width: 50 }}>Status</th>
                <th style={{ padding: '6px 4px', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map((iface, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid #1e293b',
                  background: editingIfIndex === i ? '#1e293b' : 'transparent',
                }}>
                  <td style={{ padding: '5px 8px' }}>
                    {editingIfIndex === i ? (
                      <input type="text" value={iface.name} onChange={(e) => handleIfChange(i, 'name', e.target.value)} style={inputStyle} />
                    ) : (
                      <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{iface.name}</span>
                    )}
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    {editingIfIndex === i ? (
                      <input type="text" value={iface.ip || ''} onChange={(e) => handleIfChange(i, 'ip', e.target.value)} style={inputStyle} placeholder="10.0.0.1/24" />
                    ) : (
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{iface.ip || '-'}</span>
                    )}
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    {editingIfIndex === i ? (
                      <input type="text" value={iface.zone || ''} onChange={(e) => handleIfChange(i, 'zone', e.target.value)} style={inputStyle} />
                    ) : (
                      <span style={{ color: iface.zone ? '#38bdf8' : '#475569' }}>{iface.zone || '-'}</span>
                    )}
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    {editingIfIndex === i ? (
                      <input type="text" value={iface.vlan || ''} onChange={(e) => handleIfChange(i, 'vlan', e.target.value)} style={{ ...inputStyle, width: 50 }} />
                    ) : (
                      <span style={{ color: '#94a3b8' }}>{iface.vlan || '-'}</span>
                    )}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#64748b' }}>
                    {editingIfIndex === i ? (
                      <select value={iface.type || 'physical'} onChange={(e) => handleIfChange(i, 'type', e.target.value)} style={selectStyle}>
                        <option value="physical">physical</option>
                        <option value="vlan">vlan</option>
                        <option value="loopback">loopback</option>
                        <option value="tunnel">tunnel</option>
                        <option value="aggregate">aggregate</option>
                        <option value="redundant">redundant</option>
                        <option value="irb">irb</option>
                        <option value="management">management</option>
                      </select>
                    ) : (
                      iface.type || 'physical'
                    )}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#94a3b8', fontSize: 11 }}>
                    {editingIfIndex === i ? (
                      <input type="text" value={iface.description || ''} onChange={(e) => handleIfChange(i, 'description', e.target.value)} style={inputStyle} />
                    ) : (
                      iface.description || '-'
                    )}
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    <span style={{ color: iface.status === 'shutdown' ? '#ef4444' : '#22c55e', fontSize: 11 }}>
                      {iface.status === 'shutdown' ? 'down' : 'up'}
                    </span>
                  </td>
                  <td style={{ padding: '5px 4px', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingIfIndex(editingIfIndex === i ? null : i)}
                      style={{ fontSize: 10, padding: '1px 6px', marginRight: 2 }}
                      title={editingIfIndex === i ? 'Done editing' : 'Edit interface'}
                    >
                      {editingIfIndex === i ? 'Done' : 'Edit'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleIfDelete(i)}
                      style={{ fontSize: 10, padding: '1px 6px', color: '#ef4444' }}
                      title="Delete interface"
                    >
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Routing Contexts */}
      {routingContexts && routingContexts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8, color: '#94a3b8' }}>Routing Contexts</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {routingContexts.map((ctx, i) => (
              <div key={i} style={{
                background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                padding: '8px 12px', minWidth: 180,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{ctx.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Type: <span style={{ color: '#94a3b8' }}>{ctx.type}</span>
                </div>
                {ctx.zones && ctx.zones.length > 0 && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Zones: <span style={{ color: '#94a3b8' }}>{ctx.zones.join(', ')}</span>
                  </div>
                )}
                {ctx.virtual_routers && ctx.virtual_routers.length > 0 && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    VRs: <span style={{ color: '#94a3b8' }}>
                      {ctx.virtual_routers.map(vr => `${vr.name} (${vr.static_routes?.length || 0} routes)`).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Static Routes Table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
          Static Routes ({staticRoutes.length})
        </h3>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd} style={{ fontSize: 11 }}>
          + Add Route
        </button>
      </div>

      {staticRoutes.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 13, padding: 20, textAlign: 'center' }}>
          No static routes found in source configuration.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#64748b', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Destination</th>
              <th style={{ padding: '6px 8px' }}>Next-Hop</th>
              <th style={{ padding: '6px 8px' }}>Type</th>
              <th style={{ padding: '6px 8px' }}>Interface</th>
              <th style={{ padding: '6px 8px' }}>Metric</th>
              <th style={{ padding: '6px 8px' }}>VRF</th>
              <th style={{ padding: '6px 8px' }}>Context</th>
              <th style={{ padding: '6px 4px', width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {staticRoutes.map((route, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid #1e293b',
                background: editingIndex === i ? '#1e293b' : 'transparent',
              }}>
                <td style={{ padding: '5px 8px' }}>
                  {editingIndex === i ? (
                    <input
                      type="text" value={route.destination}
                      onChange={(e) => handleChange(i, 'destination', e.target.value)}
                      style={inputStyle}
                    />
                  ) : (
                    <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{route.destination}</span>
                  )}
                </td>
                <td style={{ padding: '5px 8px' }}>
                  {editingIndex === i ? (
                    <input
                      type="text" value={route.next_hop}
                      onChange={(e) => handleChange(i, 'next_hop', e.target.value)}
                      style={inputStyle}
                    />
                  ) : (
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{route.next_hop || '-'}</span>
                  )}
                </td>
                <td style={{ padding: '5px 8px', color: '#64748b' }}>
                  {editingIndex === i ? (
                    <select
                      value={route.next_hop_type}
                      onChange={(e) => handleChange(i, 'next_hop_type', e.target.value)}
                      style={selectStyle}
                    >
                      <option value="ip-address">ip-address</option>
                      <option value="discard">discard</option>
                      <option value="next-vr">next-vr</option>
                      <option value="none">none</option>
                    </select>
                  ) : (
                    route.next_hop_type
                  )}
                </td>
                <td style={{ padding: '5px 8px', color: '#94a3b8' }}>
                  {editingIndex === i ? (
                    <input
                      type="text" value={route.interface || ''}
                      onChange={(e) => handleChange(i, 'interface', e.target.value)}
                      style={inputStyle}
                    />
                  ) : (
                    route.interface || '-'
                  )}
                </td>
                <td style={{ padding: '5px 8px', color: '#94a3b8' }}>
                  {editingIndex === i ? (
                    <input
                      type="number" value={route.metric}
                      onChange={(e) => handleChange(i, 'metric', parseInt(e.target.value) || 10)}
                      style={{ ...inputStyle, width: 50 }}
                    />
                  ) : (
                    route.metric
                  )}
                </td>
                <td style={{ padding: '5px 8px', color: route.vrf ? '#38bdf8' : '#475569' }}>
                  {route.vrf || '-'}
                </td>
                <td style={{ padding: '5px 8px', color: '#64748b', fontSize: 11 }}>
                  {route.routing_context || '-'}
                </td>
                <td style={{ padding: '5px 4px', textAlign: 'right' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                    style={{ fontSize: 10, padding: '1px 6px', marginRight: 2 }}
                    title={editingIndex === i ? 'Done editing' : 'Edit route'}
                  >
                    {editingIndex === i ? 'Done' : 'Edit'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(i)}
                    style={{ fontSize: 10, padding: '1px 6px', color: '#ef4444' }}
                    title="Delete route"
                  >
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
