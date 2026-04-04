#!/usr/bin/env node
/**
 * convert-sample.mjs — Node.js helper for test-on-srx.py
 *
 * Usage: node convert-sample.mjs <sampleKey>
 * Outputs JSON: { "commands": [...], "warnings": [...], "label": "..." }
 *
 * Reads a sample config from sample-configs.jsx, parses it,
 * converts to SRX set commands, and prints JSON to stdout.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import vm from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// The sample key to convert (passed as CLI arg)
const sampleKey = process.argv[2];

if (!sampleKey) {
  console.error('Usage: node convert-sample.mjs <sampleKey>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Extract sample config text from the JSX module
// ---------------------------------------------------------------------------
// The file is trusted project code — plain JS object with template literals,
// no actual JSX. We evaluate it in a sandboxed context with no access to
// Node built-ins (process, require, fs, etc.) to limit blast radius.
const samplePath = resolve(projectRoot, 'public/components/sample-configs.jsx');
const sampleSrc = readFileSync(samplePath, 'utf-8');

const objStart = sampleSrc.indexOf('{', sampleSrc.indexOf('SAMPLE_CONFIGS'));
const objBody = sampleSrc.slice(objStart).replace(/;\s*$/, '');

const sandbox = Object.create(null);
const SAMPLE_CONFIGS = vm.runInNewContext(`(${objBody})`, sandbox, {
  filename: 'sample-configs.jsx',
  timeout: 5000,
});

const sample = SAMPLE_CONFIGS[sampleKey];
if (!sample) {
  console.error(`Sample key "${sampleKey}" not found. Available: ${Object.keys(SAMPLE_CONFIGS).join(', ')}`);
  process.exit(1);
}

const configText = sample.xml || sample.text || sample.json;
if (!configText) {
  console.error(`Sample "${sampleKey}" has no config text (xml/text/json field)`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Parse the config
// ---------------------------------------------------------------------------
import { detectVendor } from '../src/parsers/parser-utils.js';

const detection = detectVendor(configText);

const parserMap = {
  srx:        () => import('../src/parsers/srx-parser.js').then(m => m.parseSrxConfig),
  fortigate:  () => import('../src/parsers/fortigate-parser.js').then(m => m.parseFortigateConfig),
  cisco_asa:  () => import('../src/parsers/cisco-asa-parser.js').then(m => m.parseCiscoAsaConfig),
  checkpoint: () => import('../src/parsers/checkpoint-parser.js').then(m => m.parseCheckPointConfig),
  sonicwall:  () => import('../src/parsers/sonicwall-parser.js').then(m => m.parseSonicWallConfig),
  huawei_usg: () => import('../src/parsers/huawei-parser.js').then(m => m.parseHuaweiConfig),
  panos:      () => import('../src/parsers/panos-parser.js').then(m => m.parsePanosConfig),
};

const vendor = detection.vendor || 'panos';
const parseFn = await (parserMap[vendor] || parserMap.panos)();
const parseResult = parseFn(configText);
// Parsers return { intermediateConfig, warnings, parseStats } — extract the config
const intermediate = parseResult.intermediateConfig || parseResult;
intermediate.detectedVendor = vendor;

// ---------------------------------------------------------------------------
// 3. Convert to SRX set commands
// ---------------------------------------------------------------------------
const { convertToSrxSetCommands } = await import('../src/converters/srx-converter.js');
const { loadAppMappings, mapVendorApp } = await import('../src/utils/app-mappings.js');
const { setMapVendorApp } = await import('../src/parsers/parser-utils.js');

try {
  await loadAppMappings();
  setMapVendorApp(mapVendorApp);
} catch (_) { /* non-fatal */ }

const result = convertToSrxSetCommands(intermediate);

// ---------------------------------------------------------------------------
// 4. Output JSON
// ---------------------------------------------------------------------------
const output = {
  sampleKey,
  label: sample.label,
  vendor,
  commands: result.commands,
  warnings: result.warnings,
};

console.log(JSON.stringify(output));
