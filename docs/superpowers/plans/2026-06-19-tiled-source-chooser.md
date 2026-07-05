# Tiled Source Chooser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hidden source `<select>` dropdown in the Import page with a brand-iconed tile grid so all 12 conversion sources are discoverable up front.

**Architecture:** Pure UI change confined to `public/components/ConfigInput.jsx` and `public/styles/main.css`. A new `SOURCE_META` data structure drives a grouped tile grid rendered in the panel body. Local `sourceCommitted` state toggles between the grid (open, nothing committed) and the existing import/template content (preceded by a compact selected-source header). The existing `selectedVendor` state and all downstream wiring (`onParse`, sample filtering, placeholders, greenfield template picker) are reused unchanged.

**Tech Stack:** React 18 (JSX), plain CSS with the project's CSS-variable theme. No new dependencies. No engine/parser changes.

**Reference spec:** `docs/superpowers/specs/2026-06-19-tiled-source-chooser-design.md`

**Note on glyphs:** Per the approved mockup, each tile's icon chip is a **brand-colored monogram** (short letters like `PA`, `FG`) inside a brand-tinted rounded square — not bespoke per-vendor logo SVGs. This matches the visual the user approved and avoids trademark/redistribution concerns. Monograms reuse the same abbreviations already used by the merge-slot badges (`PA`, `SRX`, `FG`, `ASA`, `CP`, `SW`, `HW`).

**Testing reality:** This repo has no React component test harness (vitest covers engine logic only). There is no meaningful unit test to write for this presentational change, so each task ends with `npm run build` + a manual verification checklist rather than an automated UI test. The existing suite (`npx vitest run tests/`) must remain green since no logic is touched.

---

### Task 1: Add source metadata and monogram styling data

**Files:**
- Modify: `public/components/ConfigInput.jsx` (add a `SOURCE_META` constant near the top, after the existing `TEMPLATE_ICONS` constant, before `SANITIZE_TYPE_LABELS`)

This task only adds a data structure; no rendering yet. The build must still succeed.

- [ ] **Step 1: Add the `SOURCE_META` constant**

Insert the following after the `TEMPLATE_ICONS` constant (which ends at the line `};` before `const SANITIZE_TYPE_LABELS`):

```jsx
/**
 * Source-selector tile metadata.
 * `id` MUST match the existing selectedVendor values used by onParse, sample
 * filtering and textarea placeholders — do not rename them.
 * `color` is a brand color applied ONLY to the icon chip (tinted bg + glyph).
 * `mono` is the short monogram shown in the chip.
 * `group` controls which section the tile renders under.
 * `secondary` is the descriptor shown in the selected-source header.
 */
const SOURCE_GROUPS = ['scratch', 'vendor', 'cloud'];

const SOURCE_GROUP_LABELS = {
  scratch: 'From scratch',
  vendor: 'Firewall vendors',
  cloud: 'Cloud',
};

const SOURCE_META = [
  { id: 'greenfield',      label: 'Greenfield',        mono: 'GF',  color: 'var(--llm-cloud)', group: 'scratch', secondary: 'LLM-guided · start from a template', llm: true },
  { id: 'srx_healthcheck', label: 'SRX Best Practice', mono: 'BP',  color: 'var(--juniper-green)', group: 'scratch', secondary: 'Audit an existing SRX config' },
  { id: 'srx',             label: 'Junos SRX',         mono: 'SRX', color: 'var(--juniper-green)', group: 'vendor', secondary: 'Junos SRX config import' },
  { id: 'panos',           label: 'PAN-OS',            mono: 'PA',  color: '#FA582D', group: 'vendor', secondary: 'PAN-OS XML import' },
  { id: 'fortigate',       label: 'FortiGate',         mono: 'FG',  color: '#EE3124', group: 'vendor', secondary: 'FortiOS config import' },
  { id: 'cisco_asa',       label: 'Cisco ASA/FTD',     mono: 'ASA', color: '#1BA0D7', group: 'vendor', secondary: 'ASA/FTD running-config import' },
  { id: 'checkpoint',      label: 'Check Point R80+',  mono: 'CP',  color: '#E6097E', group: 'vendor', secondary: 'Check Point policy import' },
  { id: 'sonicwall',       label: 'SonicWall',         mono: 'SW',  color: '#FF6C2C', group: 'vendor', secondary: 'SonicOS config import' },
  { id: 'huawei_usg',      label: 'Huawei USG',        mono: 'HW',  color: '#E40012', group: 'vendor', secondary: 'Huawei VRP config import' },
  { id: 'aws_sg',          label: 'AWS SG',            mono: 'AWS', color: '#FF9900', group: 'cloud',  secondary: 'AWS Security Groups import' },
  { id: 'azure_nsg',       label: 'Azure NSG',         mono: 'AZ',  color: '#0078D4', group: 'cloud',  secondary: 'Azure NSG import' },
  { id: 'gcp_fw',          label: 'GCP Firewall',      mono: 'GCP', color: '#4285F4', group: 'cloud',  secondary: 'GCP Firewall Rules import' },
];

const SOURCE_META_BY_ID = Object.fromEntries(SOURCE_META.map((meta) => [meta.id, meta]));
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npm run build`
Expected: build completes, writes `dist/`, no errors. (The constant is unused so far; that is fine — Vite does not fail on unused module-level constants.)

- [ ] **Step 3: Commit**

```bash
git add public/components/ConfigInput.jsx
git commit -m "feat(config-input): add source metadata for tile chooser"
```

---

### Task 2: Add CSS for the tile grid, tiles, icon chips, and selected-source header

**Files:**
- Modify: `public/styles/main.css` (append a new block; place it immediately after the existing `.vendor-select:focus` rule, around line 283, so it sits with the other Config Input styles)

- [ ] **Step 1: Add the styles**

Insert after the `.vendor-select:focus { ... }` line:

```css
/* --- Source chooser tile grid --- */
.source-chooser {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.source-group-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 10px 0 4px;
}
.source-group-label:first-child { margin-top: 0; }
.source-tile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
}
.source-tile {
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: left;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 9px 8px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.source-tile:hover { background: var(--bg-hover); border-color: var(--accent); }
.source-tile.selected { border-color: var(--accent); background: var(--bg-elevated); color: var(--text-primary); }
.source-tile-chip {
  width: 30px;
  height: 24px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  /* --chip-color set inline per tile */
  color: var(--chip-color, var(--text-secondary));
  background: color-mix(in srgb, var(--chip-color, var(--border-color)) 18%, transparent);
}

/* --- Selected-source header (shown after a tile is committed) --- */
.selected-source-header {
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.selected-source-header .ssh-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.selected-source-header .ssh-sub {
  font-size: 10px;
  color: var(--text-muted);
}
.selected-source-change {
  margin-left: auto;
  font-size: 11px;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 3px 9px;
  cursor: pointer;
}
.selected-source-change:hover { border-color: var(--accent); }
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npm run build`
Expected: build completes with no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add public/styles/main.css
git commit -m "style(config-input): add tile-grid and selected-source styles"
```

---

### Task 3: Render the tile grid and selected-source header; remove the dropdown

**Files:**
- Modify: `public/components/ConfigInput.jsx` (component body: state, panel header, panel body top)

- [ ] **Step 1: Add `sourceCommitted` state**

Find this block near the top of the `ConfigInput` function body:

```jsx
  const fileInputRef = useRef(null);
  const [selectedVendor, setSelectedVendor] = useState(deterministicMode ? 'panos' : 'greenfield');
  const [showSanitizeTable, setShowSanitizeTable] = useState(false);

  const isGreenfield = selectedVendor === 'greenfield';
```

Replace it with:

```jsx
  const fileInputRef = useRef(null);
  const [selectedVendor, setSelectedVendor] = useState(deterministicMode ? 'panos' : 'greenfield');
  const [showSanitizeTable, setShowSanitizeTable] = useState(false);
  // Grid open on first load (nothing committed) so all sources are discoverable.
  // Once parsed or in an active greenfield interview, a source is implicitly committed.
  const [sourceCommitted, setSourceCommitted] = useState(false);

  const isGreenfield = selectedVendor === 'greenfield';
  const selectorLocked = greenfieldMode || isParsed;
  const showGrid = !sourceCommitted && !selectorLocked;
  const selectedMeta = SOURCE_META_BY_ID[selectedVendor];

  const commitSource = (id) => {
    setSelectedVendor(id);
    setSourceCommitted(true);
  };
```

- [ ] **Step 2: Remove the `<select>` from the panel header**

Find the panel header block:

```jsx
      <div className="panel-header">
        <h2>Source Configuration</h2>
        <select
          className="vendor-select"
          value={selectedVendor}
          onChange={(e) => setSelectedVendor(e.target.value)}
          disabled={greenfieldMode || isParsed}
          title={isGreenfield ? (llmLocalOnly ? 'Note: sending info to Local LLM' : 'Warning: sending info to a Public LLM') : undefined}
          style={isGreenfield ? {
            borderColor: llmLocalOnly ? 'var(--llm-local)' : 'var(--llm-cloud)',
            color: llmLocalOnly ? 'var(--llm-local)' : 'var(--llm-cloud)',
          } : undefined}
        >
          {!deterministicMode && <option value="greenfield">Greenfield (New Config)</option>}
          {!deterministicMode && <option value="srx_healthcheck">Junos SRX Best Practice</option>}
          <option value="srx">Junos SRX</option>
          <option value="panos">PAN-OS</option>
          <option value="fortigate">FortiGate</option>
          <option value="cisco_asa">Cisco ASA/FTD</option>
          <option value="checkpoint">Check Point R80+</option>
          <option value="sonicwall">SonicWall SonicOS</option>
          <option value="huawei_usg">Huawei USG</option>
          <option value="aws_sg">AWS Security Groups</option>
          <option value="azure_nsg">Azure NSG</option>
          <option value="gcp_fw">GCP Firewall Rules</option>
        </select>
      </div>
```

Replace it with (header keeps only the title now that selection moved into the body):

```jsx
      <div className="panel-header">
        <h2>Source Configuration</h2>
      </div>
```

- [ ] **Step 3: Render the grid (when open) and the selected-source header (when committed)**

Find the start of the panel body content, immediately after the model-badges block. The model-badges block ends with:

```jsx
        )}

        {isGreenfield ? (
```

Insert the grid + header rendering between the model-badges closing `)}` and the `{isGreenfield ? (` line, AND wrap the existing content so it only shows when a source is committed. Concretely, replace:

```jsx
        )}

        {isGreenfield ? (
```

with:

```jsx
        )}

        {showGrid ? (
          <div className="source-chooser">
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', margin: '4px 0 8px' }}>
              Choose what you're converting from
            </p>
            {SOURCE_GROUPS.map((group) => {
              const tiles = SOURCE_META.filter(
                (meta) => meta.group === group && !(deterministicMode && group === 'scratch')
              );
              if (tiles.length === 0) return null;
              return (
                <React.Fragment key={group}>
                  <div className="source-group-label">{SOURCE_GROUP_LABELS[group]}</div>
                  <div className="source-tile-grid">
                    {tiles.map((meta) => (
                      <button
                        key={meta.id}
                        className={`source-tile ${selectedVendor === meta.id ? 'selected' : ''}`}
                        onClick={() => commitSource(meta.id)}
                        title={meta.llm ? (llmLocalOnly ? 'Note: sending info to Local LLM' : 'Warning: sending info to a Public LLM') : meta.secondary}
                      >
                        <span className="source-tile-chip" style={{ '--chip-color': meta.color }}>{meta.mono}</span>
                        <span>{meta.label}</span>
                      </button>
                    ))}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
        <>
        {selectedMeta && (
          <div className="selected-source-header">
            <span className="source-tile-chip" style={{ '--chip-color': selectedMeta.color }}>{selectedMeta.mono}</span>
            <div>
              <div className="ssh-name" style={selectedMeta.llm ? { color: llmLocalOnly ? 'var(--llm-local)' : 'var(--llm-cloud)' } : undefined}>{selectedMeta.label}</div>
              <div className="ssh-sub">{selectedMeta.secondary}</div>
            </div>
            {!selectorLocked && (
              <button className="selected-source-change" onClick={() => setSourceCommitted(false)}>Change</button>
            )}
          </div>
        )}

        {isGreenfield ? (
```

- [ ] **Step 4: Close the new `showGrid` wrapper**

The existing content ends at the close of the normal-import branch. Find the closing of the panel body's main conditional:

```jsx
          </>
        )}
      </div>

      {showPullModal && (
```

Replace it with (adds the closing `</>` and `)}` for the new `showGrid` ternary wrapper added in Step 3):

```jsx
          </>
        )}
        </>
        )}
      </div>

      {showPullModal && (
```

- [ ] **Step 5: Verify the build succeeds**

Run: `npm run build`
Expected: build completes, no JSX/syntax errors. (If the build reports an unbalanced-tag/JSX error, re-check that Step 3 and Step 4 opened and closed exactly one extra `<>…</>` and one extra `{showGrid ? ( … ) : ( … )}`.)

- [ ] **Step 6: Run the existing test suite to confirm no regressions**

Run: `npx vitest run tests/`
Expected: all tests pass (no logic changed).

- [ ] **Step 7: Manual verification in the dev server**

Run: `npm run dev` and open the printed Local URL. Accept the risk disclaimer to reach the Import page. Verify:
- The page now shows a grouped tile grid ("From scratch / Firewall vendors / Cloud") instead of jumping straight to the Greenfield template picker.
- Each tile shows a brand-tinted monogram chip + label.
- Clicking a vendor tile (e.g. FortiGate) collapses the grid to the selected-source header and shows the upload/sample/parse/textarea controls; the Parse button parses correctly with a pasted/sample config.
- Clicking the Greenfield tile shows the template picker (Branch Office, Data Center, etc.); the chip/name render in violet (LLM color); hovering the tile shows the LLM warning tooltip.
- The "Change" link reopens the grid.
- After a successful Parse, the selected-source header is shown without a "Change" link (locked), matching the old disabled-dropdown behavior.

- [ ] **Step 8: Commit**

```bash
git add public/components/ConfigInput.jsx
git commit -m "feat(config-input): replace source dropdown with tile chooser"
```

---

### Task 4: Verify deterministic mode and merge mode are unaffected

**Files:**
- No code changes expected. This task is verification only; if a defect is found, fix it in `public/components/ConfigInput.jsx` and re-run.

- [ ] **Step 1: Verify deterministic mode**

In the dev server, enable deterministic mode (the app's existing toggle for `deterministicMode`). Verify:
- The "From scratch" group (Greenfield, SRX Best Practice) does NOT render in the grid.
- The "Firewall vendors" and "Cloud" groups render normally and selection/parse works.

- [ ] **Step 2: Verify merge mode**

Enable merge mode. Verify:
- The merge slot tab bar still renders above the body.
- Each slot independently shows the tile grid when no source is committed for that slot and the import controls after selection.
- Switching slots does not throw.

- [ ] **Step 3: Final build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit (only if a fix was needed)**

```bash
git add public/components/ConfigInput.jsx
git commit -m "fix(config-input): correct tile chooser behavior in <mode>"
```
