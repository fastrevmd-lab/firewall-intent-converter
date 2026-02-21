/**
 * PAN-OS XML Configuration Parser
 * =================================
 * Agent: PANOS-Expert
 *
 * Parses PAN-OS running-config XML exports (both device-level and Panorama)
 * into the vendor-neutral intermediate JSON schema.
 *
 * Handles:
 *   - Security zones and interfaces
 *   - Address objects (IP, FQDN, range, wildcard)
 *   - Address groups (static and dynamic)
 *   - Service objects (TCP/UDP with port ranges)
 *   - Service groups
 *   - Security rules (with all match criteria, actions, logging)
 *   - NAT rules (source, destination, static)
 *   - Custom applications
 *   - Basic VPN/IKE gateway detection
 *
 * Designed for configs up to 10,000+ rules — avoids unnecessary object
 * copies and uses direct property access where possible.
 */

import { XMLParser } from 'fast-xml-parser';
import {
  ensureArray,
  extractMembers,
  extractEntries,
  getNestedValue,
  createWarning,
  detectVendor,
} from './parser-utils.js';

// ---------------------------------------------------------------------------
// XML Parser Configuration
// ---------------------------------------------------------------------------

const xmlParserOptions = {
  ignoreAttributes: false,       // PAN-OS uses name="..." on <entry> elements
  attributeNamePrefix: '@_',     // Access attributes as @_name, @_uuid, etc.
  allowBooleanAttributes: true,
  parseTagValue: true,
  trimValues: true,
  // Force 'entry' and 'member' to always be arrays even when there's only one child.
  // These are the only PAN-OS elements that appear as repeated siblings.
  // Container nodes like <zone>, <address>, <rulebase> are singletons and must NOT
  // be forced to arrays — doing so breaks navigation (e.g., vsys.zone becomes [obj]
  // instead of obj).
  isArray: (name) => {
    return name === 'entry' || name === 'member';
  },
};

// ---------------------------------------------------------------------------
// Main Parser Entry Point
// ---------------------------------------------------------------------------

/**
 * Parses a complete PAN-OS XML configuration into the intermediate JSON schema.
 *
 * @param {string} configText - Raw PAN-OS XML configuration text
 * @returns {{ intermediateConfig: Object, warnings: Object[], parseStats: Object }}
 */
export function parsePanosConfig(configText) {
  // Detect vendor to confirm this is PAN-OS
  const detection = detectVendor(configText);
  if (detection.vendor !== 'panos' && detection.vendor !== 'unknown') {
    throw new Error(`Detected vendor "${detection.vendor}" — this parser only supports PAN-OS XML configs`);
  }

  const parser = new XMLParser(xmlParserOptions);
  let parsed;
  try {
    parsed = parser.parse(configText);
  } catch (err) {
    throw new Error(`Failed to parse XML: ${err.message}`);
  }

  const warnings = [];

  // Navigate to the vsys config. PAN-OS XML structure:
  // <config> → <devices> → <entry> → <vsys> → <entry name="vsys1">
  const config = parsed.config;
  if (!config) {
    throw new Error('Invalid PAN-OS config: missing <config> root element');
  }

  // Extract PAN-OS version from config attributes
  const panosVersion = config['@_version'] || 'unknown';

  // Find the vsys entry — handle both device-level and Panorama exports
  const vsysList = findVsysEntries(config);
  if (vsysList.length === 0) {
    throw new Error('No vsys found in configuration. Ensure this is a valid PAN-OS device config or Panorama export.');
  }

  // For Phase 1, parse the first vsys. Phase 2 will add multi-vsys/device-group handling.
  const vsys = vsysList[0];

  // Parse each config section into the intermediate schema
  const zones = parseZones(vsys, warnings);
  const addressObjects = parseAddressObjects(vsys, warnings);
  const addressGroups = parseAddressGroups(vsys, warnings);
  const serviceObjects = parseServiceObjects(vsys, warnings);
  const serviceGroups = parseServiceGroups(vsys, warnings);
  const applications = parseApplications(vsys, warnings);
  const securityPolicies = parseSecurityRules(vsys, warnings);
  const natRules = parseNatRules(vsys, warnings);

  const intermediateConfig = {
    zones,
    address_objects: addressObjects,
    address_groups: addressGroups,
    service_objects: serviceObjects,
    service_groups: serviceGroups,
    security_policies: securityPolicies,
    nat_rules: natRules,
    applications,
    vpn_tunnels: [], // Phase 2
    metadata: {
      source_vendor: 'panos',
      source_version: panosVersion,
      export_date: new Date().toISOString(),
      rule_count: securityPolicies.length,
      nat_rule_count: natRules.length,
      object_count: addressObjects.length + addressGroups.length + serviceObjects.length + serviceGroups.length,
      zone_count: zones.length,
    },
  };

  return {
    intermediateConfig,
    warnings,
    parseStats: intermediateConfig.metadata,
  };
}

// ---------------------------------------------------------------------------
// VSys Finder
// ---------------------------------------------------------------------------

/**
 * Locates all vsys entries in the config, handling both device-level
 * configs and Panorama device group structures.
 */
function findVsysEntries(config) {
  // Standard device config: config → devices → entry → vsys → entry
  const devices = getNestedValue(config, 'devices');
  if (devices) {
    const deviceEntries = extractEntries(devices);
    for (const device of deviceEntries) {
      const vsys = getNestedValue(device, 'vsys');
      if (vsys) {
        return extractEntries(vsys);
      }
    }
  }

  // Panorama shared config: config → shared (treat as single virtual vsys)
  const shared = getNestedValue(config, 'shared');
  if (shared) {
    return [shared];
  }

  // Direct vsys at config level (some export formats)
  const directVsys = getNestedValue(config, 'vsys');
  if (directVsys) {
    return extractEntries(directVsys);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Zone Parser
// ---------------------------------------------------------------------------

function parseZones(vsys, warnings) {
  const zoneContainer = vsys.zone;
  if (!zoneContainer) return [];

  const entries = extractEntries(zoneContainer);
  return entries.map((entry) => {
    const name = entry['@_name'] || 'unnamed-zone';
    const interfaces = [];

    // PAN-OS zones have network → layer3 → member for L3 interfaces
    const l3Members = getNestedValue(entry, 'network.layer3');
    if (l3Members) {
      interfaces.push(...extractMembers(l3Members));
    }

    // Also check for layer2 interfaces
    const l2Members = getNestedValue(entry, 'network.layer2');
    if (l2Members) {
      interfaces.push(...extractMembers(l2Members));
    }

    return {
      name,
      description: entry.description || '',
      interfaces,
    };
  });
}

// ---------------------------------------------------------------------------
// Address Object Parser
// ---------------------------------------------------------------------------

function parseAddressObjects(vsys, warnings) {
  const addressContainer = vsys.address;
  if (!addressContainer) return [];

  const entries = extractEntries(addressContainer);
  return entries.map((entry) => {
    const name = entry['@_name'] || 'unnamed-address';
    const tags = extractMembers(entry.tag);
    let type = 'unknown';
    let value = '';

    if (entry['ip-netmask']) {
      type = entry['ip-netmask'].includes('/32') ? 'host' : 'subnet';
      value = entry['ip-netmask'];
    } else if (entry['ip-range']) {
      type = 'range';
      value = entry['ip-range'];
    } else if (entry.fqdn) {
      type = 'fqdn';
      value = entry.fqdn;
      warnings.push(createWarning(
        'warning',
        `address/${name}`,
        `FQDN address "${name}" → SRX dns-name requires SRX 12.1+ and DNS resolution at commit time`,
        'Verify SRX version supports dns-name, or replace with static IP'
      ));
    } else if (entry['ip-wildcard']) {
      type = 'wildcard';
      value = entry['ip-wildcard'];
      warnings.push(createWarning(
        'unsupported',
        `address/${name}`,
        `Wildcard mask address "${name}" has no direct SRX equivalent`,
        'Convert to a subnet or address range manually'
      ));
    }

    return { name, type, value, description: entry.description || '', tags };
  });
}

// ---------------------------------------------------------------------------
// Address Group Parser
// ---------------------------------------------------------------------------

function parseAddressGroups(vsys, warnings) {
  const groupContainer = vsys['address-group'];
  if (!groupContainer) return [];

  const entries = extractEntries(groupContainer);
  return entries.map((entry) => {
    const name = entry['@_name'] || 'unnamed-group';
    const tags = extractMembers(entry.tag);
    let members = [];

    // Static group: has <static><member>...</member></static>
    const staticNode = entry.static;
    if (staticNode) {
      // static might be an array from isArray config; take first element if so
      const staticObj = Array.isArray(staticNode) ? staticNode[0] : staticNode;
      members = extractMembers(staticObj);
    }

    // Dynamic group: has <dynamic><filter>...</filter></dynamic>
    if (entry.dynamic) {
      warnings.push(createWarning(
        'interview_required',
        `address-group/${name}`,
        `Dynamic address group "${name}" uses tag-based matching — SRX does not support dynamic address groups natively`,
        'Define the group members statically, or use SRX address-book with feed servers'
      ));
    }

    return {
      name,
      members,
      description: entry.description || '',
      tags,
    };
  });
}

// ---------------------------------------------------------------------------
// Service Object Parser
// ---------------------------------------------------------------------------

function parseServiceObjects(vsys, warnings) {
  const serviceContainer = vsys.service;
  if (!serviceContainer) return [];

  const entries = extractEntries(serviceContainer);
  return entries.map((entry) => {
    const name = entry['@_name'] || 'unnamed-service';
    let protocol = 'tcp';
    let portRange = '';
    let sourcePort = '';

    const proto = entry.protocol;
    if (proto) {
      if (proto.tcp) {
        protocol = 'tcp';
        portRange = proto.tcp.port ? String(proto.tcp.port) : '';
        sourcePort = proto.tcp['source-port'] ? String(proto.tcp['source-port']) : '';
      } else if (proto.udp) {
        protocol = 'udp';
        portRange = proto.udp.port ? String(proto.udp.port) : '';
        sourcePort = proto.udp['source-port'] ? String(proto.udp['source-port']) : '';
      } else if (proto.sctp) {
        protocol = 'sctp';
        portRange = proto.sctp.port ? String(proto.sctp.port) : '';
        warnings.push(createWarning(
          'warning',
          `service/${name}`,
          `SCTP service "${name}" — SRX SCTP support varies by platform and version`,
          'Verify SRX platform supports SCTP'
        ));
      }
    }

    return {
      name,
      protocol,
      port_range: portRange,
      source_port: sourcePort,
      description: entry.description || '',
    };
  });
}

// ---------------------------------------------------------------------------
// Service Group Parser
// ---------------------------------------------------------------------------

function parseServiceGroups(vsys, warnings) {
  const groupContainer = vsys['service-group'];
  if (!groupContainer) return [];

  const entries = extractEntries(groupContainer);
  return entries.map((entry) => {
    const name = entry['@_name'] || 'unnamed-service-group';
    const members = extractMembers(entry.members || entry);

    return {
      name,
      members,
      description: entry.description || '',
    };
  });
}

// ---------------------------------------------------------------------------
// Application Parser
// ---------------------------------------------------------------------------

function parseApplications(vsys, warnings) {
  const appContainer = vsys.application;
  if (!appContainer) return [];

  const entries = extractEntries(appContainer);
  return entries.map((entry) => {
    const name = entry['@_name'] || 'unnamed-app';

    // Extract protocol/port from default settings if available
    let protocol = '';
    let port = '';

    const defaults = entry.default;
    if (defaults) {
      const portList = getNestedValue(defaults, 'port');
      if (portList) {
        // PAN-OS format: "tcp/80,443" or "udp/53"
        const portMembers = extractMembers(portList);
        if (portMembers.length > 0) {
          const firstPort = portMembers[0];
          const match = firstPort.match(/^(tcp|udp)\/([\d,-]+)$/i);
          if (match) {
            protocol = match[1].toLowerCase();
            port = match[2];
          }
        }
      }
    }

    if (!protocol && !port) {
      warnings.push(createWarning(
        'interview_required',
        `application/${name}`,
        `Custom application "${name}" has no default port defined — SRX needs explicit protocol/port`,
        'Specify the protocol and port(s) this application uses'
      ));
    }

    return {
      name,
      protocol,
      port,
      description: entry.description || '',
    };
  });
}

// ---------------------------------------------------------------------------
// Security Rules Parser
// ---------------------------------------------------------------------------

function parseSecurityRules(vsys, warnings) {
  // Rules live under rulebase → security → rules → entry
  const rulebase = vsys.rulebase;
  if (!rulebase) return [];

  const securityNode = rulebase.security;
  if (!securityNode) return [];

  const rulesNode = securityNode.rules;
  if (!rulesNode) return [];

  // rulesNode itself might be an array (from isArray config)
  const rulesContainer = Array.isArray(rulesNode) ? rulesNode[0] : rulesNode;
  const ruleEntries = extractEntries(rulesContainer);

  return ruleEntries.map((entry, index) => {
    const name = entry['@_name'] || `rule-${index + 1}`;
    const srcZones = extractMembers(entry.from);
    const dstZones = extractMembers(entry.to);
    const srcAddresses = extractMembers(entry.source);
    const dstAddresses = extractMembers(entry.destination);
    const applications = extractMembers(entry.application);
    const services = extractMembers(entry.service);
    const action = parseAction(entry.action);
    const disabled = entry.disabled === 'yes' || entry.disabled === true;
    const description = entry.description || '';
    const tags = extractMembers(entry.tag);

    // Logging
    const logStart = entry['log-start'] === 'yes' || entry['log-start'] === true;
    const logEnd = entry['log-end'] === 'yes' || entry['log-end'] === true || entry['log-end'] === undefined;

    // Security profile group (AV, IPS, URL filtering, etc.)
    let profileGroup = '';
    if (entry['profile-setting']) {
      const group = getNestedValue(entry, 'profile-setting.group');
      if (group) {
        const groupMembers = extractMembers(group);
        profileGroup = groupMembers[0] || '';
        warnings.push(createWarning(
          'interview_required',
          `security-rule/${name}`,
          `Rule "${name}" uses security profile group "${profileGroup}" — SRX has limited UTM equivalent`,
          'Choose whether to insert as comment, attempt UTM mapping, or skip'
        ));
      }
    }

    // Flag application-default service usage
    if (services.includes('application-default')) {
      warnings.push(createWarning(
        'warning',
        `security-rule/${name}`,
        `Rule "${name}" uses "application-default" service — SRX will use the application's default ports`,
        'Verify the application mapping includes correct port definitions'
      ));
    }

    // Flag any/any zone combinations
    if (srcZones.includes('any') && dstZones.includes('any')) {
      warnings.push(createWarning(
        'warning',
        `security-rule/${name}`,
        `Rule "${name}" matches any source AND any destination zone — this is very broad`,
        'Confirm this rule should apply to all zone pairs on the SRX'
      ));
    }

    // Flag disabled rules
    if (disabled) {
      warnings.push(createWarning(
        'warning',
        `security-rule/${name}`,
        `Rule "${name}" is disabled — will be converted using "deactivate" in SRX`,
        'Choose whether to include disabled rules or skip them entirely'
      ));
    }

    // Flag tag usage
    if (tags.length > 0) {
      warnings.push(createWarning(
        'warning',
        `security-rule/${name}`,
        `Rule "${name}" has tags [${tags.join(', ')}] — SRX does not support tag-based policy matching`,
        'Tags will be added to the rule description as comments'
      ));
    }

    return {
      name,
      src_zones: srcZones,
      dst_zones: dstZones,
      src_addresses: srcAddresses,
      dst_addresses: dstAddresses,
      applications,
      services,
      action,
      log_start: logStart,
      log_end: logEnd,
      profile_group: profileGroup,
      description,
      tags,
      disabled,
      _rule_index: index + 1,
    };
  });
}

/**
 * Parses the PAN-OS action field, which can be a string or an object.
 * PAN-OS uses: allow, deny, drop, reset-client, reset-server, reset-both
 */
function parseAction(actionField) {
  if (!actionField) return 'deny';
  if (typeof actionField === 'string') return actionField;
  // Object form: { allow: null } or { deny: null } or { drop: null }
  if (typeof actionField === 'object') {
    const keys = Object.keys(actionField);
    return keys[0] || 'deny';
  }
  return 'deny';
}

// ---------------------------------------------------------------------------
// NAT Rules Parser
// ---------------------------------------------------------------------------

function parseNatRules(vsys, warnings) {
  const rulebase = vsys.rulebase;
  if (!rulebase) return [];

  const natNode = rulebase.nat;
  if (!natNode) return [];

  const rulesNode = natNode.rules;
  if (!rulesNode) return [];

  const rulesContainer = Array.isArray(rulesNode) ? rulesNode[0] : rulesNode;
  const ruleEntries = extractEntries(rulesContainer);

  return ruleEntries.map((entry, index) => {
    const name = entry['@_name'] || `nat-rule-${index + 1}`;
    const srcZones = extractMembers(entry.from);
    const dstZones = extractMembers(entry.to);
    const srcAddresses = extractMembers(entry.source);
    const dstAddresses = extractMembers(entry.destination);
    const description = entry.description || '';

    let type = 'unknown';
    let translatedSrc = null;
    let translatedDst = null;
    let translatedPort = null;

    // Source NAT
    if (entry['source-translation']) {
      type = 'source';
      const srcTrans = entry['source-translation'];

      if (srcTrans['dynamic-ip-and-port']) {
        const dip = srcTrans['dynamic-ip-and-port'];
        if (dip['interface-address']) {
          translatedSrc = { type: 'interface', interface: dip['interface-address'].interface || '' };
        } else if (dip['translated-address']) {
          const translatedAddrs = extractMembers(dip['translated-address']);
          translatedSrc = { type: 'dynamic-ip-pool', addresses: translatedAddrs };
          warnings.push(createWarning(
            'interview_required',
            `nat-rule/${name}`,
            `NAT rule "${name}" uses dynamic IP pool — SRX requires an explicit source NAT pool definition`,
            'Specify the IP range for the SRX source NAT pool'
          ));
        }
      } else if (srcTrans['static-ip']) {
        type = 'static';
        translatedSrc = {
          type: 'static',
          address: srcTrans['static-ip']['translated-address'] || '',
        };
      }
    }

    // Destination NAT
    if (entry['destination-translation']) {
      type = type === 'source' ? 'source-and-destination' : 'destination';
      const dstTrans = entry['destination-translation'];
      translatedDst = dstTrans['translated-address'] || '';
      translatedPort = dstTrans['translated-port'] ? String(dstTrans['translated-port']) : null;
    }

    return {
      name,
      type,
      src_zones: srcZones,
      dst_zones: dstZones,
      src_addresses: srcAddresses,
      dst_addresses: dstAddresses,
      translated_src: translatedSrc,
      translated_dst: translatedDst,
      translated_port: translatedPort,
      description,
      _rule_index: index + 1,
    };
  });
}
