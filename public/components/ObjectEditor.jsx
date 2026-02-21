/**
 * ObjectEditor Component
 *
 * Tabbed editor for the "Objects" tab in the center panel.
 * Three sub-tabs:
 *   1. Address Objects — name, type, value, description
 *   2. Address Groups — name, members, description
 *   3. Service Objects — name, protocol, port_range, description
 *
 * All editable inline with add/delete support.
 */
import React, { useState } from 'react';
import { ChipEditor } from './ZoneEditor.jsx';

export default function ObjectEditor({ intermediateConfig, onConfigUpdate }) {
  const [subTab, setSubTab] = useState('addresses');

  const addresses = intermediateConfig?.address_objects || [];
  const groups = intermediateConfig?.address_groups || [];
  const services = intermediateConfig?.service_objects || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar */}
      <div className="sub-tab-bar">
        <button
          className={`sub-tab-btn ${subTab === 'addresses' ? 'active' : ''}`}
          onClick={() => setSubTab('addresses')}
        >
          Addresses ({addresses.length})
        </button>
        <button
          className={`sub-tab-btn ${subTab === 'groups' ? 'active' : ''}`}
          onClick={() => setSubTab('groups')}
        >
          Groups ({groups.length})
        </button>
        <button
          className={`sub-tab-btn ${subTab === 'services' ? 'active' : ''}`}
          onClick={() => setSubTab('services')}
        >
          Services ({services.length})
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subTab === 'addresses' && (
          <AddressObjectTable
            items={addresses}
            onUpdate={(items) => onConfigUpdate('address_objects', items)}
          />
        )}
        {subTab === 'groups' && (
          <AddressGroupTable
            items={groups}
            onUpdate={(items) => onConfigUpdate('address_groups', items)}
          />
        )}
        {subTab === 'services' && (
          <ServiceObjectTable
            items={services}
            onUpdate={(items) => onConfigUpdate('service_objects', items)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Address Objects Table
// ---------------------------------------------------------------------------

function AddressObjectTable({ items, onUpdate }) {
  const handleChange = (index, field, value) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onUpdate(updated);
  };

  const handleAdd = () => {
    onUpdate([...items, {
      name: `addr-${items.length + 1}`,
      type: 'host',
      value: '',
      description: '',
      tags: [],
    }]);
  };

  const handleDelete = (index) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <table className="editor-table">
        <thead>
          <tr>
            <th style={{ width: 180 }}>Name</th>
            <th style={{ width: 90 }}>Type</th>
            <th>Value</th>
            <th style={{ width: 180 }}>Description</th>
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>
                <input
                  className="cell-input"
                  value={item.name}
                  onChange={(e) => handleChange(i, 'name', e.target.value)}
                />
              </td>
              <td>
                <select
                  className="cell-select"
                  value={item.type}
                  onChange={(e) => handleChange(i, 'type', e.target.value)}
                >
                  <option value="host">Host</option>
                  <option value="subnet">Subnet</option>
                  <option value="range">Range</option>
                  <option value="fqdn">FQDN</option>
                </select>
              </td>
              <td>
                <input
                  className="cell-input"
                  value={item.value}
                  onChange={(e) => handleChange(i, 'value', e.target.value)}
                  placeholder={item.type === 'host' ? '10.0.0.1/32' : item.type === 'subnet' ? '10.0.0.0/24' : item.type === 'fqdn' ? 'example.com' : '10.0.0.1-10.0.0.254'}
                />
              </td>
              <td>
                <input
                  className="cell-input"
                  value={item.description || ''}
                  onChange={(e) => handleChange(i, 'description', e.target.value)}
                  placeholder="Description"
                />
              </td>
              <td>
                <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(i)} title="Delete">x</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '8px 12px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add Address</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Address Groups Table
// ---------------------------------------------------------------------------

function AddressGroupTable({ items, onUpdate }) {
  const handleChange = (index, field, value) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onUpdate(updated);
  };

  const handleAddMember = (index, member) => {
    const item = items[index];
    if (item.members.includes(member)) return;
    handleChange(index, 'members', [...item.members, member]);
  };

  const handleRemoveMember = (index, member) => {
    const item = items[index];
    handleChange(index, 'members', item.members.filter(m => m !== member));
  };

  const handleAdd = () => {
    onUpdate([...items, {
      name: `group-${items.length + 1}`,
      members: [],
      description: '',
      tags: [],
    }]);
  };

  const handleDelete = (index) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <table className="editor-table">
        <thead>
          <tr>
            <th style={{ width: 180 }}>Name</th>
            <th>Members</th>
            <th style={{ width: 180 }}>Description</th>
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>
                <input
                  className="cell-input"
                  value={item.name}
                  onChange={(e) => handleChange(i, 'name', e.target.value)}
                />
              </td>
              <td>
                <ChipEditor
                  values={item.members}
                  onAdd={(val) => handleAddMember(i, val)}
                  onRemove={(val) => handleRemoveMember(i, val)}
                  placeholder="Add member..."
                />
              </td>
              <td>
                <input
                  className="cell-input"
                  value={item.description || ''}
                  onChange={(e) => handleChange(i, 'description', e.target.value)}
                />
              </td>
              <td>
                <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(i)} title="Delete">x</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '8px 12px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add Group</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service Objects Table
// ---------------------------------------------------------------------------

function ServiceObjectTable({ items, onUpdate }) {
  const handleChange = (index, field, value) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onUpdate(updated);
  };

  const handleAdd = () => {
    onUpdate([...items, {
      name: `svc-${items.length + 1}`,
      protocol: 'tcp',
      port_range: '',
      source_port: '',
      description: '',
    }]);
  };

  const handleDelete = (index) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <table className="editor-table">
        <thead>
          <tr>
            <th style={{ width: 160 }}>Name</th>
            <th style={{ width: 80 }}>Protocol</th>
            <th style={{ width: 120 }}>Port(s)</th>
            <th style={{ width: 120 }}>Source Port</th>
            <th>Description</th>
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>
                <input className="cell-input" value={item.name} onChange={(e) => handleChange(i, 'name', e.target.value)} />
              </td>
              <td>
                <select className="cell-select" value={item.protocol} onChange={(e) => handleChange(i, 'protocol', e.target.value)}>
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="sctp">SCTP</option>
                </select>
              </td>
              <td>
                <input className="cell-input" value={item.port_range} onChange={(e) => handleChange(i, 'port_range', e.target.value)} placeholder="80 or 1024-65535" />
              </td>
              <td>
                <input className="cell-input" value={item.source_port || ''} onChange={(e) => handleChange(i, 'source_port', e.target.value)} placeholder="Optional" />
              </td>
              <td>
                <input className="cell-input" value={item.description || ''} onChange={(e) => handleChange(i, 'description', e.target.value)} />
              </td>
              <td>
                <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(i)} title="Delete">x</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '8px 12px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAdd}>+ Add Service</button>
      </div>
    </div>
  );
}
