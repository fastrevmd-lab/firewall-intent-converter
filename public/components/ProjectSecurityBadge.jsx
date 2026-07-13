import React from 'react';

const BADGE_COPY = Object.freeze({
  sanitized: 'Sanitized — safe to share',
  'reversible-encrypted': 'Encrypted reversible — sensitive',
  'legacy-secret-bearing': 'Legacy secret-bearing — sensitive',
});

function isPopulatedSlot(slot) {
  return Boolean(
    typeof slot?.configText === 'string' && slot.configText.trim()
    || slot?.intermediateConfig !== null && slot?.intermediateConfig !== undefined,
  );
}

export function deriveWorkspaceSecurityMode(configState, mergeState) {
  if (mergeState?.mergeMode === true
      && Array.isArray(mergeState.configSlots)
      && mergeState.configSlots.some(slot => isPopulatedSlot(slot) && slot.isSanitized !== true)) {
    return 'unsanitized';
  }
  return configState?.projectSecurityMode || 'unsanitized';
}

export default function ProjectSecurityBadge({ mode }) {
  const safe = mode === 'sanitized';
  const copy = BADGE_COPY[mode] || 'Unsanitized or stale — sensitive';
  return (
    <div
      className={`project-security-badge project-security-badge--${safe ? 'safe' : 'danger'}`}
      role="status"
      aria-label={`Workspace security: ${copy}`}
    >
      {copy}
    </div>
  );
}
