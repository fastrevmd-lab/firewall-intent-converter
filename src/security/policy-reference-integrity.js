/**
 * Policy Reference Integrity Detection
 * =======================================
 *
 * Finds security policies that reference undefined address or service objects.
 * A referenced name is undefined when it is none of:
 *   - 'any' (universal wildcard)
 *   - a literal address (IPv4/IPv6, prefix, or range) for address fields
 *   - a literal service ('application-default', proto/port shape, or bare port) for service fields
 *   - a defined name in address_objects ∪ address_groups (for addresses)
 *   - a defined name in service_objects ∪ service_groups (for services)
 *
 * Applications are intentionally NOT checked here (covered by issue #33).
 */

/**
 * Detects whether a string looks like a literal IP address, prefix, or range.
 * Accepts IPv4 and IPv6 forms:
 *   - Plain address: 192.0.2.1, 2001:db8::1
 *   - Prefix: 192.0.2.0/24, 2001:db8::/32
 *   - Range: 192.0.2.1-192.0.2.10
 *
 * @param {string} value - The address value to test
 * @returns {boolean} True if the value looks like a literal address
 */
function isLiteralAddress(value) {
  if (!value || typeof value !== 'string') return false;

  // IPv4: digits and dots, optionally with /prefix or -range
  // IPv6: hex digits and colons, optionally with /prefix
  const ipv4Pattern = /^[\d.]+(-[\d.]+)?(\/\d+)?$/;
  const ipv6Pattern = /^[0-9a-fA-F:]+(-[0-9a-fA-F:]+)?(\/\d+)?$/;

  return ipv4Pattern.test(value) || ipv6Pattern.test(value);
}

/**
 * Detects whether a string looks like a literal service specification.
 * Accepts:
 *   - 'application-default'
 *   - proto/port: tcp/443, udp/53
 *   - bare port number: 8080
 *
 * @param {string} value - The service value to test
 * @returns {boolean} True if the value looks like a literal service
 */
function isLiteralService(value) {
  if (!value || typeof value !== 'string') return false;

  // application-default
  if (value === 'application-default') return true;

  // proto/port or bare port number
  const protoPortPattern = /^(tcp|udp|icmp)\/\d+$/i;
  const barePortPattern = /^\d+$/;

  return protoPortPattern.test(value) || barePortPattern.test(value);
}

/**
 * Finds security policies with undefined address or service references.
 * Returns a map of policy index → { addresses: string[], services: string[] }
 * containing ONLY policies that have at least one undefined reference.
 *
 * @param {Object} config - Intermediate JSON config
 * @returns {Map<number, {addresses: string[], services: string[]}>} Map of offending policy indices
 */
export function findPolicyReferenceIssues(config) {
  const issues = new Map();

  // Build defined name sets once
  const addressNames = new Set();
  for (const obj of config.address_objects || []) {
    if (obj.name) addressNames.add(obj.name);
  }
  for (const grp of config.address_groups || []) {
    if (grp.name) addressNames.add(grp.name);
  }

  const serviceNames = new Set();
  for (const obj of config.service_objects || []) {
    if (obj.name) serviceNames.add(obj.name);
  }
  for (const grp of config.service_groups || []) {
    if (grp.name) serviceNames.add(grp.name);
  }

  const policies = config.security_policies || [];
  for (let i = 0; i < policies.length; i++) {
    const policy = policies[i];

    // Skip implicit policies
    if (policy._implicit) continue;

    const undefinedAddresses = [];
    const undefinedServices = [];

    // Check address references (src_addresses, dst_addresses)
    const srcAddresses = policy.src_addresses || [];
    const dstAddresses = policy.dst_addresses || [];
    const allAddresses = [...srcAddresses, ...dstAddresses];

    for (const addr of allAddresses) {
      if (!addr || typeof addr !== 'string') continue;

      // Defined if: 'any', literal IP, or in addressNames
      if (addr === 'any') continue;
      if (isLiteralAddress(addr)) continue;
      if (addressNames.has(addr)) continue;

      // Undefined reference — add if not already tracked
      if (!undefinedAddresses.includes(addr)) {
        undefinedAddresses.push(addr);
      }
    }

    // Check service references (services)
    const services = policy.services || [];
    for (const svc of services) {
      if (!svc || typeof svc !== 'string') continue;

      // Defined if: 'any', 'application-default', literal proto/port, or in serviceNames
      if (svc === 'any') continue;
      if (isLiteralService(svc)) continue;
      if (serviceNames.has(svc)) continue;

      // Undefined reference — add if not already tracked
      if (!undefinedServices.includes(svc)) {
        undefinedServices.push(svc);
      }
    }

    // Include policy in map only if it has at least one undefined reference
    if (undefinedAddresses.length > 0 || undefinedServices.length > 0) {
      issues.set(i, {
        addresses: undefinedAddresses,
        services: undefinedServices,
      });
    }
  }

  return issues;
}
