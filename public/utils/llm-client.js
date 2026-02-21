/**
 * Browser-Side LLM API Client
 * ==============================
 * Makes API calls directly from the browser to LLM providers.
 * API keys are read from localStorage ('llm-settings') and never touch the server.
 *
 * Supported providers:
 *   - Claude (Anthropic) — api.anthropic.com/v1/messages
 *   - OpenAI            — api.openai.com/v1/chat/completions
 *   - Ollama (local)    — localhost:11434/api/chat
 *   - LM Studio (local) — localhost:1234/v1/chat/completions
 *   - Custom endpoint   — user-specified OpenAI-compatible API
 */

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Sends a prompt to the configured LLM and returns the response text.
 *
 * @param {string} userPrompt - The user message to send
 * @param {string} [systemPrompt] - Optional system message for context
 * @returns {Promise<string>} - The LLM response text
 * @throws {Error} - On configuration or API errors
 */
export async function getLLMSuggestion(userPrompt, systemPrompt = '') {
  const settings = loadSettings();

  if (!settings.provider) {
    throw new Error('No LLM provider configured. Open Settings to configure one.');
  }

  switch (settings.provider) {
    case 'claude':
      return callClaude(settings, userPrompt, systemPrompt);
    case 'openai':
      return callOpenAI(settings, userPrompt, systemPrompt);
    case 'ollama':
      return callOllama(settings, userPrompt, systemPrompt);
    case 'lmstudio':
      return callLMStudio(settings, userPrompt, systemPrompt);
    case 'custom':
      return callCustom(settings, userPrompt, systemPrompt);
    default:
      throw new Error(`Unknown LLM provider: ${settings.provider}`);
  }
}

/**
 * Checks if an LLM provider is configured and ready.
 * @returns {{ configured: boolean, provider: string, model: string }}
 */
export function getLLMStatus() {
  const settings = loadSettings();
  const needsKey = !['ollama', 'lmstudio'].includes(settings.provider);
  const configured = settings.provider && (!needsKey || settings.apiKey);
  return {
    configured: !!configured,
    provider: settings.provider || 'none',
    model: settings.model || 'none',
  };
}

// ---------------------------------------------------------------------------
// Provider Implementations
// ---------------------------------------------------------------------------

async function callClaude(settings, userPrompt, systemPrompt) {
  if (!settings.apiKey) {
    throw new Error('Claude API key not configured. Open Settings to add your Anthropic API key.');
  }

  const body = {
    model: settings.model || 'claude-sonnet-4-6',
    max_tokens: settings.maxTokens || 1024,
    messages: [{ role: 'user', content: userPrompt }],
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || 'No response from Claude.';
}

async function callOpenAI(settings, userPrompt, systemPrompt) {
  if (!settings.apiKey) {
    throw new Error('OpenAI API key not configured. Open Settings to add your OpenAI API key.');
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o',
      messages,
      temperature: settings.temperature ?? 0.2,
      max_tokens: settings.maxTokens || 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from OpenAI.';
}

async function callOllama(settings, userPrompt, systemPrompt) {
  const baseUrl = settings.baseUrl || 'http://localhost:11434';

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model || 'llama3',
      messages,
      stream: false,
      options: {
        temperature: settings.temperature ?? 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}. Is Ollama running at ${baseUrl}?`);
  }

  const data = await response.json();
  return data.message?.content || 'No response from Ollama.';
}

async function callLMStudio(settings, userPrompt, systemPrompt) {
  const baseUrl = settings.baseUrl || 'http://localhost:1234';

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model || 'local-model',
      messages,
      temperature: settings.temperature ?? 0.2,
      max_tokens: settings.maxTokens || 1024,
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.status}. Is LM Studio running at ${baseUrl}?`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from LM Studio.';
}

async function callCustom(settings, userPrompt, systemPrompt) {
  if (!settings.baseUrl) {
    throw new Error('Custom endpoint URL not configured. Open Settings to set the base URL.');
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  const response = await fetch(`${settings.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model || 'default',
      messages,
      temperature: settings.temperature ?? 0.2,
      max_tokens: settings.maxTokens || 1024,
    }),
  });

  if (!response.ok) {
    throw new Error(`Custom API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from custom endpoint.';
}

// ---------------------------------------------------------------------------
// Settings Loader
// ---------------------------------------------------------------------------

function loadSettings() {
  try {
    const saved = localStorage.getItem('llm-settings');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

// ---------------------------------------------------------------------------
// Prompt Builders
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert firewall policy engineer specializing in PAN-OS to Juniper SRX migrations. You provide concise, actionable best-practice suggestions. Focus on:
- Security hardening (least privilege, explicit deny, zone segmentation)
- SRX-specific optimizations (application identification, UTM policies)
- Common migration pitfalls (port mapping, NAT differences, logging)
- Compliance considerations (PCI-DSS, NIST, CIS benchmarks)

Keep responses brief: 2-4 bullet points, each 1-2 sentences. Use technical language appropriate for a network security engineer.`;

/**
 * Builds a prompt asking the LLM to review a security rule.
 */
export function buildRuleSuggestionPrompt(rule, targetModel, zones) {
  const zoneList = (zones || []).map(z => z.name).join(', ');
  return {
    system: SYSTEM_PROMPT,
    user: `Review this firewall security rule for a PAN-OS to SRX (${targetModel || 'SRX'}) migration and suggest improvements:

Rule: "${rule.name}"
  Action: ${rule.action}
  From zones: ${rule.src_zones?.join(', ') || 'any'}
  To zones: ${rule.dst_zones?.join(', ') || 'any'}
  Source addresses: ${rule.src_addresses?.join(', ') || 'any'}
  Destination addresses: ${rule.dst_addresses?.join(', ') || 'any'}
  Applications: ${rule.applications?.join(', ') || 'any'}
  Services: ${rule.services?.join(', ') || 'any'}
  Logging: start=${rule.log_start}, end=${rule.log_end}
  Disabled: ${rule.disabled}
  ${rule.profile_group ? `Security profile: ${rule.profile_group}` : ''}
  ${rule.tags?.length ? `Tags: ${rule.tags.join(', ')}` : ''}

Available zones: ${zoneList}

Provide 2-4 specific, actionable suggestions for this rule. Focus on security best practices and SRX conversion considerations.`,
  };
}

/**
 * Builds a prompt for reviewing a NAT rule.
 */
export function buildNATSuggestionPrompt(rule, targetModel) {
  return {
    system: SYSTEM_PROMPT,
    user: `Review this NAT rule for a PAN-OS to SRX (${targetModel || 'SRX'}) migration:

NAT Rule: "${rule.name}"
  Type: ${rule.type}
  From zones: ${rule.src_zones?.join(', ') || 'any'}
  To zones: ${rule.dst_zones?.join(', ') || 'any'}
  Source addresses: ${rule.src_addresses?.join(', ') || 'any'}
  Destination addresses: ${rule.dst_addresses?.join(', ') || 'any'}
  Translated source: ${JSON.stringify(rule.translated_src) || 'none'}
  Translated destination: ${rule.translated_dst || 'none'}
  Translated port: ${rule.translated_port || 'none'}

Provide 2-3 specific suggestions for this NAT rule. Focus on SRX NAT rule-set best practices and common pitfalls.`,
  };
}

/**
 * Builds a prompt for general config review.
 */
export function buildConfigReviewPrompt(intermediateConfig, targetModel) {
  const stats = intermediateConfig?.metadata || {};
  return {
    system: SYSTEM_PROMPT,
    user: `Review this firewall policy migration overview for PAN-OS to SRX (${targetModel || 'SRX'}):

Configuration stats:
  Source: PAN-OS ${stats.source_version || 'unknown'}
  Zones: ${stats.zone_count || 0}
  Security rules: ${stats.rule_count || 0}
  NAT rules: ${stats.nat_rule_count || 0}
  Objects: ${stats.object_count || 0}

Zone names: ${(intermediateConfig?.zones || []).map(z => z.name).join(', ')}

Provide 3-4 high-level migration recommendations and potential issues to watch for.`,
  };
}
