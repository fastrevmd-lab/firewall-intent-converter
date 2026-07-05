# Core

Client-only React (Vite) static SPA. Converts multi-vendor firewall configs → Juniper SRX.
No backend (Express `server.js` removed 2026-02-27). All logic runs in-browser; API keys live in `localStorage` (accepted risk).

## Two-layer architecture
- **Conversion engine** (`src/`, plain JS, vendor-neutral). Pipeline: vendor parser → normalized intermediate config model → SRX converter → SRX output. See `mem:engine/core`.
- **React frontend** (`public/`, JSX). Context-provider driven UI that wraps the engine. See `mem:frontend/core`.

## Source map (top level)
- `src/parsers/` — one parser per vendor (panos, fortigate, cisco-asa, checkpoint, sonicwall, huawei, srx, aws-sg, azure-nsg, gcp-fw) + `parser-utils.js`. Output = normalized config model (`zones`, `security_policies`, objects, etc.).
- `src/converters/` — `srx-converter.js` (4.3k lines, set-format) + `srx-xml-builder.js` (XML output).
- `src/validators/` — `srx-validation-engine.js` + compliance/hardware/operational/srx checks.
- `src/analysis/` — `config-analyzer.js`, `shadow-detector.js` (shadowed-rule detection).
- `src/interview/` — LLM-assisted clarification: `llm-client.js`, `question-engine.js`.
- `src/data/app-mappings.json` + `src/utils/app-mappings.js` — vendor app-id → SRX application mapping (user-editable in UI).
- `src/utils/profile-mappings.js`.
- `public/` — React SPA (entry `public/main.jsx`). See `mem:frontend/core`.

## Builds
- `dist/` — normal SPA build (`npm run build`), strict CSP injected via Vite plugin.
- `dist-standalone/` — single-file `file://`-runnable bundle (`npm run build:standalone`), no CSP, `inlineDynamicImports`.
- See `mem:tech_stack`, `mem:suggested_commands`, `mem:conventions`, `mem:task_completion`.

## Hard invariants
- Engine code (`src/`) must stay framework-free (no React imports) — it's shared by both builds and tests.
- `publicDir` is `static/` (NOT `public/`), because `public/` holds React source. Never assume Vite's default.
- License CC-BY-NC-ND-4.0 (no-derivatives, non-commercial).
