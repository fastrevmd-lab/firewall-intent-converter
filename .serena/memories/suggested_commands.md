# Suggested Commands

- Dev server (LAN-exposed): `npm run dev`
- Production build: `npm run build` → `dist/` (strict CSP injected)
- Preview built SPA: `npm run preview`
- Standalone single-file build: `npm run build:standalone` → `dist-standalone/` (file://-runnable, no CSP)
- Zip standalone for distribution: `npm run zip:standalone`
- Run tests: `npx vitest run tests/` (vitest not installed by default — npx will fetch it). Single file: `npx vitest run tests/<name>.test.js`. There is no `npm test` script.

No lint or format tooling is configured in this repo.
