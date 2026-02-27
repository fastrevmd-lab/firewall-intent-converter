/**
 * Safe JSON parse — strips prototype pollution keys (__proto__, constructor,
 * prototype) from all objects in the parsed tree.
 *
 * Use this instead of raw JSON.parse() for any untrusted input:
 *   - LLM responses
 *   - Loaded project files
 *   - localStorage values
 */
export function safeJsonParse(text) {
  return JSON.parse(text, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
}
