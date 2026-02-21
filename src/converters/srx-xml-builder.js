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

import { sanitizeJunosName, mapPanosAppToJunos, mapPanosProfileToSrx } from '../parsers/parser-utils.js';

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

  // Compute UTM/IDP/SecIntel assignment maps (mirrors srx-converter logic)
  const { utmPolicyMap, utmProfiles } = computeUtmMap(config.security_policies);
  const { idpPolicyMap } = computeIdpMap(config.security_policies);
  const blockLists = (config.external_lists || []).filter(e => e.isBlockList);
  const secIntelEnabled = blockLists.length > 0;

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<configuration>');

  // Security section
  lines.push('  <security>');

  // Zones
  buildZonesXml(config.zones, lines, interfaceMappings);

  // Address book
  buildAddressBookXml(config.address_objects, config.address_groups, lines);

  // UTM
  buildUtmXml(utmProfiles, lines);

  // Policies
  buildPoliciesXml(config.security_policies, lines, warnings, { utmPolicyMap, idpPolicyMap, secIntelEnabled });

  // NAT
  buildNatXml(config.nat_rules, lines, warnings);

  lines.push('  </security>');

  // Applications
  buildApplicationsXml(config.service_objects, config.applications, lines);

  // Services (SecIntel)
  if (secIntelEnabled) {
    buildSecIntelXml(blockLists, lines);
  }

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

function buildPoliciesXml(policies, lines, warnings, profileMaps = {}) {
  if (!policies || policies.length === 0) return;

  const { utmPolicyMap = {}, idpPolicyMap = {}, secIntelEnabled = false } = profileMaps;

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

      // Clean EDL addresses from match criteria
      const secIntelAddrs = new Set(policy._secIntelAddresses || []);
      let srcAddrs = policy.src_addresses.filter(a => !secIntelAddrs.has(a));
      let dstAddrs = policy.dst_addresses.filter(a => !secIntelAddrs.has(a));
      if (srcAddrs.length === 0 && policy.src_addresses.length > 0) srcAddrs = ['any'];
      if (dstAddrs.length === 0 && policy.dst_addresses.length > 0) dstAddrs = ['any'];

      lines.push('        <policy>');
      lines.push(`          <name>${escapeXml(name)}</name>`);

      // Match
      lines.push('          <match>');
      for (const addr of (srcAddrs.length > 0 ? srcAddrs : ['any'])) {
        lines.push(`            <source-address>${escapeXml(sanitizeJunosName(addr))}</source-address>`);
      }
      for (const addr of (dstAddrs.length > 0 ? dstAddrs : ['any'])) {
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

      // Application services (UTM / IDP / SecIntel)
      const hasUtm = !!utmPolicyMap[policy.name];
      const hasIdp = !!idpPolicyMap[policy.name];
      const hasProfileGroup = policy.profile_group && Object.keys(policy.security_profiles || {}).length === 0;
      const hasSecIntel = secIntelEnabled && policy.action === 'allow' &&
        policy.dst_zones.some(z => z.toLowerCase() === 'untrust');

      if (hasUtm || hasIdp || hasSecIntel || hasProfileGroup) {
        lines.push('            <application-services>');
        if (hasUtm) {
          lines.push(`              <utm-policy>${escapeXml(utmPolicyMap[policy.name])}</utm-policy>`);
        } else if (hasProfileGroup) {
          lines.push('              <utm-policy>default-utm</utm-policy>');
        }
        if (hasIdp) {
          lines.push(`              <idp-policy>${escapeXml(idpPolicyMap[policy.name])}</idp-policy>`);
        }
        if (hasSecIntel) {
          lines.push('              <security-intelligence-policy>secIntel-policy</security-intelligence-policy>');
        }
        lines.push('            </application-services>');
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
// UTM XML Builder
// ---------------------------------------------------------------------------

function computeUtmMap(policies) {
  const utmPolicyMap = {};
  const utmProfiles = []; // { policyName, profiles: { type → mapped } }
  if (!policies) return { utmPolicyMap, utmProfiles };

  const utmTypes = ['virus', 'wildfire-analysis', 'url-filtering', 'file-blocking'];
  const comboMap = new Map();
  let idx = 0;

  for (const policy of policies) {
    const sp = policy.security_profiles || {};
    const utmP = {};
    for (const t of utmTypes) {
      if (sp[t]) utmP[t] = sp[t];
    }
    if (Object.keys(utmP).length === 0) continue;

    const key = JSON.stringify(utmP);
    if (!comboMap.has(key)) {
      idx++;
      const pName = `utm-policy-${idx}`;
      const mapped = {};
      for (const [pt, pv] of Object.entries(utmP)) {
        mapped[pt] = mapPanosProfileToSrx(pt, pv);
      }
      comboMap.set(key, { policyName: pName, profiles: mapped });
      utmProfiles.push({ policyName: pName, profiles: mapped });
    }
    utmPolicyMap[policy.name] = comboMap.get(key).policyName;
  }
  return { utmPolicyMap, utmProfiles };
}

function computeIdpMap(policies) {
  const idpPolicyMap = {};
  if (!policies) return { idpPolicyMap };

  const idpTypes = ['spyware', 'vulnerability'];
  const comboMap = new Map();
  let idx = 0;

  for (const policy of policies) {
    const sp = policy.security_profiles || {};
    const hasIdp = idpTypes.some(t => sp[t]);
    if (!hasIdp) continue;

    const idpP = {};
    for (const t of idpTypes) {
      if (sp[t]) idpP[t] = sp[t];
    }
    const key = JSON.stringify(idpP);
    if (!comboMap.has(key)) {
      idx++;
      comboMap.set(key, `idp-policy-${idx}`);
    }
    idpPolicyMap[policy.name] = comboMap.get(key);
  }
  return { idpPolicyMap };
}

function buildUtmXml(utmProfiles, lines) {
  if (!utmProfiles || utmProfiles.length === 0) return;

  lines.push('    <utm>');

  // Feature profiles
  const emitted = new Set();
  lines.push('      <feature-profile>');
  for (const combo of utmProfiles) {
    for (const mapped of Object.values(combo.profiles)) {
      if (mapped.srxFeature !== 'utm' || emitted.has(mapped.srxProfile)) continue;
      emitted.add(mapped.srxProfile);

      if (mapped.srxType === 'anti-virus') {
        lines.push(`        <anti-virus><profile name="${escapeXml(mapped.srxProfile)}"/></anti-virus>`);
      } else if (mapped.srxType === 'web-filtering') {
        lines.push(`        <web-filtering><profile name="${escapeXml(mapped.srxProfile)}" type="juniper-enhanced"/></web-filtering>`);
      } else if (mapped.srxType === 'content-filtering') {
        lines.push(`        <content-filtering><profile name="${escapeXml(mapped.srxProfile)}"/></content-filtering>`);
      }
    }
  }
  lines.push('      </feature-profile>');

  // UTM policies
  for (const combo of utmProfiles) {
    lines.push(`      <utm-policy name="${escapeXml(combo.policyName)}">`);
    for (const mapped of Object.values(combo.profiles)) {
      if (mapped.srxFeature !== 'utm') continue;
      if (mapped.srxType === 'anti-virus') {
        lines.push(`        <anti-virus><http-profile>${escapeXml(mapped.srxProfile)}</http-profile></anti-virus>`);
      } else if (mapped.srxType === 'web-filtering') {
        lines.push(`        <web-filtering><http-profile>${escapeXml(mapped.srxProfile)}</http-profile></web-filtering>`);
      } else if (mapped.srxType === 'content-filtering') {
        lines.push(`        <content-filtering><rule-set>${escapeXml(mapped.srxProfile)}</rule-set></content-filtering>`);
      }
    }
    lines.push('      </utm-policy>');
  }

  lines.push('    </utm>');
}

// ---------------------------------------------------------------------------
// SecIntel XML Builder
// ---------------------------------------------------------------------------

function buildSecIntelXml(blockLists, lines) {
  if (!blockLists || blockLists.length === 0) return;

  lines.push('  <services>');
  lines.push('    <security-intelligence>');

  lines.push('      <profile>');
  lines.push('        <name>secIntel-profile</name>');
  lines.push('        <category>BlockList</category>');
  blockLists.forEach((bl, i) => {
    const ruleName = `secIntel-rule-${i + 1}`;
    lines.push(`        <rule>`);
    lines.push(`          <name>${escapeXml(ruleName)}</name>`);
    lines.push('          <match><threat-level>10</threat-level></match>');
    lines.push('          <then><action>block close</action><log/></then>');
    lines.push('        </rule>');
  });
  lines.push('      </profile>');

  lines.push('      <policy>');
  lines.push('        <name>secIntel-policy</name>');
  lines.push('        <profile>secIntel-profile</profile>');
  lines.push('      </policy>');

  lines.push('    </security-intelligence>');
  lines.push('  </services>');
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
