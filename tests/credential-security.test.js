import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getLLMChatResponse, getLLMSuggestion } from '../public/utils/llm-client.js';
import { saveLLMSettings } from '../public/utils/llm-settings.js';
import {
  EMPTY_DEVICE_REGISTRATION,
  buildDeviceRegistration,
} from '../public/utils/device-registration.js';

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
  it('builds agent registrations without secret fields', () => {
    expect(buildDeviceRegistration({
      ...EMPTY_DEVICE_REGISTRATION,
      name: ' edge ', host: ' 192.0.2.10 ', username: ' netops ',
    })).toEqual({
      name: 'edge', host: '192.0.2.10', port: 830,
      username: 'netops', auth_method: 'agent',
    });
  });

  it('includes only the password environment reference for password-env', () => {
    expect(buildDeviceRegistration({
      name: 'edge', host: '192.0.2.10', port: 830, username: 'netops',
      auth_method: 'password-env', password_env: 'FIC_EDGE_PASSWORD',
    })).toMatchObject({ auth_method: 'password-env', password_env: 'FIC_EDGE_PASSWORD' });
  });

  it('rejects invalid password environment names without echoing input', () => {
    expect(() => buildDeviceRegistration({
      name: 'edge', host: '192.0.2.10', port: 830, username: 'netops',
      auth_method: 'password-env', password_env: 'bad-SENTINEL',
    })).toThrow('Password environment variable name is invalid.');
    try {
      buildDeviceRegistration({
        name: 'edge', host: '192.0.2.10', port: 830, username: 'netops',
        auth_method: 'password-env', password_env: 'bad-SENTINEL',
      });
    } catch (error) {
      expect(error.message).not.toContain('SENTINEL');
    }
  });

  it('removes password and private-key controls from the bridge UI', () => {
    const source = read('public/components/LLMSettings.jsx');
    expect(source).not.toMatch(/newDevice\.(?:password|ssh_key)\b/);
    expect(source).not.toContain('SSH Key Path');
    expect(source).toContain('Password Environment Variable');
    expect(source).toContain('disabled-development');
  });

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
