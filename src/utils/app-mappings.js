/**
 * App Mappings — Multi-vendor L7 application mapping table.
 *
 * Adapted from fatcat/converter's app-mappings.json data file.
 * Provides bidirectional lookup: vendorApp → junosApp and vendorApp → canonical.
 */

// Our vendor IDs → fatcat vendor keys
const VENDOR_KEY_MAP = {
  panos: 'panos',
  fortigate: 'fortios',
  cisco_asa: 'ftd',
  srx: 'junos',
  checkpoint: null,
  sonicwall: null,
  huawei_usg: null,
};

let _appData = null;
let _vendorIndex = null; // Map<ourVendor, Map<vendorAppNameLower, entry>>

function _buildIndex() {
  _vendorIndex = {};
  for (const [ourVendor, fatcatKey] of Object.entries(VENDOR_KEY_MAP)) {
    if (!fatcatKey) continue;
    const map = new Map();
    for (const app of _appData.apps) {
      const vendorEntry = app.vendors[fatcatKey];
      if (vendorEntry) {
        map.set(vendorEntry.name.toLowerCase(), app);
      }
    }
    _vendorIndex[ourVendor] = map;
  }
}

/**
 * Loads and indexes the app-mappings.json file.
 * Called lazily on first use. Caches the result.
 */
export async function loadAppMappings() {
  if (_appData) return _appData;
  const mod = await import('../data/app-mappings.json');
  _appData = mod.default || mod;
  _buildIndex();
  return _appData;
}

/**
 * Converts fatcat's "junos:HTTPS" format to our "junos-https" style.
 */
function normalizeJunosName(name) {
  if (!name) return name;
  if (name.startsWith('junos:')) {
    return 'junos-' + name.slice(6).toLowerCase();
  }
  return name;
}

/**
 * Maps a vendor-specific application name to a Junos application name.
 *
 * @param {string} vendorAppName - The app name from the source config
 * @param {string} sourceVendor - Our vendor ID (panos, fortigate, cisco_asa, etc.)
 * @returns {{ junosApp: string, confidence: number, canonical: string, category: string } | null}
 */
export function mapVendorApp(vendorAppName, sourceVendor) {
  if (!vendorAppName || !_vendorIndex) return null;
  const index = _vendorIndex[sourceVendor];
  if (!index) return null;

  const entry = index.get(vendorAppName.toLowerCase());
  if (!entry) return null;

  const junosEntry = entry.vendors.junos;
  if (!junosEntry) return null;

  return {
    junosApp: normalizeJunosName(junosEntry.name),
    confidence: junosEntry.confidence,
    canonical: entry.canonical,
    category: entry.category,
    description: entry.description,
    ports: entry.ports,
  };
}

/**
 * Gets the canonical app info for a vendor-specific app name.
 *
 * @param {string} vendorAppName - App name from source config
 * @param {string} sourceVendor - Our vendor ID
 * @returns {{ canonical: string, ports: string[], category: string, description: string } | null}
 */
export function getCanonicalApp(vendorAppName, sourceVendor) {
  if (!vendorAppName || !_vendorIndex) return null;
  const index = _vendorIndex[sourceVendor];
  if (!index) return null;

  const entry = index.get(vendorAppName.toLowerCase());
  if (!entry) return null;

  return {
    canonical: entry.canonical,
    ports: entry.ports,
    category: entry.category,
    description: entry.description,
    protocols: entry.protocols,
  };
}

/**
 * Returns the total number of mapped applications.
 */
export function getAppCount() {
  return _appData?.apps?.length || 0;
}

/**
 * Returns true if the app mappings have been loaded.
 */
export function isLoaded() {
  return _appData !== null;
}
