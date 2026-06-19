# Promoted Workflow Stepper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the buried `renderPlatformBar()` tab-row with a prominent numbered chevron step-rail hoisted above the breadcrumb, and make Step 3 (Review w/LLM) an explicit landing instead of a silently-skipped step.

**Architecture:** A pure `computeWorkflowSteps()` maps app state → 6 step descriptors with a `status`. A new `WorkflowStepper.jsx` renders the chevron rail (+ the existing contextual SRX action cluster) and is placed in `app.jsx` above `<Breadcrumb/>`. A new `ReviewLanding.jsx` renders the Step-3 decision panel under a new `editTab==='review'` branch in `ContentRouter.jsx`; the Analysis apply handler lands there.

**Tech Stack:** React 18 + Vite, plain CSS in `public/styles/main.css`, vitest for the pure util test.

**Spec:** `docs/superpowers/specs/2026-06-19-promoted-workflow-stepper-design.md`

---

## File Structure

- `public/utils/workflow-steps.js` — NEW. Pure `computeWorkflowSteps(input)`; no React/DOM.
- `tests/workflow-steps.test.js` — NEW. Unit tests for the pure function.
- `public/components/layout/WorkflowStepper.jsx` — NEW. Chevron rail + contextual action cluster.
- `public/components/ReviewLanding.jsx` — NEW. Step-3 decision panel (AI + No-AI variants).
- `public/app.jsx` — MODIFY. Import + render `<WorkflowStepper/>` above `<Breadcrumb/>`.
- `public/components/layout/ContentRouter.jsx` — MODIFY. Delete `renderPlatformBar` (definition + all calls); add `editTab==='review'` branch; change Analysis `onApply` to land on `review`.
- `public/styles/main.css` — MODIFY. Add `.workflow-stepper` + `.review-landing` styles; remove dead `.platform-view-bar` rules.

---

## Task 1: Pure `computeWorkflowSteps` util + tests

**Files:**
- Create: `public/utils/workflow-steps.js`
- Test: `tests/workflow-steps.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/workflow-steps.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeWorkflowSteps } from '../public/utils/workflow-steps.js';

const base = {
  editTab: 'rules', platformView: 'panos', analysisCount: 0,
  hasTranslated: false, hasOutput: false, llmReviewedCount: 0,
  mergeMode: false, sourceLabel: 'From PA-440', targetLabel: 'to SRX1600',
};
const byId = (steps, id) => steps.find(s => s.id === id);

describe('computeWorkflowSteps', () => {
  it('returns six steps in order with the given labels', () => {
    const steps = computeWorkflowSteps(base);
    expect(steps.map(s => s.id)).toEqual(['source', 'analysis', 'review', 'srx', 'convert', 'day2']);
    expect(byId(steps, 'source').label).toBe('From PA-440');
    expect(byId(steps, 'srx').label).toBe('to SRX1600');
  });

  it('marks source current when on the source rules view', () => {
    const steps = computeWorkflowSteps(base);
    expect(byId(steps, 'source').status).toBe('current');
  });

  it('marks analysis current on the analysis tab and source done', () => {
    const steps = computeWorkflowSteps({ ...base, editTab: 'analysis' });
    expect(byId(steps, 'analysis').status).toBe('current');
    expect(byId(steps, 'source').status).toBe('done');
  });

  it('marks review available once analysis has run', () => {
    const steps = computeWorkflowSteps({ ...base, editTab: 'analysis', analysisCount: 12 });
    expect(byId(steps, 'review').status).toBe('available');
  });

  it('marks review current on the review tab', () => {
    const steps = computeWorkflowSteps({ ...base, editTab: 'review' });
    expect(byId(steps, 'review').status).toBe('current');
    expect(byId(steps, 'review').optional).toBe(true);
    expect(byId(steps, 'review').llm).toBe(true);
  });

  it('marks review done when policies were llm-reviewed', () => {
    const steps = computeWorkflowSteps({ ...base, editTab: 'rules', platformView: 'srx', llmReviewedCount: 3 });
    expect(byId(steps, 'review').status).toBe('done');
  });

  it('marks srx current on the SRX rules view', () => {
    const steps = computeWorkflowSteps({ ...base, platformView: 'srx' });
    expect(byId(steps, 'srx').status).toBe('current');
  });

  it('marks convert + srx done once output exists', () => {
    const steps = computeWorkflowSteps({ ...base, hasOutput: true });
    expect(byId(steps, 'convert').status).toBe('done');
    expect(byId(steps, 'srx').status).toBe('done');
  });

  it('uses the merge label for the convert step', () => {
    const steps = computeWorkflowSteps({ ...base, mergeMode: true });
    expect(byId(steps, 'convert').label).toBe('Merge & Convert');
  });

  it('marks day2 current on the day2ops tab and optional', () => {
    const steps = computeWorkflowSteps({ ...base, editTab: 'day2ops' });
    expect(byId(steps, 'day2').status).toBe('current');
    expect(byId(steps, 'day2').optional).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/workflow-steps.test.js`
Expected: FAIL — `computeWorkflowSteps` not found / module missing.

- [ ] **Step 3: Write the implementation**

Create `public/utils/workflow-steps.js`:

```js
/**
 * Pure mapping of app state to the six migration-workflow step descriptors.
 * No React/DOM — unit-testable in isolation.
 *
 * @param {object} input
 * @param {string} input.editTab - current UI edit tab
 * @param {string} input.platformView - 'panos' | 'srx'
 * @param {number} [input.analysisCount] - applied/available analysis finding count
 * @param {boolean} [input.hasTranslated] - SRX-translated policies exist
 * @param {boolean} [input.hasOutput] - SRX output has been generated
 * @param {number} [input.llmReviewedCount] - policies with _review_status === 'llm_reviewed'
 * @param {boolean} [input.mergeMode] - merge mode active
 * @param {string} input.sourceLabel - Step 1 label
 * @param {string} input.targetLabel - Step 4 label
 * @returns {Array<{id:string,num:number,label:string,sub:(string|null),optional:boolean,llm:boolean,status:('done'|'current'|'available'|'upcoming')}>}
 */
export function computeWorkflowSteps(input) {
  const {
    editTab, platformView,
    analysisCount = 0, hasTranslated = false, hasOutput = false,
    llmReviewedCount = 0, mergeMode = false,
    sourceLabel = 'Source', targetLabel = 'SRX',
  } = input;

  const sourceCurrent = platformView === 'panos' && editTab === 'rules';
  const srxCurrent = platformView === 'srx' && editTab === 'rules';
  const analysisDone = analysisCount > 0 || hasTranslated;

  return [
    {
      id: 'source', num: 1, label: sourceLabel, sub: 'edit source config',
      optional: false, llm: false,
      status: sourceCurrent ? 'current' : 'done',
    },
    {
      id: 'analysis', num: 2, label: 'Analysis', sub: 'of source config',
      optional: false, llm: false,
      status: editTab === 'analysis' ? 'current' : (analysisDone ? 'done' : 'upcoming'),
    },
    {
      id: 'review', num: 3, label: 'Review w/LLM', sub: null,
      optional: true, llm: true,
      status: editTab === 'review' ? 'current'
        : llmReviewedCount > 0 ? 'done'
        : (hasTranslated || analysisCount > 0) ? 'available'
        : 'upcoming',
    },
    {
      id: 'srx', num: 4, label: targetLabel, sub: 'edit proposed config',
      optional: false, llm: false,
      status: srxCurrent ? 'current' : (hasOutput ? 'done' : 'upcoming'),
    },
    {
      id: 'convert', num: 5, label: mergeMode ? 'Merge & Convert' : 'Convert & Export',
      sub: 'export / apply', optional: false, llm: false,
      status: editTab === 'output' ? 'current' : (hasOutput ? 'done' : 'upcoming'),
    },
    {
      id: 'day2', num: 6, label: 'Day 2 Ops', sub: null,
      optional: true, llm: false,
      status: editTab === 'day2ops' ? 'current' : 'upcoming',
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/workflow-steps.test.js`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add public/utils/workflow-steps.js tests/workflow-steps.test.js
git commit -m "feat(workflow): add pure computeWorkflowSteps step model + tests"
```

---

## Task 2: WorkflowStepper component + hoist above breadcrumb + remove platform bar

**Files:**
- Create: `public/components/layout/WorkflowStepper.jsx`
- Modify: `public/app.jsx` (import at the layout-imports block ~line 19; render before `<Breadcrumb/>` ~line 459)
- Modify: `public/components/layout/ContentRouter.jsx` (delete `renderPlatformBar` definition lines ~149-285 and every `{renderPlatformBar()}` call; remove now-unused `analysisCount` and `enforceLicense` locals)
- Modify: `public/styles/main.css` (add `.workflow-stepper` block; remove dead `.platform-view-bar` rules)

- [ ] **Step 1: Create the WorkflowStepper component**

Create `public/components/layout/WorkflowStepper.jsx`:

```jsx
import React, { useState } from 'react';
import { useConfigContext } from '../../contexts/ConfigContext.jsx';
import { useConversionContext } from '../../contexts/ConversionContext.jsx';
import { useUIContext, isDeterministicMode } from '../../contexts/UIContext.jsx';
import { useMergeContext } from '../../contexts/MergeContext.jsx';
import useConfig from '../../hooks/useConfig.js';
import useConversion from '../../hooks/useConversion.js';
import useLLM from '../../hooks/useLLM.js';
import { computeWorkflowSteps } from '../../utils/workflow-steps.js';

const VENDOR_DISPLAY = {
  panos: 'PAN-OS', srx: 'SRX', fortigate: 'FortiGate', cisco_asa: 'Cisco ASA',
  checkpoint: 'Check Point', sonicwall: 'SonicWall', huawei_usg: 'Huawei USG',
};

/**
 * WorkflowStepper — the promoted, numbered chevron rail for the migration workflow.
 * Renders the six step segments plus the contextual SRX action cluster (output
 * context select, Push to SRX, Validate, Enforce license). Hidden on the import
 * and batch tabs and before any config is loaded.
 * @returns {JSX.Element|null}
 */
export default function WorkflowStepper() {
  const { state: cfg } = useConfigContext();
  const { state: conv, dispatch: convDispatch } = useConversionContext();
  const { state: ui, dispatch: uiDispatch } = useUIContext();
  const { state: merge } = useMergeContext();

  const config = useConfig();
  const conversion = useConversion();
  const llm = useLLM();

  const {
    sourceVendor, sourceModel, targetModel, greenfieldMode,
    intermediateConfig, srxTranslatedPolicies,
  } = cfg;
  const { editTab, platformView, isLoading, isTranslating } = ui;
  const { mergeMode, configSlots, activeSlotIndex } = merge;
  const { srxOutput, validationFindings, targetContext } = conv;

  const [enforceLicense, setEnforceLicense] = useState(false);

  const isHealthCheck = sourceVendor === 'srx_healthcheck';
  const activeConfig = mergeMode
    ? configSlots[activeSlotIndex]?.intermediateConfig
    : intermediateConfig;

  // Visibility: same situations the old platform bar appeared in.
  if (!activeConfig && !greenfieldMode) return null;
  if (editTab === 'import' || editTab === 'batch') return null;

  const deterministic = isDeterministicMode(ui.llmRiskAcceptance);
  const localOnly = ui.llmRiskAcceptance === 'local-only';
  const analysisCount = activeConfig?._analysisFindings?.reduce((s, f) => s + f.count, 0) || 0;
  const policies = activeConfig?.security_policies || [];
  const llmReviewedCount = policies.filter(p => p._review_status === 'llm_reviewed').length;

  const sourceLabel = greenfieldMode ? 'From LLM Interview'
    : isHealthCheck ? 'Original Config'
    : `From ${sourceModel || VENDOR_DISPLAY[sourceVendor] || 'PAN-OS'}`;
  const targetLabel = isHealthCheck ? 'Best Practice Status' : `to ${targetModel || 'SRX'}`;

  const steps = computeWorkflowSteps({
    editTab, platformView, analysisCount,
    hasTranslated: !!srxTranslatedPolicies, hasOutput: !!srxOutput,
    llmReviewedCount, mergeMode, sourceLabel, targetLabel,
  });

  const hasPolicies = !!activeConfig?.security_policies?.length;

  const goSource = () => {
    uiDispatch({ type: 'SET_FIELD', field: 'platformView', value: 'panos' });
    uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'rules' });
  };
  const goAnalysis = () => {
    if (analysisCount > 0) uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'analysis' });
    else config.handleRunAnalysis();
  };
  const goReview = () => uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'review' });
  const goSrx = () => {
    uiDispatch({ type: 'SET_FIELD', field: 'platformView', value: 'srx' });
    uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'rules' });
  };
  const goConvert = () => (mergeMode ? conversion.handleMergeConvert('set') : conversion.handleConvertClick('set'));
  const goDay2 = () => uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'day2ops' });

  const HANDLERS = { source: goSource, analysis: goAnalysis, review: goReview, srx: goSrx, convert: goConvert, day2: goDay2 };
  const DISABLED = {
    analysis: isLoading || !hasPolicies,
    convert: isLoading || !hasPolicies,
    day2: !hasPolicies,
  };

  const segClass = (step) => {
    const cls = ['wf-seg'];
    if (step.status === 'done') cls.push('wf-done');
    else if (step.status === 'current') cls.push(step.llm && !deterministic ? 'wf-cur-llm' : 'wf-cur');
    else if (step.status === 'available') cls.push(step.llm && !deterministic ? 'wf-avail-llm' : 'wf-avail');
    else cls.push('wf-upnext');
    return cls.join(' ');
  };

  return (
    <div className="workflow-stepper">
      <div className="wf-rail">
        {steps.map((step) => (
          <button
            key={step.id}
            className={segClass(step)}
            onClick={HANDLERS[step.id]}
            disabled={!!DISABLED[step.id]}
            title={step.optional ? `${step.label} (optional)` : step.label}
          >
            <span className="wf-num">{step.status === 'done' ? '\u2713' : step.num}</span>
            <span className="wf-text">
              <span className="wf-lbl">{step.label}</span>
              {step.optional
                ? <span className="wf-opt">Optional</span>
                : step.sub && <span className="wf-sub">{step.sub}</span>}
            </span>
          </button>
        ))}
      </div>

      {platformView === 'srx' && (
        <div className="wf-actions">
          <select
            className="btn btn-secondary btn-sm"
            value={targetContext.type}
            onChange={(e) => convDispatch({ type: 'SET_FIELD', field: 'targetContext', value: { ...targetContext, type: e.target.value, name: e.target.value === 'none' ? '' : targetContext.name } })}
            style={{ maxWidth: 130 }}
          >
            <option value="none">Flat Config</option>
            <option value="logical-system">Logical System</option>
            <option value="tenant">Tenant</option>
          </select>
          {targetContext.type !== 'none' && (
            <input
              type="text"
              className="btn btn-secondary btn-sm"
              placeholder="Name..."
              value={targetContext.name}
              onChange={(e) => convDispatch({ type: 'SET_FIELD', field: 'targetContext', value: { ...targetContext, name: e.target.value } })}
              style={{ maxWidth: 100, textAlign: 'left' }}
            />
          )}
          {srxOutput && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => conversion.handleValidate(enforceLicense)}
                disabled={isLoading}
                title="Run post-conversion validation checks"
                style={{ color: 'var(--caution)' }}
              >
                Validate{validationFindings?.length > 0 ? ` (${validationFindings.length})` : ''}
              </button>
              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}
                title="When enabled, commands requiring a higher license tier are removed from the SRX output"
              >
                <input type="checkbox" checked={enforceLicense} onChange={(e) => setEnforceLicense(e.target.checked)} style={{ margin: 0 }} />
                Enforce license
              </label>
            </>
          )}
          <button
            className="btn btn-secondary btn-sm push-btn"
            onClick={() => {
              const bridgeSettings = localStorage.getItem('pyez-bridge-settings') || localStorage.getItem('mcp-settings');
              uiDispatch({ type: 'SHOW_MODAL', name: bridgeSettings ? 'pushModal' : 'settings', value: bridgeSettings ? undefined : 'mcp' });
            }}
            title="Push config to SRX device via PyEZ"
            disabled={!srxOutput}
          >Push to SRX</button>
        </div>
      )}
    </div>
  );
}
```

Note: `isTranslating` and `localOnly` are read for parity with the old bar's state sources; if your linter flags them as unused after this exact code, drop those two destructured names. Do not add new behavior for them.

- [ ] **Step 2: Add the stepper CSS**

In `public/styles/main.css`, add (near the existing `.platform-view-bar` rules):

```css
/* ── Promoted workflow stepper ─────────────────────────────── */
.workflow-stepper {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}
.wf-rail { display: flex; gap: 2px; flex: 1; min-width: 0; }
.wf-seg {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 12px 9px 24px;
  background: var(--bg-tertiary, #1a222b);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 50%, calc(100% - 13px) 100%, 0 100%, 13px 50%);
}
.wf-seg:first-child {
  padding-left: 12px;
  clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 50%, calc(100% - 13px) 100%, 0 100%);
}
.wf-seg:disabled { opacity: 0.4; cursor: not-allowed; }
.wf-num {
  width: 23px; height: 23px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
  background: #2a333d; color: var(--text-secondary);
}
.wf-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.wf-lbl { font-size: 12.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wf-sub { font-size: 10px; color: var(--text-muted); }
.wf-opt {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted); border: 1px solid var(--border-color);
  border-radius: 3px; padding: 1px 4px; align-self: flex-start; margin-top: 2px;
}

.wf-seg.wf-done { background: color-mix(in srgb, var(--juniper-green) 12%, transparent); }
.wf-seg.wf-done .wf-num { background: var(--juniper-green); color: #0f1419; }

.wf-seg.wf-cur { box-shadow: inset 0 0 0 1px var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.wf-seg.wf-cur .wf-num { background: var(--accent); color: #0f1419; }

.wf-seg.wf-cur-llm { box-shadow: inset 0 0 0 1px var(--llm-cloud); background: color-mix(in srgb, var(--llm-cloud) 14%, transparent); }
.wf-seg.wf-cur-llm .wf-num { background: var(--llm-cloud); color: #0f1419; }

.wf-seg.wf-avail-llm { box-shadow: inset 0 0 0 1px var(--llm-cloud); }
.wf-seg.wf-avail-llm .wf-opt { color: var(--llm-cloud); border-color: color-mix(in srgb, var(--llm-cloud) 45%, transparent); }

.wf-seg.wf-upnext { opacity: 0.55; }

.wf-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
```

- [ ] **Step 3: Render the stepper in app.jsx**

In `public/app.jsx`, add the import alongside the other layout imports (after the `Breadcrumb` import, ~line 19):

```jsx
import WorkflowStepper from './components/layout/WorkflowStepper.jsx';
```

Then in the `.app-center` block, render it immediately before `<Breadcrumb />` (~line 459):

```jsx
          <div className="app-center">
            <WorkflowStepper />
            <Breadcrumb />
```

- [ ] **Step 4: Remove the old platform bar from ContentRouter**

In `public/components/layout/ContentRouter.jsx`:
- Delete the entire `renderPlatformBar` definition (the `const renderPlatformBar = () => ( ... );` block, ~lines 154-285) and the two locals that only it used: `const [enforceLicense, setEnforceLicense] = useState(false);` (~line 147) and `const analysisCount = ...;` (~line 150). Keep `const detMode = ...;` and `const localOnly = ...;` (used elsewhere).
- Remove every `{renderPlatformBar()}` invocation from the tab branches (sanitized, rules, decryption, pbf, analysis, day2ops, dependency-graph, zones, objects, nat, routing, vpn, ha, screen, syslog, snmp, aaa, dhcp, qos, flow-monitoring, output, warnings, diff, checklist, report). After removal those wrapper `<div>`s simply render their body directly.
- Leave `useState` import in place (still used by `enforceLicense`? no — removed; only remove the `enforceLicense` line). If `useState` becomes unused in this file, drop it from the React import.

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: build succeeds, no unresolved imports.

Manually (dev server): load a PAN-OS sample → the chevron rail appears above `Security / Policies`, numbered 1–6, Step 1 done / Step 2+ states correct; clicking segments navigates exactly as the old buttons did; on the SRX view the Flat Config select + Push to SRX (and Validate when output exists) appear at the right of the rail.

- [ ] **Step 6: Commit**

```bash
git add public/components/layout/WorkflowStepper.jsx public/app.jsx public/components/layout/ContentRouter.jsx public/styles/main.css
git commit -m "feat(workflow): promote workflow to numbered chevron stepper above breadcrumb"
```

---

## Task 3: ReviewLanding panel + review tab + Analysis lands on review

**Files:**
- Create: `public/components/ReviewLanding.jsx`
- Modify: `public/components/layout/ContentRouter.jsx` (add `editTab==='review'` branch; change Analysis `onApply`)
- Modify: `public/styles/main.css` (add `.review-landing` styles)

- [ ] **Step 1: Create the ReviewLanding component**

Create `public/components/ReviewLanding.jsx`:

```jsx
import React from 'react';

/**
 * ReviewLanding — Step-3 decision panel shown after Analysis is applied.
 * AI-enabled: offers "Review with LLM" or "Skip to SRX edit".
 * No-AI: LLM action disabled + struck through, with a subtle link to enable AI,
 * plus "Continue to SRX edit".
 *
 * @param {object} props
 * @param {number} props.findingsCount - applied analysis finding count
 * @param {boolean} props.deterministic - No-AI mode
 * @param {boolean} props.localOnly - local-only LLM mode (affects accent)
 * @param {() => void} props.onReview - run the LLM review
 * @param {() => void} props.onSkip - advance to SRX edit
 * @param {() => void} props.onEnableAI - open the AI mode chooser
 * @returns {JSX.Element}
 */
export default function ReviewLanding({ findingsCount, deterministic, localOnly, onReview, onSkip, onEnableAI }) {
  const reviewClass = `btn btn-translate${localOnly ? ' llm-local' : ''}`;
  return (
    <div className="review-landing">
      {deterministic && <div className="review-landing-tag">NO-AI MODE</div>}
      <h3>Analysis complete{findingsCount > 0 ? ` \u2014 ${findingsCount} findings applied` : ''}</h3>
      <p>
        {deterministic
          ? 'LLM review is turned off in this mode. Continue to editing the SRX config.'
          : 'Optionally run an LLM review of the proposed policies, or skip straight to editing the SRX config.'}
      </p>
      <div className="review-landing-actions">
        {deterministic ? (
          <>
            <div className="review-landing-llm-group">
              <button className="btn review-llm-off" disabled>Review with LLM</button>
              <span className="review-enable-link" role="button" tabIndex={0}
                onClick={onEnableAI}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEnableAI(); }}
              >Enable AI in Settings &rarr;</span>
            </div>
            <button className="btn btn-primary" onClick={onSkip}>Continue to SRX edit &rarr;</button>
          </>
        ) : (
          <>
            <button className={reviewClass} onClick={onReview}>Review with LLM</button>
            <button className="btn btn-secondary" onClick={onSkip}>Skip to SRX edit &rarr;</button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the review-landing CSS**

In `public/styles/main.css`, add:

```css
/* ── Step-3 review landing ─────────────────────────────────── */
.review-landing {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 40px 16px; gap: 4px;
}
.review-landing h3 { margin: 0 0 2px; color: var(--text-primary); }
.review-landing p { margin: 0 0 20px; font-size: 12px; color: var(--text-muted); max-width: 460px; }
.review-landing-tag {
  font-size: 10px; font-weight: 700; color: var(--juniper-green);
  border: 1px solid color-mix(in srgb, var(--juniper-green) 35%, transparent);
  background: color-mix(in srgb, var(--juniper-green) 12%, transparent);
  border-radius: 4px; padding: 2px 7px; margin-bottom: 12px;
}
.review-landing-actions { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; justify-content: center; }
.review-landing-llm-group { display: flex; flex-direction: column; align-items: center; gap: 7px; }
.review-llm-off {
  background: color-mix(in srgb, var(--llm-cloud) 10%, transparent);
  color: var(--text-muted);
  border: 1px dashed color-mix(in srgb, var(--llm-cloud) 40%, transparent);
  text-decoration: line-through; cursor: not-allowed;
}
.review-enable-link {
  font-size: 11px; color: var(--text-secondary);
  text-decoration: underline; text-underline-offset: 2px; cursor: pointer;
}
.review-enable-link:hover { color: var(--llm-cloud); }
```

- [ ] **Step 3: Wire the review branch + change Analysis onApply in ContentRouter**

In `public/components/layout/ContentRouter.jsx`:

Add the lazy import near the other lazy editor imports (top of file):

```jsx
const ReviewLanding = React.lazy(() => import('../ReviewLanding.jsx'));
```

Add a new branch (place it right after the `if (editTab === 'analysis') { ... }` block):

```jsx
  if (editTab === 'review') {
    const reviewFindingsCount = activeConfig?._analysisFindings?.reduce((s, f) => s + f.count, 0) || 0;
    return (
      <div className="center-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Suspense fallback={<LoadingTab />}>
          <ReviewLanding
            findingsCount={reviewFindingsCount}
            deterministic={detMode}
            localOnly={localOnly}
            onReview={llm.handleTranslateWithLLM}
            onSkip={() => {
              uiDispatch({ type: 'SET_FIELD', field: 'platformView', value: 'srx' });
              uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'rules' });
            }}
            onEnableAI={() => uiDispatch({ type: 'SET_LLM_RISK_ACCEPTANCE', value: null })}
          />
        </Suspense>
      </div>
    );
  }
```

In the `editTab === 'analysis'` branch's `<AnalysisPanel onApply={...}>`, change the post-apply navigation. Replace these two lines:

```jsx
                uiDispatch({ type: 'SET_FIELD', field: 'platformView', value: 'srx' });
                uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'rules' });
```

with:

```jsx
                uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'review' });
```

Keep the preceding `SET_TRANSLATED_POLICIES` dispatch unchanged (so the SRX view has policies ready when the user proceeds).

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: build succeeds.

Manually: parse a sample → run Analysis → Apply → lands on Step 3 (rail shows Review w/LLM current) with the content panel. AI mode shows Review/Skip; toggle No-AI (overflow menu → No AI) then re-run → shows disabled struck-through Review, subtle "Enable AI in Settings →" link, and "Continue to SRX edit →". Verify the enable link re-opens the mode chooser.

- [ ] **Step 5: Commit**

```bash
git add public/components/ReviewLanding.jsx public/components/layout/ContentRouter.jsx public/styles/main.css
git commit -m "feat(workflow): land on explicit Step 3 review decision after analysis"
```

---

## Final verification

- [ ] `npx vitest run tests/workflow-steps.test.js` passes.
- [ ] `npm run build` succeeds.
- [ ] Manual: rail sits above breadcrumb on all editor tabs; hidden on Import; numbered 1–6; states (done/current/optional/upcoming) render with correct colors (violet only on the LLM step in AI mode, juniper green for done + target, teal for current).
- [ ] Analysis → Apply lands on Step 3; Review and Skip both work; No-AI variant correct.
- [ ] Contextual SRX controls (Flat Config select, Push to SRX, Validate, Enforce license) work as before from the rail's right cluster.
