# Conventions

## Color semantics (STRICT — CSS vars in public/styles/main.css)
Color encodes *who* made a change/detection. Misusing violet for app actions is a real recurring mistake.
- `--llm-cloud` violet `#a78bfa` — ONLY cloud-LLM-driven features/changes.
- `--llm-local` plum/maroon `#db2777` — local-LLM features.
- `--caution` orange `#f59e0b` — app/tool-driven changes, analysis, warnings, auto-detection (anything the app itself does).
- `--juniper-green` `#90C641` — SRX target model names / branding.
- `--accent` teal — general UI accent, arrows, links.
Never use violet where the application (not an LLM) makes the change.

## Code style
- ESM imports everywhere; `.jsx` extension required in import paths (Vite resolves explicitly).
- Engine (`src/`) is pure JS, no React, no DOM — keep it portable for tests + both builds.
- JSDoc block comments on exported functions are the norm (see vite plugins, hooks).
- Prefer `const`; early returns over nested if/else; descriptive names.

## Frontend wiring
- State lives in React Context providers, nested in `public/main.jsx` (Config→UI→Conversion→Merge→Undo). Add new global state as a context, not prop-drilling.
- `localStorage` JSON reads must go through `safeJsonParse` (util), never raw `JSON.parse` — rolled out project-wide; keep new call sites consistent.

## Security
- CSP is injected ONLY in `vite.config.js` (production builds), skipped in dev. When auditing CSP, check `vite.config.js` independently — it can diverge from anything in old `server.js`. Standalone build has NO CSP by design.
