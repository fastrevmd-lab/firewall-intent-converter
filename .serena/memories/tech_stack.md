# Tech Stack

- Language: JS + JSX, ESM only (`"type": "module"`). Project reports as TypeScript to Serena but there is no TS — `.js`/`.jsx` only.
- UI: React 18.3.1 + react-dom (no router lib; routing is custom via `ContentRouter`/contexts).
- Build: Vite 8.0.14, `@vitejs/plugin-react` 6.0.2.
- XML: `fast-xml-parser` 5.8.0 (parsing PAN-OS/Panorama XML + building SRX XML).
- Package manager: npm (`package-lock.json` committed).
- Tests: written for **vitest** (`import { describe, it, expect } from 'vitest'`) but vitest is NOT in `package.json` deps and NOT installed in `node_modules` — run via `npx vitest`. No `vitest.config.*` exists (relies on defaults). No `test` script in package.json despite docs referencing `npm test`.
- Node target: browser SPA; engine code also runs under Node for tests.
