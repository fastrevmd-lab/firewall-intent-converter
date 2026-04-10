# UX Improvements Design Spec

**Date:** 2026-04-09
**Branch:** `ux-improve`
**Approach:** Bottom-up (Sidebar → Header → Triage → Table → Inspector)

## Context

A GUI/UX review identified 5 areas where the interface is overloaded, weakly prioritized, and hard to scan under operational pressure. The core issue is not lack of capability — it's that too many controls, counts, statuses, and navigation layers compete for attention simultaneously. This spec addresses all 5 suggestions in a single pass, sequenced so each change builds on the previous.

---

## 1. Sidebar: Workflow-Based Navigation

**Problem:** 7 domain-based groups (Security, Objects, Network, System, Output, Tools) mix technical object types, workflow stages, and outputs in one tree. Labels are inconsistent ("SSL B&I", "Addr/Svc/App", "Intf / Routing").

**Design:** Replace with 6 workflow stages that mirror the operator's migration process.

| Stage | Contents |
|-------|----------|
| **① Import** | Config Input, Sanitized Objects (if any) |
| **② Review** | Policies, NAT Rules, Zones, Objects, Analysis, Dependency Graph |
| **③ Configure** | Interfaces & Routing, VPN, Screens, SSL Decrypt, PBF, HA, QoS, Syslog, SNMP, AAA, DHCP, Flow Monitoring |
| **④ Validate** | Warnings, Checklist, Diff View |
| **⑤ Export** | SRX Config, Report |
| **⑥ Operate** | Day 2 Ops, Batch Migration |

**Label normalization:**
- "SSL B&I" → "SSL Decrypt"
- "Addr/Svc/App" → "Objects"
- "Intf / Routing" → "Interfaces & Routing"

**Badge rules:** Orange (`--caution`) for items needing attention (warnings, unreviewed counts). Teal (`--accent`) for informational counts. No counts where they don't drive action.

**Files to modify:**
- `public/components/nav/NavTree.jsx` — restructure `NAV_STRUCTURE` array
- `public/styles/nav-tree.css` — add numbered stage styling

---

## 2. Header: Declutter Single Bar

**Problem:** TopBar has 11 buttons + 5 stat badges competing for attention. Secondary utilities (tour, theme, feedback) have the same visual weight as primary actions.

**Design:** Keep single bar, consolidate badges, move secondary controls to overflow menu.

**Consolidated badges (3 instead of 5):**
- Model + License + Site → `"PAN-OS → SRX345 · Standard"` (one badge, click opens model selector)
- Warnings → `"⚠ 7 warnings"` (just unresolved count, click navigates to warnings page)
- Policy progress → `"28/42 accepted"` (green/orange numbers)

**Visible buttons (3):** Save, Load, Overflow menu (⋯)

**Overflow menu (⋯) contains:**
- Models, Interfaces, Report
- Theme toggle
- Guided tour
- Feedback
- Settings / AI mode

**Files to modify:**
- `public/components/layout/TopBar.jsx` — consolidate badges, add overflow dropdown
- `public/styles/main.css` — overflow menu styles

---

## 3. Triage Status System

**Problem:** Current labels (UNREVIEWED, LLM REVIEWED, ACCEPTED) are workflow states, not triage guidance. Warning dots are scattered and easy to miss. Users can't filter by risk level.

**Design:** 4-bucket triage model with filter bar.

| Bucket | Color | Badge | Auto-Assignment Criteria |
|--------|-------|-------|-------------------------|
| **Safe to Accept** | Green (`--success`) | `✓ Safe` | No `_warnings`, no `_unsupported`, no missing refs |
| **Needs Decision** | Yellow (`--warning`) | `⚡ Decision` | Has `_warnings` or `_interview_required` |
| **Unsupported** | Red (`--error`) | `✕ Unsupported` | Has `_unsupported` features |
| **Blocked** | Gray (`--text-secondary`) | `⏸ Blocked` | References missing zone/interface/object |

**Additional states:**
- **Accepted** — terminal state, shown as progress counter on right side of filter bar (not a triage bucket)
- **LLM reviewed** — overlay indicator (small violet dot on triage badge), not its own bucket

**Filter bar:** Horizontal pill buttons above the policy table, each showing bucket name + count. Click to filter. "All" button with active teal border by default. "Accepted" counter on the right. Text search input on far right.

**Triage computation:** Add a `computeTriageBucket(rule, intermediateConfig)` utility that examines `_warnings`, `_unsupported`, `_interview_required`, and validates zone/interface/object references against the config.

**Files to modify:**
- `public/utils/triage.js` — new file, triage computation logic
- `public/components/PolicyTable.jsx` — add filter bar, use triage badges in rows
- `public/styles/main.css` — triage badge and filter bar styles

---

## 4. Expandable Table Rows

**Problem:** Table rows show all data in dense columns — zones, addresses, apps, profiles, action, logs, status — making it visually exhausting and slowing risk review.

**Design:** Compact summary rows (7 columns) that expand to reveal a detail grid.

**Collapsed row columns:**
1. Checkbox (bulk select)
2. ▶ chevron (expand/collapse)
3. # (rule index)
4. Name
5. Zones (src → dst, inline)
6. Action (permit/deny, color-coded)
7. Triage badge (with optional LLM violet dot)

**Expanded row detail grid (3 columns):**
- Source Addresses, Destination Addresses, Applications & Ports
- Security Profiles, Logging, Users (if present)
- Warning messages in a yellow ⚠ strip at bottom of expansion

**Row states:**
- Default: collapsed, normal opacity
- Expanded: teal left border, subtle highlight background
- Accepted: 60% opacity, ✓ instead of chevron
- Selected (for inspector): teal accent glow background

**Interactions:**
- Click ▶ or row to expand/collapse
- Click row also selects it for the inspector
- Double-click cell chips in expanded view to edit (preserves existing inline editing)
- Virtual scrolling preserved — expanded rows increase the row height dynamically

**Files to modify:**
- `public/components/PolicyTable.jsx` — refactor row rendering to collapsed/expanded pattern
- `public/styles/main.css` — expandable row styles, detail grid layout

---

## 5. Inspector Panel Improvements

**Problem:** Inspector is a flat scrollable list of fields with a generic header. Selection state, edit state, and triage status aren't visible. Weak connection between table selection and inspector content.

**Design:** Structured side sheet with pinned header, grouped sections, and clear edit state.

**Pinned header (sticky top):**
- Rule name (bold, 13px)
- Triage badge + LLM review dot (same visual as table row)
- Unsaved changes indicator: orange `"● N unsaved changes"` (visible only when edits exist)

**Warning banner:** Conversion warnings shown as a yellow-bordered box immediately below the header, before any fields.

**Grouped sections (teal section headers with underline):**
- **Identity** — Action, Log, Disabled
- **Traffic Match** — Src/Dst Zones, Src/Dst Addresses, Applications
- **Security Profiles** — AV, IPS, URL, etc.

**Action buttons (bottom of panel):**
- "Accept Rule" (green, primary)
- "Reset Changes" (secondary, only visible when unsaved changes exist)

**Files to modify:**
- `public/components/InterviewPanel.jsx` — add pinned header, grouped sections, change tracking
- `public/styles/main.css` — inspector section styles, sticky header, warning banner

---

## Verification

### Manual Testing
1. **Sidebar:** Navigate all 6 stages, verify all existing pages are reachable, counts update correctly
2. **Header:** Click overflow menu, verify all moved actions work. Click consolidated badges to verify navigation.
3. **Triage:** Import a config with mixed warnings/unsupported features. Verify auto-assignment to correct buckets. Test each filter button.
4. **Table:** Expand/collapse rows. Verify inline editing works in expanded view. Check virtual scrolling with 100+ rules. Bulk select across collapsed/expanded rows.
5. **Inspector:** Select a rule, verify pinned header stays visible while scrolling. Edit fields, verify "unsaved changes" indicator. Click Reset Changes. Click Accept Rule.

### Existing Tests
- Run `npm test` to verify no regressions in conversion logic
- Triage computation utility should get its own unit tests

### Cross-Browser
- Test in Chrome and Firefox at minimum
- Verify light theme still works after all CSS changes
