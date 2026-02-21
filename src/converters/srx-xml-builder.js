/**
 * SRX XML Configuration Builder
 * ================================
 * Agent: SRX-Expert
 *
 * Converts the vendor-neutral intermediate JSON schema into Junos XML
 * configuration format, suitable for "load merge" or "load replace" on SRX.
 *
 * Phase 1: Basic XML structure with security zones, address book, and policies.
 * Phase 2+: Full XML with NAT, routing, VPN, UTM.
 */

import { sanitizeJunosName, mapPanosAppToJunos } from '../parsers/parser-utils.js';

/**
 * Builds a Junos XML configuration from the intermediate config.
 *
 * @param {Object} config - Intermediate JSON config
 * @param {Object} [interfaceMappings] - User-defined PAN-OS → SRX interface mappings
 * @returns {{ xml: string, warnings: Object[] }}
 */
export function buildSrxXml(config, interfaceMappings = {}) {
  const warnings = [];
  const lines = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<configuration>');

  // Security section
  lines.push('  <security>');

  // Zones
  buildZonesXml(config.zones, lines, interfaceMappings);

  // Address book
  buildAddressBookXml(config.address_objects, config.address_groups, lines);

  // Policies
  buildPoliciesXml(config.security_policies, lines, warnings);

  // NAT
  buildNatXml(config.nat_rules, lines, warnings);

  lines.push('  </security>');

  // Applications
  buildApplicationsXml(config.service_objects, config.applications, lines);

  lines.push('</configuration>');

  return {
    xml: lines.join('\n'),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Zone XML Builder
// ---------------------------------------------------------------------------

function buildZonesXml(zones, lines, interfaceMappings = {}) {
  if (!zones || zones.length === 0) return;

  lines.push('    <zones>');
  for (const zone of zones) {
    const name = sanitizeJunosName(zone.name);
    lines.push(`      <security-zone>`);
    lines.push(`        <name>${escapeXml(name)}</name>`);
    if (zone.description) {
      lines.push(`        <description>${escapeXml(zone.description)}</description>`);
    }
    for (const iface of zone.interfaces || []) {
      // Use user-defined mapping if available, otherwise use as-is
      let srxIface = iface;
      if (interfaceMappings[iface]) {
        srxIface = interfaceMappings[iface];
        if (!srxIface.includes('.')) srxIface += '.0';
      } else {
        const base = iface.split('.')[0];
        if (interfaceMappings[base]) {
          const unit = iface.includes('.') ? iface.split('.')[1] : '0';
          srxIface = `${interfaceMappings[base].split('.')[0]}.${unit}`;
        }
      }
      lines.push(`        <interfaces>`);
      lines.push(`          <name>${escapeXml(srxIface)}</name>`);
      lines.push(`        </interfaces>`);
    }
    lines.push(`      </security-zone>`);
  }
  lines.push('    </zones>');
}

// ---------------------------------------------------------------------------
// Address Book XML Builder
// ---------------------------------------------------------------------------

function buildAddressBookXml(addressObjects, addressGroups, lines) {
  if ((!addressObjects || addressObjects.length === 0) &&
      (!addressGroups || addressGroups.length === 0)) return;

  lines.push('    <address-book>');
  lines.push('      <name>global</name>');

  // Address entries
  for (const obj of (addressObjects || [])) {
    const name = sanitizeJunosName(obj.name);
    lines.push('      <address>');
    lines.push(`        <name>${escapeXml(name)}</name>`);

    switch (obj.type) {
      case 'host':
      case 'subnet':
        lines.push(`        <ip-prefix>${escapeXml(obj.value)}</ip-prefix>`);
        break;
      case 'fqdn':
        lines.push(`        <dns-name>`);
        lines.push(`          <name>${escapeXml(obj.value)}</name>`);
        lines.push(`        </dns-name>`);
        break;
      case 'range':
        lines.push(`        <range-address>`);
        lines.push(`          <name>${escapeXml(name)}</name>`);
        const [low, high] = obj.value.split('-').map(s => s.trim());
        lines.push(`          <low>${escapeXml(low)}</low>`);
        lines.push(`          <high>${escapeXml(high)}</high>`);
        lines.push(`        </range-address>`);
        break;
    }

    if (obj.description) {
      lines.push(`        <description>${escapeXml(obj.description)}</description>`);
    }

    lines.push('      </address>');
  }

  // Address sets (groups)
  for (const group of (addressGroups || [])) {
    const groupName = sanitizeJunosName(group.name);
    lines.push('      <address-set>');
    lines.push(`        <name>${escapeXml(groupName)}</name>`);
    for (const member of group.members) {
      lines.push('        <address>');
      lines.push(`          <name>${escapeXml(sanitizeJunosName(member))}</name>`);
      lines.push('        </address>');
    }
    lines.push('      </address-set>');
  }

  lines.push('    </address-book>');
}

// ---------------------------------------------------------------------------
// Security Policies XML Builder
// ---------------------------------------------------------------------------

function buildPoliciesXml(policies, lines, warnings) {
  if (!policies || policies.length === 0) return;

  // Group policies by zone pair
  const zonePairs = {};
  for (const policy of policies) {
    const srcZones = policy.src_zones.length > 0 ? policy.src_zones : ['any'];
    const dstZones = policy.dst_zones.length > 0 ? policy.dst_zones : ['any'];

    for (const src of srcZones) {
      for (const dst of dstZones) {
        const key = `${src}|${dst}`;
        if (!zonePairs[key]) zonePairs[key] = { from: src, to: dst, policies: [] };
        zonePairs[key].policies.push(policy);
      }
    }
  }

  lines.push('    <policies>');

  for (const pair of Object.values(zonePairs)) {
    lines.push('      <policy>');
    lines.push(`        <from-zone-name>${escapeXml(sanitizeJunosName(pair.from))}</from-zone-name>`);
    lines.push(`        <to-zone-name>${escapeXml(sanitizeJunosName(pair.to))}</to-zone-name>`);

    for (const policy of pair.policies) {
      const name = sanitizeJunosName(policy.name);
      lines.push('        <policy>');
      lines.push(`          <name>${escapeXml(name)}</name>`);

      // Match
      lines.push('          <match>');
      for (const addr of (policy.src_addresses.length > 0 ? policy.src_addresses : ['any'])) {
        lines.push(`            <source-address>${escapeXml(sanitizeJunosName(addr))}</source-address>`);
      }
      for (const addr of (policy.dst_addresses.length > 0 ? policy.dst_addresses : ['any'])) {
        lines.push(`            <destination-address>${escapeXml(sanitizeJunosName(addr))}</destination-address>`);
      }

      const apps = resolveApps(policy.applications, policy.services);
      for (const app of apps) {
        lines.push(`            <application>${escapeXml(app)}</application>`);
      }
      lines.push('          </match>');

      // Then
      lines.push('          <then>');
      const action = policy.action === 'allow' ? 'permit' : (policy.action === 'drop' ? 'deny' : (policy.action === 'deny' ? 'deny' : 'reject'));
      lines.push(`            <${action}/>`);
      if (policy.log_start || policy.log_end) {
        lines.push('            <log>');
        if (policy.log_start) lines.push('              <session-init/>');
        if (policy.log_end) lines.push('              <session-close/>');
        lines.push('            </log>');
      }
      lines.push('          </then>');

      lines.push('        </policy>');
    }

    lines.push('      </policy>');
  }

  lines.push('    </policies>');
}

// ---------------------------------------------------------------------------
// NAT XML Builder (basic Phase 1 structure)
// ---------------------------------------------------------------------------

function buildNatXml(natRules, lines, warnings) {
  if (!natRules || natRules.length === 0) return;

  lines.push('    <nat>');

  const sourceRules = natRules.filter(r => r.type === 'source');
  if (sourceRules.length > 0) {
    lines.push('      <source>');
    for (const rule of sourceRules) {
      lines.push('        <rule-set>');
      lines.push(`          <name>${escapeXml(sanitizeJunosName(rule.name))}</name>`);
      for (const zone of (rule.src_zones || [])) {
        lines.push(`          <from><zone>${escapeXml(sanitizeJunosName(zone))}</zone></from>`);
      }
      for (const zone of (rule.dst_zones || [])) {
        lines.push(`          <to><zone>${escapeXml(sanitizeJunosName(zone))}</zone></to>`);
      }
      lines.push('        </rule-set>');
    }
    lines.push('      </source>');
  }

  lines.push('    </nat>');
}

// ---------------------------------------------------------------------------
// Applications XML Builder
// ---------------------------------------------------------------------------

function buildApplicationsXml(serviceObjects, applications, lines) {
  const allApps = [...(serviceObjects || []), ...(applications || [])];
  if (allApps.length === 0) return;

  lines.push('  <applications>');

  for (const app of allApps) {
    const name = sanitizeJunosName(app.name);
    const protocol = app.protocol || 'tcp';
    const port = app.port_range || app.port || '';
    if (!port) continue;

    lines.push('    <application>');
    lines.push(`      <name>${escapeXml(name)}</name>`);
    lines.push(`      <protocol>${escapeXml(protocol)}</protocol>`);
    lines.push(`      <destination-port>${escapeXml(port)}</destination-port>`);
    if (app.description) {
      lines.push(`      <description>${escapeXml(app.description)}</description>`);
    }
    lines.push('    </application>');
  }

  lines.push('  </applications>');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveApps(applications, services) {
  const resolved = [];
  if (applications && applications.length > 0) {
    for (const app of applications) {
      if (app === 'any') { resolved.push('any'); continue; }
      const junos = mapPanosAppToJunos(app);
      resolved.push(junos || sanitizeJunosName(app));
    }
  }
  if (services && services.length > 0) {
    for (const svc of services) {
      if (svc === 'application-default' || svc === 'any') continue;
      resolved.push(sanitizeJunosName(svc));
    }
  }
  if (resolved.length === 0) resolved.push('any');
  return [...new Set(resolved)];
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
