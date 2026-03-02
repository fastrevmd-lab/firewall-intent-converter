# Deterministic Mode — No-AI Conversion + Analysis Engine

## Major Credit

**Analysis Engine and Application Mapping logic adapted from [fatcat/converter](https://github.com/fatcat/converter)** — a deterministic, LLM-free firewall migration tool by fatcat. Their work on the 236-entry multi-vendor application mapping table (`app-mappings.json`) and the 7-category analysis engine (`analysis-engine.js`) forms the foundation of this feature. Used with permission.

---

## Context

A friend's open-source converter does firewall migration deterministically — no LLMs, pure mapping tables and algorithms. Two goals:

1. **Deterministic Mode**: Users who can't accept LLM risk get a toggle to disable ALL AI features and use built-in logic instead
2. **Improve Both Modes**: Borrow fatcat's app-mapping table and analysis engine to enhance the existing LLM workflow too

Our app already has a working Parse -> Convert pipeline without LLM — the LLM `translatePolicies()` step is optional. What's missing for a good no-LLM experience: smart app mapping, pre-conversion analysis, and deterministic translation intelligence.

### What to extract from fatcat (read-only, no pushes)
- **`data/app-mappings.json`** — 236 canonical L7 apps with per-vendor names + confidence scores (0.0-1.0). Maps PAN-OS "ssl" -> canonical "https" -> Junos "junos-https". This replaces/enhances our hand-maintained `APP_MAP` in `parser-utils.js`.
- **`js/analysis-engine.js`** — 7 finding categories: unused objects, shadowed policies, duplicates, disabled policies, logging off, overly permissive, empty groups. Port to our schema.

### What NOT to take
- Fatcat's parsers (4 vendors, less feature coverage than our 7)
- Fatcat's renderers (our `srx-converter.js` is far more comprehensive)
- Fatcat's Vue UI / wizard flow (incompatible with our React architecture)
- Fatcat's device database / report generator (nice-to-have later, not needed now)

---

## Phase 1 — App Mappings Integration (improves BOTH modes)

### 1A. Copy `data/app-mappings.json` into project

Copy fatcat's `data/app-mappings.json` -> `src/data/app-mappings.json` (placing in `src/` for Vite module resolution). 236 entries, ~3K lines, pure data.

### 1B. Create `src/utils/app-mappings.js` (~80 lines)

Adapter module with vendor-key mapping (fatcat uses `fortios`/`ftd`/`junos`, we use `fortigate`/`cisco_asa`/`srx`):

```
VENDOR_KEY_MAP = { panos->panos, fortigate->fortios, cisco_asa->ftd, srx->junos }
```

Exports:
- `loadAppMappings()` — async, loads JSON, builds per-vendor index (Map of lowercase vendorAppName -> entry)
- `mapVendorApp(vendorAppName, sourceVendor)` -> `{ junosApp, confidence, canonical, category }` or null
- `getCanonicalApp(vendorAppName, sourceVendor)` -> `{ canonical, ports, category }` or null

Handles fatcat's `junos:HTTPS` format -> our `junos-https` format conversion.

### 1C. Enhance `mapAppToJunos()` in `src/parsers/parser-utils.js`

- Import `mapVendorApp` from app-mappings module
- Add optional `sourceVendor` param to `mapAppToJunos(appName, sourceVendor)`
- Try `mapVendorApp()` first (if loaded, confidence >= 0.8) -> fall back to existing `APP_MAP`
- Backward-compatible: works without `loadAppMappings()` having been called

### 1D. Thread `sourceVendor` through converter

- `src/converters/srx-converter.js` — `resolveApplications()` already receives `sourceVendor`; pass it to `mapAppToJunos()` calls (~line 1230, 1278)
- `public/utils/engine.js` — in `convertConfig()`, preload app mappings before calling converter: `await loadAppMappings()`

---

## Phase 2 — Analysis Engine (improves BOTH modes)

### 2A. Create `src/analysis/config-analyzer.js` (~250 lines)

Port of fatcat's analysis engine adapted to **our** intermediate config schema. Key field mappings:

| Fatcat IR | Our Schema | Adaptation |
|-----------|-----------|------------|
| `p.src_zone` (string) | `p.src_zones` (array) | Array handling |
| `p.dst_zone` (string) | `p.dst_zones` (array) | Array handling |
| `p.src_addr` | `p.src_addresses` | Rename |
| `p.dst_addr` | `p.dst_addresses` | Rename |
| `p.service` | `p.services` | Rename |
| `p.enabled` (bool) | `p.disabled` (bool) | Invert |
| `p.log` | `p.log_end` | Rename |

**`AnalysisEngine.run(config, onProgress)`** -> `Promise<finding[]>`, 7 checks:
1. `_markUsed(config)` — cascade-mark address/service objects referenced by policies and NAT rules
2. `_unusedObjects()` — objects with `_used === false`
3. `_shadowedPolicies()` — later rules fully covered by earlier broader rules (adapted for array zones)
4. `_duplicateObjects()` — identical type+value address objects or protocol+ports service objects
5. `_disabledPolicies()` — `p.disabled === true`
6. `_loggingOff()` — enabled policies where `!log_end && !log_start`
7. `_permissivePolicies()` — allow rules with any/any src/dst
8. `_emptyGroups()` — groups with 0 members

Uses `_yield()` (setTimeout 0) between checks for UI responsiveness.

**`AnalysisApplicator.apply(config, findings)`** — mutates config based on user selections:
- Respects per-item `itemOverrides` over bulk `selected` action
- Filters unused objects, removes shadowed/disabled, consolidates duplicates, enables logging
- Sets `config._analysis_applied` timestamp

### 2B. Create `public/components/AnalysisPanel.jsx` (~200 lines)

Card-based UI following the SyslogEditor pattern:
- One collapsible card per finding category with count badge + severity indicator
- Each card has: description, bulk action dropdown (Keep All / Remove / Consolidate), per-item override toggles
- "Apply Analysis" button at bottom -> calls `AnalysisApplicator.apply()`
- Loading state with progress label from engine callbacks

### 2C. Wire into NavTree + ContentRouter

- `NavTree.jsx` — add `{ id: 'analysis', label: 'Analysis', countFn: (ic) => ic?._analysisFindings?.reduce((s,f) => s + f.count, 0) || 0 }` under security group
- `ContentRouter.jsx` — lazy import `AnalysisPanel`, add route for `editTab === 'analysis'`

### 2D. Add `handleRunAnalysis` to `useConfig.js`

- Runs `AnalysisEngine.run()` on active intermediate config
- Stores findings as `config._analysisFindings`
- Switches to analysis tab
- Available in both LLM and deterministic modes

---

## Phase 3 — Conversion Mode Toggle

### 3A. Add `'deterministic'` to `llmRiskAcceptance` values

`public/contexts/UIContext.jsx`:
- Add helper exports: `isLLMEnabled(acceptance)` and `isDeterministicMode(acceptance)`
- No reducer changes needed — `SET_LLM_RISK_ACCEPTANCE` already accepts any string
- localStorage persistence already works

### 3B. Update `LLMRiskDisclaimer.jsx`

Add fourth option between "Accept Local Only" and "Reject":
- **"No AI Mode (Deterministic Only)"** button with `className="btn risk-btn-deterministic"`
- Info box explaining: "Disables ALL AI features. Uses built-in mapping tables and analysis algorithms. No data leaves your browser."
- Calls `onDeterministicMode` prop -> dispatches `SET_LLM_RISK_ACCEPTANCE` with `'deterministic'`

### 3C. Wire in `app.jsx`

- Pass `onDeterministicMode` to `LLMRiskDisclaimer`
- When `llmRiskAcceptance === 'deterministic'`, skip the `RejectedScreen` and proceed to main app (unlike `'rejected'` which blocks)

### 3D. Conditional rendering in `ContentRouter.jsx`

When `isDeterministicMode(ui.llmRiskAcceptance)`:
- **Hide**: "Translate with LLM" button, translation progress indicators
- **Show**: "Run Analysis" button in platform bar (next to Convert button)
- **SRX view without translation**: When no `srxTranslatedPolicies` exist, fall through to render the PolicyTable with source policies directly (instead of showing "Click Translate with LLM" empty state)
- **Greenfield mode**: Show notice "Greenfield mode requires AI. Use Import to paste an existing config."

### 3E. Conditional rendering in `RightPanel.jsx`

When deterministic:
- Hide `ReviewChatPanel` (LLM-powered review chat)
- InterviewPanel still renders (shows rule details, translation notes from deterministic mode)

### 3F. Conditional rendering in `TopBar.jsx`

When deterministic:
- Hide LLM Settings gear icon (or show reduced settings — just PyEZ Bridge if available)
- Show a "Deterministic Mode" indicator badge

---

## Phase 4 — Enhanced Deterministic Converter

### 4A. Auto-generate descriptive rule names

`src/converters/srx-converter.js` — new helper `generateDescriptiveName(policy, index)`:
- Only triggers when name is generic (`/^(rule|policy|permit|deny)[-_]?\d+$/i` or numeric-only)
- Pattern: `{action}-{srcZone}-to-{dstZone}-{primaryApp}` (e.g., `permit-trust-to-untrust-https-1`)
- Falls back to `sanitizeJunosName(original)` for non-generic names
- Used in `convertSecurityPolicies()` as the default name when no LLM translation happened

### 4B. Create `src/utils/profile-mappings.js` (~60 lines)

Deterministic security profile -> SRX mapping table:

| Vendor Profile | SRX Type | SRX Default | Note |
|---------------|----------|-------------|------|
| antivirus / av | utm anti-virus | junos-av-defaults | Requires A1+ |
| vulnerability-protection / ips | idp-policy | recommended | Requires A1+ |
| anti-spyware | idp-policy | recommended | Requires A1+ |
| url-filtering / webfilter | utm web-filtering | junos-wf-local-default | Requires A2+ |
| file-blocking | utm content-filtering | junos-cf-default | MIME-only, no true file-type |
| wildfire-analysis / sandbox | utm anti-virus | junos-av-defaults | No direct equivalent, note ATP Cloud |
| data-filtering / dlp | none | -- | No SRX equivalent, note ICAP |
| application-control | appfw | appfw-default | Requires A1+ |
| email-filter / anti-spam | utm anti-spam | junos-as-defaults | Requires A2+ |

Export: `mapProfileDeterministic(profileType, profileName)` -> `{ srxType, srxAction, srxProfileName, note }`

### 4C. Generate deterministic `_translation_notes`

`src/converters/srx-converter.js` — new `generateTranslationNotes(config, warnings)`:
- Scans for vendor-specific features with no SRX equivalent
- Notes unmapped applications (tracked via `config._unmappedApps`)
- Notes profile translations and required subscription tiers
- Outputs as comments in the set-command output

### 4D. Auto-apply logging best practices

In `convertSecurityPolicies()`, when `config._deterministicBestPractices` is set (deterministic mode only):
- Permit rules without any logging -> add `session-close` with comment
- Deny rules without any logging -> add `session-init` with comment
- Never enable both simultaneously

---

## Phase 5 — LLM Workflow Improvements

### 5A. Pre-filter unused objects before LLM translation

`public/hooks/useLLM.js` — in `handleTranslateWithLLM()`:
- Run `AnalysisEngine.run()` on the config copy
- Strip objects marked `_used === false` from the payload sent to LLM
- Log token savings estimate

### 5B. Include app mapping hints in LLM prompts

`public/utils/llm-client.js` — in `translatePolicies()`:
- For each app in the policy chunk, look up `mapVendorApp()` result
- Append unique hints to system prompt: `"App mapping hints: ssl -> junos-https (1.0), web-browsing -> junos-http (1.0)"`
- Gives LLM a deterministic starting point, reducing hallucination

### 5C. Surface analysis findings in LLM mode

`public/components/layout/RightPanel.jsx`:
- Add an "Analysis" tab/section that shows finding counts even when ReviewChatPanel is active
- Clicking findings navigates to the full AnalysisPanel

---

## CSS Additions

`public/styles/main.css`:
- `.analysis-panel` — container
- `.analysis-finding-card` — collapsible card (reuse `.syslog-card` pattern)
- `.analysis-finding-header` — count badge + severity
- `.analysis-item-list` — per-item toggles
- `.risk-btn-deterministic` — disclaimer button styling
- `.deterministic-badge` — TopBar mode indicator
- `.btn-analysis` — platform bar button

---

## Implementation Order

```
Phase 1 (App Mappings) --------+
                                +--> Phase 4 (Enhanced Converter)
Phase 2 (Analysis Engine) -----+
                                +--> Phase 5 (LLM Improvements)
Phase 3 (Mode Toggle) ---------+
```

Phase 1 and 2 are independent, do in parallel or sequence.
Phase 3 depends on both (needs analysis UI to fill the gap left by hiding LLM features).
Phases 4 and 5 layer on top.

---

## Files Summary

| File | Action | Changes |
|------|--------|---------|
| `src/data/app-mappings.json` | **Create** | Copy from fatcat (236 entries, ~3K lines) |
| `src/utils/app-mappings.js` | **Create** | Adapter module with vendor-key mapping + index |
| `src/utils/profile-mappings.js` | **Create** | Deterministic security profile -> SRX table |
| `src/analysis/config-analyzer.js` | **Create** | Ported analysis engine (7 checks) |
| `public/components/AnalysisPanel.jsx` | **Create** | Card-based analysis findings UI |
| `src/parsers/parser-utils.js` | Modify | Enhance `mapAppToJunos()` with app-mappings lookup |
| `src/converters/srx-converter.js` | Modify | Descriptive naming, profile mapping, translation notes, logging best-practices |
| `public/utils/engine.js` | Modify | Preload app mappings in `convertConfig()` |
| `public/contexts/UIContext.jsx` | Modify | Add `isLLMEnabled()` / `isDeterministicMode()` helpers |
| `public/components/LLMRiskDisclaimer.jsx` | Modify | Add "No AI Mode" option |
| `public/app.jsx` | Modify | Wire deterministic mode handler |
| `public/hooks/useConfig.js` | Modify | Add `handleRunAnalysis` |
| `public/hooks/useLLM.js` | Modify | Pre-filter unused objects, app mapping hints |
| `public/utils/llm-client.js` | Modify | Add app mapping hints to system prompt |
| `public/components/layout/ContentRouter.jsx` | Modify | Conditional LLM/deterministic rendering |
| `public/components/layout/RightPanel.jsx` | Modify | Hide ReviewChatPanel in deterministic mode |
| `public/components/layout/TopBar.jsx` | Modify | Hide LLM settings gear, show mode badge |
| `public/components/nav/NavTree.jsx` | Modify | Add Analysis nav item |
| `public/styles/main.css` | Modify | Analysis panel + deterministic mode styles |

---

## Verification

1. `npm run build` — clean compile after each phase
2. **App mappings**: Parse a PAN-OS config -> verify "ssl" maps to "junos-https" in converted output, "web-browsing" -> "junos-http"
3. **Analysis**: Parse any vendor config -> Run Analysis -> verify finding counts for unused objects, shadowed rules match expectations
4. **Analysis Apply**: Select "Remove Unused" -> verify objects stripped from intermediate config
5. **Mode toggle**: Select "No AI Mode" at startup -> verify all LLM buttons/panels hidden, Greenfield shows notice
6. **Deterministic conversion**: In no-AI mode, parse PAN-OS -> Convert -> verify SRX output has descriptive rule names, logging, profile comments
7. **LLM mode still works**: Select "Accept All" -> verify translate, review chat, greenfield all function as before
8. **LLM improvements**: Translate with LLM -> verify app mapping hints appear in prompt, unused objects stripped from payload
