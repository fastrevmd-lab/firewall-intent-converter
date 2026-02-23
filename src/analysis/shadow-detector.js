/**
 * Rule Shadowing Detector
 * ========================
 *
 * Detects shadowed security rules within zone-pair groups.
 * A rule is "shadowed" when an earlier rule in the same zone-pair
 * matches all the same traffic, making the later rule unreachable.
 *
 * Detection cases:
 *   1. Full shadow: earlier rule matches any/any/any
 *   2. Exact match: identical src, dst, and service criteria
 *   3. Any-superset: earlier rule uses "any" where later has specifics
 *   4. Disabled shadow: disabled rule that WOULD shadow if enabled
 */

import { createWarning } from '../parsers/parser-utils.js';

/**
 * Detects shadowed rules within zone-pair groups.
 *
 * @param {Array} policies - security_policies from intermediate config
 * @param {Array} warnings - mutable array to push warnings into
 * @returns {{ shadowedCount: number }}
 */
export function detectShadowedRules(policies, warnings) {
  if (!policies || policies.length === 0) return { shadowedCount: 0 };

  let shadowedCount = 0;

  // Group by zone pair (mirrors SRX converter logic)
  const zonePairs = {};
  for (const policy of policies) {
    const srcZones = policy.src_zones.length > 0 ? policy.src_zones : ['any'];
    const dstZones = policy.dst_zones.length > 0 ? policy.dst_zones : ['any'];

    for (const src of srcZones) {
      for (const dst of dstZones) {
        const key = `${src} -> ${dst}`;
        if (!zonePairs[key]) zonePairs[key] = [];
        zonePairs[key].push(policy);
      }
    }
  }

  for (const [zonePair, rules] of Object.entries(zonePairs)) {
    for (let i = 1; i < rules.length; i++) {
      const laterRule = rules[i];
      // Don't warn about implicit rules being shadowed — they're expected at the end
      if (laterRule._implicit) continue;

      for (let j = 0; j < i; j++) {
        const earlierRule = rules[j];

        const shadowType = checkShadow(earlierRule, laterRule);
        if (!shadowType) continue;

        const isEarlierDisabled = earlierRule.disabled;
        const disabledNote = isEarlierDisabled ? ' (currently disabled)' : '';

        const w = createWarning(
          'warning',
          `policy/${laterRule.name}`,
          `Rule "${laterRule.name}" (#${laterRule._rule_index}) is ${shadowType} by earlier rule "${earlierRule.name}" (#${earlierRule._rule_index})${disabledNote} in zone-pair [${zonePair}]`,
          isEarlierDisabled
            ? 'The earlier rule is disabled — if enabled, it would shadow this rule'
            : 'The later rule will never match traffic — consider reordering or removing it'
        );

        warnings.push(w);
        shadowedCount++;
        break; // Only report the first (earliest) shadow per rule
      }
    }
  }

  return { shadowedCount };
}

/**
 * Check if earlierRule shadows laterRule.
 * Returns a description string if shadowed, null if not.
 */
function checkShadow(earlier, later) {
  // Case 1: Full any/any/any shadow
  if (isAnyMatch(earlier)) {
    return 'fully shadowed (any/any/any match-all)';
  }

  // Case 2: Exact match — identical criteria
  if (arraysMatchUnordered(earlier.src_addresses, later.src_addresses) &&
      arraysMatchUnordered(earlier.dst_addresses, later.dst_addresses) &&
      servicesMatch(earlier, later)) {
    return 'exactly shadowed (identical match criteria)';
  }

  // Case 3: Superset by "any" in one or more address dimensions
  if (isSupersetByAny(earlier, later)) {
    return 'shadowed (earlier rule uses broader match criteria)';
  }

  return null;
}

function isAnyMatch(rule) {
  return isAnyAddresses(rule.src_addresses) &&
         isAnyAddresses(rule.dst_addresses) &&
         isAnyService(rule);
}

function isAnyAddresses(addrs) {
  if (!addrs || addrs.length === 0) return true;
  return addrs.length === 1 && (addrs[0] === 'any' || addrs[0] === 'all');
}

function isAnyService(rule) {
  const apps = rule.applications || [];
  const svcs = rule.services || [];
  if (apps.length === 1 && apps[0] === 'any') return true;
  if (svcs.length === 1 && (svcs[0] === 'any' || svcs[0] === 'ALL')) return true;
  if (apps.length === 0 && svcs.length === 0) return true;
  return false;
}

function arraysMatchUnordered(a, b) {
  if (!a || !b) return (!a || a.length === 0) && (!b || b.length === 0);
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function servicesMatch(earlier, later) {
  // If earlier has "any" services, it matches everything
  if (isAnyService(earlier)) return true;

  // Combine apps + services for comparison
  const earlierAll = [...(earlier.applications || []), ...(earlier.services || [])].filter(s => s !== 'application-default');
  const laterAll = [...(later.applications || []), ...(later.services || [])].filter(s => s !== 'application-default');
  return arraysMatchUnordered(earlierAll, laterAll);
}

function isSupersetByAny(earlier, later) {
  const earlierSrcAny = isAnyAddresses(earlier.src_addresses);
  const earlierDstAny = isAnyAddresses(earlier.dst_addresses);

  // Need at least one "any" dimension to be a superset
  if (!earlierSrcAny && !earlierDstAny) return false;

  // If both are any, that's Case 1 (already handled by isAnyMatch)
  if (earlierSrcAny && earlierDstAny) return false;

  // Check the non-any dimension matches exactly
  if (earlierSrcAny && !earlierDstAny) {
    if (!arraysMatchUnordered(earlier.dst_addresses, later.dst_addresses)) return false;
  } else if (!earlierSrcAny && earlierDstAny) {
    if (!arraysMatchUnordered(earlier.src_addresses, later.src_addresses)) return false;
  }

  // Services must also be a superset
  return servicesMatch(earlier, later);
}
