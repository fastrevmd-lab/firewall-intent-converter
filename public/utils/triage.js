/**
 * Triage bucket computation for policy rules.
 *
 * Assigns each rule to one of four buckets based on its conversion state:
 *   safe      — Clean conversion, no issues
 *   decision  — Has warnings or needs operator input
 *   unsupported — Contains unsupported feature mappings
 *   blocked   — References missing config objects (zones, interfaces, etc.)
 *
 * Priority: blocked > unsupported > decision > safe
 */

/** @type {Record<string, { label: string, icon: string, cssClass: string }>} */
export const TRIAGE_CONFIG = {
  safe:        { label: 'Safe',        icon: '✓', cssClass: 'triage-safe' },
  decision:    { label: 'Decision',    icon: '⚡', cssClass: 'triage-decision' },
  unsupported: { label: 'Unsupported', icon: '✕', cssClass: 'triage-unsupported' },
  blocked:     { label: 'Blocked',     icon: '⏸', cssClass: 'triage-blocked' },
};

/**
 * Computes the triage bucket for a single policy rule.
 * @param {Object} rule - A policy rule from intermediateConfig.security_policies
 * @param {Object} intermediateConfig - The full intermediate config
 * @returns {'safe'|'decision'|'unsupported'|'blocked'}
 */
export function computeTriageBucket(rule, intermediateConfig) {
  if (!rule) return 'safe';

  // Check for blocked — references missing zones or interfaces
  if (intermediateConfig) {
    const knownZones = new Set(
      (intermediateConfig.zones || []).map(z => typeof z === 'string' ? z : z.name)
    );
    // 'any' and 'global' are always valid zone references
    knownZones.add('any');
    knownZones.add('global');

    const srcZones = rule.source_zones || [];
    const dstZones = rule.destination_zones || [];
    const allZoneRefs = [...srcZones, ...dstZones];

    for (const zoneRef of allZoneRefs) {
      if (zoneRef && !knownZones.has(zoneRef)) {
        return 'blocked';
      }
    }
  }

  // Check for unsupported features
  const unsupported = rule._unsupported || rule._unsupported_features;
  if (unsupported) {
    if (Array.isArray(unsupported) && unsupported.length > 0) return 'unsupported';
    if (typeof unsupported === 'object' && Object.keys(unsupported).length > 0) return 'unsupported';
    if (typeof unsupported === 'boolean' && unsupported) return 'unsupported';
  }

  // Check for decision — warnings or interview required
  const warnings = rule._warnings || rule._conversion_warnings;
  if (warnings && Array.isArray(warnings) && warnings.length > 0) return 'decision';
  if (rule._interview_required) return 'decision';

  return 'safe';
}

/**
 * Computes triage counts for all policies.
 * @param {Array} policies - Array of policy rules
 * @param {Object} intermediateConfig - The full intermediate config
 * @returns {{ safe: number, decision: number, unsupported: number, blocked: number, accepted: number }}
 */
export function computeTriageCounts(policies, intermediateConfig) {
  const counts = { safe: 0, decision: 0, unsupported: 0, blocked: 0, accepted: 0 };
  if (!policies) return counts;

  for (const rule of policies) {
    if (rule._review_status === 'accepted') {
      counts.accepted++;
      continue;
    }
    const bucket = computeTriageBucket(rule, intermediateConfig);
    counts[bucket]++;
  }
  return counts;
}
