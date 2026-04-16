// tests/app-mappings.test.js
/**
 * Tests for src/utils/app-mappings.js multi-vendor coverage.
 * Run with: node tests/app-mappings.test.js
 */
import { loadAppMappings, mapVendorApp } from '../src/utils/app-mappings.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✔ ${name}`); passed++; }
  catch (e) { console.log(`  ✘ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

await loadAppMappings();

console.log('--- Vendor key coverage ---');
test('checkpoint vendor lookup resolves https (if alias present)', () => {
  const r = mapVendorApp('https', 'checkpoint');
  // After Task 1: lookup mechanism exists. After Task 5: data populated.
  // Here we assert the index was built (no crash) — full resolution asserted in Task 5.
  assert(r === null || r.junosApp === 'junos-https',
    `checkpoint/https returned unexpected ${JSON.stringify(r)}`);
});
test('sonicwall vendor lookup resolves HTTPS (if alias present)', () => {
  const r = mapVendorApp('HTTPS', 'sonicwall');
  assert(r === null || r.junosApp === 'junos-https',
    `sonicwall/HTTPS returned unexpected ${JSON.stringify(r)}`);
});
test('huawei vendor lookup resolves https (if alias present)', () => {
  const r = mapVendorApp('https', 'huawei_usg');
  assert(r === null || r.junosApp === 'junos-https',
    `huawei_usg/https returned unexpected ${JSON.stringify(r)}`);
});

import { mapAppToJunos, JUNOS_PREDEFINED_APPS } from '../src/parsers/parser-utils.js';

console.log('--- junos-* passthrough ---');
test('junos-ldap passes through unchanged', () => {
  const r = mapAppToJunos('junos-ldap', 'panos');
  assert(r === 'junos-ldap', `expected junos-ldap, got ${r}`);
});
test('junos-https passes through unchanged', () => {
  const r = mapAppToJunos('junos-https', 'fortigate');
  assert(r === 'junos-https', `expected junos-https, got ${r}`);
});
test('junos-bogus (not a predefined) does NOT pass through', () => {
  assert(!JUNOS_PREDEFINED_APPS.has('junos-bogus'), 'precondition failed');
  const r = mapAppToJunos('junos-bogus', 'panos');
  assert(r === null, `expected null for unknown junos-* name, got ${r}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
