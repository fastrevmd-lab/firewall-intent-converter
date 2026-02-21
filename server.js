/**
 * Express server for Firewall Policy Converter.
 *
 * In development:  Vite is attached as middleware so a single `node server.js`
 *                  serves both the React app (with HMR) and the API.
 * In production:   The pre-built Vite output in dist/ is served as static files.
 *
 * API endpoints:
 *   POST /api/parse    – accepts { configText, vendor? } → intermediate JSON
 *   POST /api/convert  – accepts { intermediateConfig, format? } → SRX output
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { parsePanosConfig } from './src/parsers/panos-parser.js';
import { convertToSrxSetCommands } from './src/converters/srx-converter.js';
import { buildSrxXml } from './src/converters/srx-xml-builder.js';
import { validateSrxOutput } from './src/validators/srx-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// PAN-OS configs can be very large (10k+ rules), so allow generous payloads
app.use(express.json({ limit: '50mb' }));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/parse
 * Accepts raw PAN-OS XML config text and returns a vendor-neutral
 * intermediate JSON representation.
 */
app.post('/api/parse', (req, res) => {
  try {
    const { configText } = req.body;
    if (!configText || typeof configText !== 'string') {
      return res.status(400).json({ error: 'configText is required and must be a string' });
    }
    const result = parsePanosConfig(configText);
    res.json(result);
  } catch (error) {
    console.error('[parse] Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/convert
 * Accepts an intermediate JSON config and converts it to SRX output.
 * Query param `format` can be "set" (default) or "xml".
 */
app.post('/api/convert', (req, res) => {
  try {
    const { intermediateConfig, format = 'set', interfaceMappings = {} } = req.body;
    if (!intermediateConfig) {
      return res.status(400).json({ error: 'intermediateConfig is required' });
    }

    let output;
    if (format === 'xml') {
      output = buildSrxXml(intermediateConfig, interfaceMappings);
    } else {
      output = convertToSrxSetCommands(intermediateConfig, interfaceMappings);
    }

    // Run validation on the generated output
    const validation = validateSrxOutput(intermediateConfig, output);

    res.json({
      output,
      format,
      validation,
    });
  } catch (error) {
    console.error('[convert] Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Frontend Serving
// ---------------------------------------------------------------------------

if (isDev) {
  // In dev mode, attach Vite as Express middleware for HMR + JSX transforms
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // In production, serve the pre-built Vite output
  app.use(express.static(resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(resolve(__dirname, 'dist', 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Firewall Policy Converter running at http://localhost:${PORT}`);
  if (isDev) {
    console.log('Development mode — Vite HMR active');
  }
});
