import {
  JunosSerializationError,
  assertSafeScalar,
  setAddressOrPrefix,
  setEnum,
  setInteger,
  setPort,
} from './junos-serialization.js';

const POLICY_ACTIONS = [
  'allow',
  'permit',
  'accept',
  'deny',
  'reject',
  'drop',
  'discard',
  'reset-client',
  'reset-server',
  'reset-both',
];

function joinPath(parent, key) {
  if (typeof key === 'number') return `${parent}[${key}]`;
  return parent ? `${parent}.${key}` : key;
}

function walkScalars(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkScalars(item, joinPath(path, index)));
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => walkScalars(child, joinPath(path, key)));
    return;
  }
  if (value !== null && value !== undefined) assertSafeScalar(value, path);
}

function validateDnsName(value, fieldPath) {
  const text = assertSafeScalar(value, fieldPath);
  const withoutWildcard = text.startsWith('*.') ? text.slice(2) : text;
  if (withoutWildcard.length < 1 || withoutWildcard.length > 253) {
    throw new JunosSerializationError(fieldPath, 'DNS name', 'expected a DNS name up to 253 characters');
  }
  const labels = withoutWildcard.split('.');
  if (labels.some(label => (
    label.length < 1
    || label.length > 63
    || !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)
  ))) {
    throw new JunosSerializationError(fieldPath, 'DNS name', 'expected valid DNS labels');
  }
}

function validateAddressRange(value, fieldPath) {
  const text = assertSafeScalar(value, fieldPath);
  const separator = text.indexOf('-');
  if (separator < 1 || separator !== text.lastIndexOf('-')) {
    throw new JunosSerializationError(fieldPath, 'address range', 'expected two IP addresses separated by one hyphen');
  }
  setAddressOrPrefix(text.slice(0, separator), fieldPath);
  setAddressOrPrefix(text.slice(separator + 1), fieldPath);
}

function validatePortExpression(value, fieldPath) {
  const text = assertSafeScalar(value, fieldPath);
  if (text === '' || text === 'any') return;

  for (const item of text.split(',')) {
    const part = item.trim();
    if (!part) {
      throw new JunosSerializationError(fieldPath, 'port', 'expected ports or inclusive port ranges');
    }
    const range = part.split('-');
    if (range.length === 1) {
      setPort(range[0], fieldPath);
    } else if (range.length === 2) {
      setPort(range[0], fieldPath);
      setPort(range[1], fieldPath);
      if (Number(range[0]) > Number(range[1])) {
        throw new JunosSerializationError(fieldPath, 'port', 'range start must not exceed range end');
      }
    } else {
      throw new JunosSerializationError(fieldPath, 'port', 'expected ports or inclusive port ranges');
    }
  }
}

function addressValue(object) {
  const fields = ['value', 'ip', 'network', 'subnet', 'address'];
  const key = fields.find(candidate => object[candidate] !== undefined && object[candidate] !== '');
  return key ? { key, value: object[key] } : null;
}

function validateAddressObjects(objects, basePath) {
  if (!Array.isArray(objects)) return;
  objects.forEach((object, index) => {
    if (!object || typeof object !== 'object') return;
    const located = addressValue(object);
    if (!located) return;
    const fieldPath = `${basePath}[${index}].${located.key}`;

    if (['host', 'subnet', 'network', 'ip-netmask', 'ip-prefix'].includes(object.type)) {
      setAddressOrPrefix(located.value, fieldPath);
    } else if (object.type === 'range') {
      validateAddressRange(located.value, fieldPath);
    } else if (object.type === 'fqdn') {
      validateDnsName(located.value, fieldPath);
    }
  });
}

function validatePolicies(policies, basePath) {
  if (!Array.isArray(policies)) return;
  policies.forEach((policy, index) => {
    if (policy?.action !== undefined && policy.action !== '') {
      setEnum(
        String(policy.action).toLowerCase(),
        POLICY_ACTIONS,
        `${basePath}[${index}].action`,
      );
    }
  });
}

function validateServicePorts(services, basePath) {
  if (!Array.isArray(services)) return;
  services.forEach((service, index) => {
    if (!service || typeof service !== 'object') return;
    for (const key of ['port', 'port_range', 'source_port', 'src_port', 'dst_port']) {
      if (service[key] !== undefined && service[key] !== null) {
        validatePortExpression(service[key], `${basePath}[${index}].${key}`);
      }
    }
  });
}

function validateStaticRoutes(routes, basePath) {
  if (!Array.isArray(routes)) return;
  routes.forEach((route, index) => {
    if (!route || typeof route !== 'object') return;
    if (route.destination) setAddressOrPrefix(route.destination, `${basePath}[${index}].destination`);
    if (route.next_hop && route.next_hop_type !== 'next-vr' && route.next_hop_type !== 'discard') {
      setAddressOrPrefix(route.next_hop, `${basePath}[${index}].next_hop`);
    }
    if (route.metric !== undefined && route.metric !== null && route.metric !== '') {
      setInteger(route.metric, { min: 0, max: 4294967295 }, `${basePath}[${index}].metric`);
    }
  });
}

function validateNumericDomains(config, prefix) {
  const visit = (value, path, key) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, joinPath(path, index), key));
      return;
    }
    if (value !== null && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, child]) => (
        visit(child, joinPath(path, childKey), childKey)
      ));
      return;
    }
    if (value === null || value === undefined || value === '') return;
    if (key === 'vlan_id') setInteger(value, { min: 1, max: 4094 }, path);
    if (key === 'vni') setInteger(value, { min: 1, max: 16777215 }, path);
    if (['local_as', 'peer_as', 'asn'].includes(key)) {
      setInteger(value, { min: 1, max: 4294967295 }, path);
    }
  };
  visit(config, prefix, '');
}

/** Validate security-relevant domains without changing the intermediate object. */
export function validateJunosInput(config, rootPath = 'config') {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError(`${rootPath} must be an object`);
  }

  const prefix = rootPath === 'config' ? '' : rootPath;
  walkScalars(config, prefix);
  validateAddressObjects(config.address_objects, joinPath(prefix, 'address_objects'));
  validatePolicies(config.security_policies, joinPath(prefix, 'security_policies'));
  validateServicePorts(config.service_objects, joinPath(prefix, 'service_objects'));
  validateServicePorts(config.applications, joinPath(prefix, 'applications'));
  validateStaticRoutes(config.static_routes, joinPath(prefix, 'static_routes'));
  validateNumericDomains(config, prefix);
  return config;
}
