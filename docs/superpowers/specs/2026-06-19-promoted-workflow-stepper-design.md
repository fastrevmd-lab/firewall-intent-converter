# Promoted Workflow Stepper — Design Spec

**Date:** 2026-06-19
**Status:** Approved (visual mockups locked via brainstorming visual companion)

## Goal

Promote the migration workflow (`from source → Analysis → Review w/LLM → to SRX → Convert → Day 2`) from a secondary tab-bar buried below the breadcrumb into a **prominent, numbered chevron step-rail at the top of the workspace**, and make the optional LLM-review step (Step 3) an explicit, never-silently-skipped decision point.

## Problem

Today the workflow lives in `renderPlatformBar()` inside `ContentRouter.jsx`. It:
- Renders **below** the `Security / Policies` breadcrumb, re-created inside every tab branch.
- Reads as a row of flat buttons, not as an ordered process — users don't perceive it as "the workflow."
- **Silently skips Step 3**: the Analysis tab's `onApply` handler jumps straight to `platformView='srx' / editTab='rules'` (Step 4), bypassing `Review w/LLM`. Users must manually navigate back to find it.

## Approved Visual Design

A full-width **chevron rail** (process-arrow segments) sitting **above** the breadcrumb, spanning the center workspace. Six numbered segments, each with a short action label and a descriptive sub-line:

| # | Label | Sub-line | Optional | LLM |
|---|-------|----------|----------|-----|
| 1 | From {source} | edit source config | — | — |
| 2 | Analysis | of source config | — | — |
| 3 | Review w/LLM | _Optional_ | yes | yes |
| 4 | to {target} | edit proposed config | — | — |
| 5 | Convert & Export | export / apply | — | — |
| 6 | Day 2 Ops | _Optional_ | yes | — |

**Step label variants (preserve existing logic):**
- Step 1 label: greenfield → `From LLM Interview`; healthcheck → `Original Config`; else `From {sourceModel || vendor display name}`.
- Step 4 label: healthcheck → `Best Practice Status`; else `to {targetModel || 'SRX'}` with the target name in juniper green.
- Step 5 label: merge mode → `Merge & Convert`; else `Convert & Export`.

**Segment states & colors (strict convention):**
- **Done** — juniper green (`--juniper-green #90C641`) filled number badge with ✓, faint green segment tint.
- **Current** — teal (`--accent #4dd0c8`) ring + filled teal badge.
- **Current (LLM step, AI enabled)** — violet (`--llm-cloud #a78bfa`) ring + violet badge (only Step 3 when AI is available).
- **Optional / available** — violet outline accent for Step 3 (LLM) when reachable but not current; neutral "Optional" tag for Step 6.
- **Up next** — dimmed (opacity ~0.55), neutral grey badge.
- Number badges show the step number; done badges show ✓.

The rail header reads `{source} → {target} · Migration workflow` (small uppercase muted label).

### Step 3 landing panel (the skip fix)

When Analysis findings are applied, navigation now lands on **Step 3 (`editTab='review'`)** as the current step instead of jumping to Step 4. The center content renders a compact decision panel:

**AI-enabled mode (cloud or local-only):**
- Heading: `Analysis complete — {N} findings applied`
- Body: `Optionally run an LLM review of the proposed policies, or skip straight to editing the SRX config.`
- Actions (row):
  - **Review with LLM** — primary, violet (local-only uses `--llm-local`). Runs `llm.handleTranslateWithLLM()`.
  - **Skip to SRX edit →** — secondary. Sets `platformView='srx'`, `editTab='rules'`.

**No-AI / deterministic mode:**
- A small green `NO-AI MODE` tag above the heading.
- Heading: `Analysis complete — {N} findings applied`
- Body: `LLM review is turned off in this mode. Continue to editing the SRX config.`
- Actions:
  - A vertical group: **Review with LLM** button **disabled, dashed border, strikethrough text**, with a **subtle underlined text link** directly beneath it: `Enable AI in Settings →` (hover turns violet). The link re-opens the AI mode chooser (dispatch `SET_LLM_RISK_ACCEPTANCE` → `null`, matching TopBar's existing "Change mode" behavior).
  - **Continue to SRX edit →** — primary teal. Sets `platformView='srx'`, `editTab='rules'`.

`{N}` = the applied analysis finding count (sum of `_analysisFindings[].count`).

## Architecture

**New files:**
- `public/components/layout/WorkflowStepper.jsx` — the chevron rail component. Reads `ConfigContext`/`ConversionContext`/`UIContext`/`MergeContext` and the `useConfig`/`useConversion`/`useLLM` hooks (same sources `renderPlatformBar` uses today). Renders the six segments plus the right-aligned contextual action cluster (see below). Calls the navigation/action handlers on segment click.
- `public/utils/workflow-steps.js` — a **pure** `computeWorkflowSteps(input)` function that maps app state to an array of step descriptors `{ id, num, label, sub, optional, llm, status }` where `status ∈ {'done','current','available','upcoming','disabled'}`. Pure + dependency-free so it is unit-testable without React.
- `public/components/ReviewLanding.jsx` — the Step-3 decision panel (both AI and No-AI variants).

**Modified files:**
- `public/app.jsx` — render `<WorkflowStepper />` inside `.app-center`, **above** `<Breadcrumb />`, gated on the same condition the platform bar used (a config is loaded / not on `import` or `batch` tabs).
- `public/components/layout/ContentRouter.jsx`:
  - Remove `renderPlatformBar()` and every `{renderPlatformBar()}` call from the tab branches (the rail is now hoisted to `app.jsx`).
  - Add a new `editTab === 'review'` branch that renders `<ReviewLanding />`.
  - Change the Analysis `onApply` handler: after applying findings and `SET_TRANSLATED_POLICIES`, set `editTab='review'` (instead of `platformView='srx'` + `editTab='rules'`).
- `public/styles/main.css` — add `.workflow-stepper` / `.wf-seg` / chevron `clip-path` / state modifier styles and `.review-landing` styles. Remove now-dead `.platform-view-bar` rules only if no longer referenced.

**Contextual action cluster (preserved):** The controls currently on the right of the platform bar — output `targetContext` select (Flat Config / Logical System / Tenant) + name input, **Push to SRX** (shown when `platformView==='srx'`), and **Validate** + **Enforce license** (shown when `srxOutput` exists) — move into a right-aligned cluster on the stepper row, keeping their existing visibility conditions and handlers. No behavior change to these controls.

### Step-state derivation (in `computeWorkflowSteps`)

Inputs: `{ hasConfig, editTab, platformView, analysisCount, hasTranslated, hasOutput, llmReviewedCount, deterministic, greenfieldMode, isHealthCheck, mergeMode, sourceLabel, targetLabel }`.

- **Step 1** `current` when `platformView==='panos' && editTab==='rules'`; else `done` when `hasConfig`.
- **Step 2** `current` when `editTab==='analysis'`; `done` when `analysisCount>0 || hasTranslated`; else `upcoming`.
- **Step 3** `current` when `editTab==='review'`; `done` when `llmReviewedCount>0`; `available` when `hasTranslated || analysisCount>0` (reachable optional); else `upcoming`. `llm:true`, `optional:true`.
- **Step 4** `current` when `platformView==='srx' && editTab==='rules'`; `done` when `hasOutput`; else `upcoming`.
- **Step 5** `current` when `editTab==='output'`; `done` when `hasOutput`; else `upcoming`.
- **Step 6** `current` when `editTab==='day2ops'`; else `upcoming`. `optional:true`.

`status` only affects styling; every reachable segment remains clickable (clicking navigates). The LLM violet treatment for Step 3 applies only when `!deterministic`.

### Segment click handlers (preserve existing semantics)

- **Step 1** → `platformView='panos'`, `editTab='rules'`.
- **Step 2** → if `analysisCount>0` set `editTab='analysis'`, else `config.handleRunAnalysis()`. Disabled while loading or with no policies (same as today).
- **Step 3** → `editTab='review'`.
- **Step 4** → `platformView='srx'`, `editTab='rules'`.
- **Step 5** → `mergeMode ? conversion.handleMergeConvert('set') : conversion.handleConvertClick('set')` (unchanged), then surface output.
- **Step 6** → `editTab='day2ops'`. Disabled with no policies (same as today).

## Testing

- **Unit (TDD):** `tests/workflow-steps.test.js` — exercises `computeWorkflowSteps` across scenarios: fresh parse (Step 1 current), analysis run (Step 2 done), review landing (Step 3 current), No-AI mode (Step 3 reachable, not violet), translated (Step 4 current), output produced (Step 5 done), greenfield/healthcheck/merge label variants. Pure function, no DOM.
- **Build gate:** `npm run build` succeeds.
- **Manual verification:** load a PAN-OS sample → confirm rail sits above breadcrumb, numbered 1–6; run Analysis → lands on Step 3 with Review/Skip; toggle No-AI mode → Step 3 shows disabled struck-through Review + subtle Enable-AI link + Continue; verify violet only appears for the LLM step in AI mode.

## Edge cases

- **Greenfield mode:** Step 1 label `From LLM Interview`; Step 3 landing still applies after analysis. (Greenfield+No-AI already shows its own empty state in `rules` — unchanged.)
- **Healthcheck mode:** Step 1 `Original Config`, Step 4 `Best Practice Status` labels preserved.
- **Merge mode:** Step 5 label `Merge & Convert`; `activeSlot` config drives `hasConfig`.
- **Import / batch tabs:** stepper hidden (matches current platform-bar absence on import).

## Color convention compliance

- Violet (`--llm-cloud`) / plum (`--llm-local`) used **only** for Step 3 (the LLM step) and its Review action.
- Juniper green for done steps and the SRX target name.
- Teal for current step and general navigation accents.
- Orange (`--caution`) retained for Day 2 Ops affordance where it exists today.
- No brand/semantic color bleed onto non-LLM steps.

## Out of scope

- No change to what Analysis, LLM translation, Convert, Validate, or Day 2 Ops actually do.
- No change to the left NavTree.
- No change to the contextual SRX action controls beyond relocating them onto the stepper row.
