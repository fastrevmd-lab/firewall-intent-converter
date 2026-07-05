# Task Completion

When a coding task is considered done:
1. Run tests: `npx vitest run tests/` — must pass. Conversion-logic changes especially need this (regression coverage lives in `tests/srx-converter-apps.test.js`, `app-mappings.test.js`, `validation-engine.test.js`, `triage.test.js`, `day2-ops.test.js`, `llm-translate.test.js`).
2. Verify a clean build: `npm run build` (catches import-path / ESM errors the dev server may tolerate).
3. If frontend/UI was touched, sanity-check color semantics against `mem:conventions`.

No linter/formatter/type-checker is configured — do not invent one.
User workflow preference: scan for vulnerabilities + run tests after changes; show files to be modified before editing; suggest a commit message after completing a task.
