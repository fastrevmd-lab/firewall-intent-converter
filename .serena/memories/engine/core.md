# Engine Core (src/)

Pure-JS, framework-free conversion engine. Pipeline:
`raw vendor config` → **parser** (`src/parsers/<vendor>-parser.js`) → **normalized config model** → **converter** (`src/converters/srx-converter.js`) → SRX `set` output; `srx-xml-builder.js` produces XML form.

## Normalized config model
Shared dict shape consumed by converters/validators/analysis. Key fields: `zones`, `security_policies` (each policy has `source_zones`, `destination_zones`, `_warnings`, `_interview_required`, etc.), address/service objects, app references. All parsers must emit this same shape; `parser-utils.js` holds shared helpers.

## Subsystems
- `validators/` — `srx-validation-engine.js` orchestrates `compliance-checks.js`, `hardware-checks.js`, `operational-checks.js`, `srx-validator.js`.
- `analysis/` — `config-analyzer.js`, `shadow-detector.js` (detects shadowed/overlapping rules).
- `interview/` — LLM-assisted clarification of ambiguous rules: `question-engine.js` decides what to ask, `llm-client.js` calls the provider. Rules needing input carry `_interview_required`.
- App mapping: `data/app-mappings.json` (data) + `utils/app-mappings.js` (logic). Maps vendor app-ids → SRX applications; unmapped → `UNMAPPED`; user-editable via frontend `AppMappingsEditor`.

## Rules
- NEVER import React/DOM here — engine must run under Node (vitest) and in both builds.
- Adding a vendor = new `<vendor>-parser.js` emitting the normalized model; converters/validators stay vendor-agnostic.
