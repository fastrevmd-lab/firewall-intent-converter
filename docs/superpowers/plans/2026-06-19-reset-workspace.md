# Reset Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible TopBar Reset button that clears all in-memory firewall working data while preserving every localStorage-backed preference, gated by a save-first confirmation modal.

**Architecture:** Two pure reducers (Conversion, Merge) gain a `RESET` case (Config already has `RESET`, Undo already has `CLEAR`). A new `resetWorkspace()` in the `useProject` hook coordinates the multi-context reset, mirroring the existing `applyLoadedProject`. The UI surface is a TopBar icon button that opens a new inline `resetConfirm` modal in `app.jsx`, wired through the existing `MODAL_KEYS` / `SHOW_MODAL` / `HIDE_MODAL` machinery. No `localStorage` is ever touched, so settings survive.

**Tech Stack:** React 18 (context + `useReducer`), Vite, Vitest (pure-function tests only — no React Testing Library in this repo, do not add one).

---

## File Structure

- `public/contexts/ConversionContext.jsx` — add exported `RESET` reducer case.
- `public/contexts/MergeContext.jsx` — add exported `RESET` reducer case.
- `public/contexts/UIContext.jsx` — register `resetConfirm` modal (`showResetConfirm` field + `MODAL_KEYS` entry).
- `public/hooks/useProject.js` — wire `UndoContext`, add `resetWorkspace()`, export it.
- `public/app.jsx` — render the inline reset-confirm modal.
- `public/components/layout/TopBar.jsx` — add the Reset icon button + divider.
- `tests/context-reducers.test.js` — new vitest file covering the two `RESET` cases.

**Testing reality:** Conversion and Merge reducers are pure and their `initialState` does NOT read `localStorage`, so they import cleanly in vitest's node environment. `UIContext.jsx` reads `localStorage` at module load and would crash in node — so Tasks 3–6 (UI/hook wiring) are verified via a clean `npm run build` plus a manual smoke test, NOT unit tests.

---

### Task 1: Conversion reducer RESET case

**Files:**
- Modify: `public/contexts/ConversionContext.jsx` (export `conversionReducer` + `initialState`; add `RESET` case near `CLEAR_OUTPUT` at lines 42–49)
- Test: `tests/context-reducers.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/context-reducers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { conversionReducer, initialState as conversionInitial } from '../public/contexts/ConversionContext.jsx';

describe('conversionReducer RESET', () => {
  it('returns a clean initial state, discarding all output', () => {
    const dirty = {
      srxOutput: 'set security ...',
      convertWarnings: [{ msg: 'x' }],
      conversionSummary: { total: 5 },
      outputFormat: 'xml',
      targetContext: { type: 'logical-system', name: 'LS1' },
      validationFindings: [{ id: 1 }],
    };
    const next = conversionReducer(dirty, { type: 'RESET' });
    expect(next).toEqual(conversionInitial);
    expect(next).not.toBe(conversionInitial); // fresh object, not the shared ref
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/context-reducers.test.js`
Expected: FAIL — `conversionReducer` / `initialState` are not exported (import is `undefined`), or RESET returns the dirty state unchanged.

- [ ] **Step 3: Export the reducer + initialState and add the RESET case**

In `public/contexts/ConversionContext.jsx`:

Change line 12 from `const initialState = {` to:

```js
export const initialState = {
```

Change line 24 from `function conversionReducer(state, action) {` to:

```js
export function conversionReducer(state, action) {
```

Add this case immediately after the `CLEAR_OUTPUT` case (after line 49, before `LOAD_PROJECT`):

```js
    // Full reset to initial state (workspace reset — keeps no output)
    case 'RESET':
      return { ...initialState };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/context-reducers.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add public/contexts/ConversionContext.jsx tests/context-reducers.test.js
git commit -m "feat(conversion): add RESET reducer case for workspace reset"
```

---

### Task 2: Merge reducer RESET case

**Files:**
- Modify: `public/contexts/MergeContext.jsx` (export `mergeReducer` + `initialState`; add `RESET` case near the `LOAD_PROJECT` case at line 88)
- Test: `tests/context-reducers.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/context-reducers.test.js`:

```js
import { mergeReducer, initialState as mergeInitial } from '../public/contexts/MergeContext.jsx';

describe('mergeReducer RESET', () => {
  it('returns a clean initial state, discarding all merge slots', () => {
    const dirty = {
      mergeMode: true,
      configSlots: [{ id: 'a' }, { id: 'b' }],
      activeSlotIndex: 1,
      crossLsLinks: [{ from: 'a', to: 'b' }],
    };
    const next = mergeReducer(dirty, { type: 'RESET' });
    expect(next).toEqual(mergeInitial);
    expect(next).not.toBe(mergeInitial);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/context-reducers.test.js`
Expected: FAIL — `mergeReducer` / `initialState` not exported, or RESET returns dirty state.

- [ ] **Step 3: Export the reducer + initialState and add the RESET case**

In `public/contexts/MergeContext.jsx`:

Change line 11 from `const initialState = {` to:

```js
export const initialState = {
```

Change the `function mergeReducer(state, action) {` declaration to:

```js
export function mergeReducer(state, action) {
```

Add this case immediately before the `LOAD_PROJECT` case (at line 88):

```js
    // Full reset to initial state (workspace reset)
    case 'RESET':
      return { ...initialState };

```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/context-reducers.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add public/contexts/MergeContext.jsx tests/context-reducers.test.js
git commit -m "feat(merge): add RESET reducer case for workspace reset"
```

---

### Task 3: Register the resetConfirm modal in UIContext

**Files:**
- Modify: `public/contexts/UIContext.jsx` (`initialState` modal block ~lines 21–34; `MODAL_KEYS` lines 63–77)

No unit test — `UIContext.jsx` reads `localStorage` at module load and cannot be imported in vitest's node env. Verified by build in Task 7.

- [ ] **Step 1: Add the modal field to initialState**

In `public/contexts/UIContext.jsx`, inside the `// Modals / dialogs` group of `initialState` (after `showSaveModal: false,`), add:

```js
  showResetConfirm: false,
```

- [ ] **Step 2: Register the modal name in MODAL_KEYS**

In `MODAL_KEYS` (lines 63–77), add an entry after `saveModal: 'showSaveModal',`:

```js
  resetConfirm: 'showResetConfirm',
```

- [ ] **Step 3: Commit**

```bash
git add public/contexts/UIContext.jsx
git commit -m "feat(ui): register resetConfirm modal key"
```

---

### Task 4: Add resetWorkspace() to useProject

**Files:**
- Modify: `public/hooks/useProject.js` (imports line 8–14; hook context wiring lines 17–20; new callback before `generateName`; return object lines 200–205; header docstring line 6)

No unit test — the hook depends on React context providers and there is no RTL harness. Verified by build (Task 7) + manual smoke (Task 6).

- [ ] **Step 1: Import the Undo context hook**

In `public/hooks/useProject.js`, add after line 12 (`import { useMergeContext } ...`):

```js
import { useUndoContext } from '../contexts/UndoContext.jsx';
```

Also update the docstring on line 6 from:

```js
 * Uses ConfigContext, UIContext, ConversionContext, and MergeContext.
```

to:

```js
 * Uses ConfigContext, UIContext, ConversionContext, MergeContext, and UndoContext.
```

- [ ] **Step 2: Pull the Undo dispatch in the hook body**

After line 20 (`const { state: mergeState, dispatch: mergeDispatch } = useMergeContext();`), add:

```js
  const { dispatch: undoDispatch } = useUndoContext();
```

- [ ] **Step 3: Add the resetWorkspace callback**

Insert this block immediately before the `generateName` callback (before line 186's `// generateName` comment):

```js
  // -----------------------------------------------------------------------
  // resetWorkspace — clear all in-memory working data (config, conversion,
  //                  merge, undo) and transient UI state, while preserving
  //                  every localStorage-backed setting/preference. Mirrors
  //                  applyLoadedProject's multi-context coordination.
  // -----------------------------------------------------------------------
  const resetWorkspace = useCallback(() => {
    // Working-data contexts -> back to their initial states
    configDispatch({ type: 'RESET' });
    conversionDispatch({ type: 'RESET' });
    mergeDispatch({ type: 'RESET' });
    undoDispatch({ type: 'CLEAR' });

    // Transient UI state -> defaults (does NOT touch llmRiskAcceptance,
    // layout widths/collapse, or other settings-derived UI fields)
    uiDispatch({ type: 'SET_FIELD', field: 'editTab', value: 'import' });
    uiDispatch({ type: 'SET_FIELD', field: 'platformView', value: 'panos' });
    uiDispatch({ type: 'SET_FIELD', field: 'bottomTab', value: 'output' });
    uiDispatch({ type: 'SET_FIELD', field: 'selectedRule', value: null });
    uiDispatch({ type: 'SET_FIELD', field: 'isTranslating', value: false });
    uiDispatch({ type: 'SET_FIELD', field: 'translationError', value: null });
    uiDispatch({ type: 'SET_FIELD', field: 'translationProgress', value: null });
    uiDispatch({ type: 'SET_FIELD', field: 'groupingInProgress', value: false });
    uiDispatch({ type: 'CLEAR_ERROR' });
    uiDispatch({ type: 'SET_LOADING', isLoading: false });
    uiDispatch({ type: 'HIDE_MODAL', name: 'modelSelector' });
    uiDispatch({ type: 'HIDE_MODAL', name: 'interfaceMapper' });
    uiDispatch({ type: 'HIDE_MODAL', name: 'llmWarning' });
    uiDispatch({ type: 'HIDE_MODAL', name: 'resetConfirm' });
  }, [configDispatch, conversionDispatch, mergeDispatch, undoDispatch, uiDispatch]);

```

> Note: if `SET_LOADING` is not the action used elsewhere, match the existing loading pattern in `applyLoadedProject` (line ~174 uses `uiDispatch({ type: 'SET_LOADING', isLoading: false })`). Use the same action verbatim.

- [ ] **Step 4: Export resetWorkspace from the hook**

In the return object (lines 200–205), add `resetWorkspace,`:

```js
  return {
    handleSaveProject,
    handleLoadProjectFile,
    applyLoadedProject,
    resetWorkspace,
    generateName,
  };
```

- [ ] **Step 5: Commit**

```bash
git add public/hooks/useProject.js
git commit -m "feat(project): add resetWorkspace() coordinating a multi-context reset"
```

---

### Task 5: Render the inline reset-confirm modal in app.jsx

**Files:**
- Modify: `public/app.jsx` (add a new modal block next to the existing `showLoadConfirm` block at lines 641–673)

The `project` object (from `useProject()`) and `uiDispatch`/`ui` are already in scope in `app.jsx` (used by the existing load-confirm modal).

No unit test — verified by build (Task 7) + manual smoke (Task 6).

- [ ] **Step 1: Add the reset-confirm modal block**

In `public/app.jsx`, immediately after the closing of the `{/* Load project confirmation */}` block (after line 673), insert:

```jsx
      {/* Reset workspace confirmation */}
      {ui.showResetConfirm && (
        <div className="modal-overlay" onClick={() => uiDispatch({ type: 'HIDE_MODAL', name: 'resetConfirm' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
            <div className="modal-header">
              <h2>Reset Workspace</h2>
              <button className="modal-close" onClick={() => uiDispatch({ type: 'HIDE_MODAL', name: 'resetConfirm' })}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: 8 }}>
                This will clear the current config, conversion output, warnings, and undo history. This cannot be undone.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Your settings, LLM configuration, application mappings, theme, and layout are kept.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Save your work first if you want to keep it.
              </p>
            </div>
            <div className="modal-footer" style={{ gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => uiDispatch({ type: 'HIDE_MODAL', name: 'resetConfirm' })}
              >
                Cancel
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  uiDispatch({ type: 'HIDE_MODAL', name: 'resetConfirm' });
                  uiDispatch({ type: 'SHOW_MODAL', name: 'saveModal' });
                }}
              >
                Save now
              </button>
              <button
                className="btn btn-primary"
                onClick={() => project.resetWorkspace()}
              >
                Continue without saving
              </button>
            </div>
          </div>
        </div>
      )}
```

> `project.resetWorkspace()` already dispatches `HIDE_MODAL resetConfirm` internally, so the modal closes after the reset.

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, no import/JSX errors.

- [ ] **Step 3: Commit**

```bash
git add public/app.jsx
git commit -m "feat(app): inline reset-workspace confirmation modal"
```

---

### Task 6: Add the Reset button to the TopBar

**Files:**
- Modify: `public/components/layout/TopBar.jsx` (right action cluster — the `<div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', flexShrink: 0 }}>` block that currently holds Save / Load / Overflow)

`useProject` is the source of `resetWorkspace`, but the modal is opened with a plain `SHOW_MODAL` dispatch, so the button itself only needs `uiDispatch` (already obtained in `TopBar` as `uiDispatch`). No `useProject` import is required in TopBar.

No unit test — verified by build (Task 7) + manual smoke below.

- [ ] **Step 1: Add the Reset button + divider at the left edge of the right cluster**

In `public/components/layout/TopBar.jsx`, find the right action cluster opening div (`{/* Right: Save, Load, Overflow */}`) and insert, as the FIRST child inside that div (before the Save button), the Reset button followed by a divider:

```jsx
        {/* Reset workspace — app-driven destructive action: caution (orange), never violet */}
        <button
          className="settings-btn reset-btn"
          onClick={() => uiDispatch({ type: 'SHOW_MODAL', name: 'resetConfirm' })}
          title="Reset workspace"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
```

- [ ] **Step 2: Add the caution hover styling**

Locate the project stylesheet that defines `.settings-btn` (search: `grep -rn "settings-btn" static public --include=*.css` — likely `static/styles.css` or similar). Add a scoped hover rule for the reset button:

```css
.reset-btn:hover {
  color: var(--caution);
  border-color: var(--caution);
}
```

If `.settings-btn` already supplies a hover background, keep it; this rule only overrides the accent color so the Reset action reads as a caution (orange), consistent with the project color convention (app-driven changes use `--caution`, never violet).

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the app, then verify each:
- The Reset (↻) button is visible at the left of the Save/Load cluster, separated by a divider, with an orange accent on hover.
- Parse any config (or start a Greenfield interview) so there is working data and some output/warnings.
- Click Reset → the confirmation modal appears with the warning copy and three buttons.
- **Cancel** → modal closes, all data still present.
- **Save now** → reset modal closes, the Save modal opens; cancel it — data still present.
- **Continue without saving** → workspace clears, app lands on the Import view, no page reload, and the app is immediately usable (parse a new config).
- Confirm settings survived: theme unchanged, LLM mode unchanged, sidebar width unchanged, any Application-Mapping overrides still present (the ⋮ menu dot indicator).

- [ ] **Step 5: Commit**

```bash
git add public/components/layout/TopBar.jsx static
git commit -m "feat(topbar): add visible Reset workspace button with caution styling"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run tests/`
Expected: all tests pass, including the new `tests/context-reducers.test.js` (2 tests).

- [ ] **Step 2: Clean production build**

Run: `npm run build`
Expected: succeeds with no import-path / ESM / JSX errors.

- [ ] **Step 3: Color-convention sanity check**

Confirm the Reset button uses `--caution` (orange) for its accent/hover and NOT `--llm-cloud`/violet — reset is an app-driven action, not LLM-driven (per project color convention).

- [ ] **Step 4: Final commit (if any stray changes)**

```bash
git add -A
git commit -m "chore: reset-workspace feature verification" || echo "nothing to commit"
```
