import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getLLMChatResponse, getLLMSuggestion } from '../public/utils/llm-client.js';
import { saveLLMSettings } from '../public/utils/llm-settings.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
});

describe('credential source invariants', () => {
  it('centralizes LLM storage access', () => {
    for (const path of [
      'public/components/LLMSettings.jsx',
      'public/utils/llm-client.js',
      'public/components/ExportPdfButton.jsx',
    ]) {
      const source = read(path);
      expect(source).not.toMatch(/localStorage\.(?:getItem|setItem)\(['"]llm-settings/);
      expect(source).not.toMatch(/sessionStorage\.(?:getItem|setItem)\(['"]llm-api-key/);
    }
  });

  it('does not serialize apiKey into persistent settings', () => {
    const source = read('public/utils/llm-settings.js');
    expect(source).toContain("const { apiKey = '', ...nonsecret } = settings");
    expect(source).toContain('JSON.stringify(nonsecret)');
  });

  it('keeps cloud keys in auth headers and redacts remote error bodies', async () => {
    const cases = [
      { provider: 'claude', header: 'x-api-key', value: 'SENTINEL_KEY', label: 'Claude' },
      { provider: 'openai', header: 'Authorization', value: 'Bearer SENTINEL_KEY', label: 'OpenAI' },
      { provider: 'gemini', header: 'x-goog-api-key', value: 'SENTINEL_KEY', label: 'Gemini' },
    ];

    for (const testCase of cases) {
      for (const call of [
        () => getLLMSuggestion('user prompt', 'system prompt'),
        () => getLLMChatResponse([{ role: 'user', content: 'user prompt' }], 'system prompt'),
      ]) {
        saveLLMSettings({ provider: testCase.provider, apiKey: 'SENTINEL_KEY' });
        const responseJson = vi.fn(async () => ({ error: { message: 'SENTINEL_REMOTE_ERROR' } }));
        globalThis.fetch = vi.fn(async () => ({ ok: false, status: 401, json: responseJson }));

        let caught;
        try { await call(); } catch (error) { caught = error; }

        expect(caught?.message).toBe(`${testCase.label} API error: 401`);
        expect(caught?.message).not.toContain('SENTINEL_REMOTE_ERROR');
        expect(responseJson).not.toHaveBeenCalled();
        const [url, options] = fetch.mock.calls[0];
        expect(url).not.toContain('SENTINEL_KEY');
        expect(options.body).not.toContain('SENTINEL_KEY');
        expect(options.headers[testCase.header]).toBe(testCase.value);
      }
    }
  });
});
