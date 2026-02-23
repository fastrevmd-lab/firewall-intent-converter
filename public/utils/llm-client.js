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
// Default System Prompt
// ---------------------------------------------------------------------------

export const DEFAULT_SYSTEM_PROMPT = `You are an expert multi-vendor firewall policy engineer specializing in migrations to Juniper SRX. You support PAN-OS, FortiGate/FortiOS, Cisco ASA/FTD, and Junos SRX as source platforms. You provide concise, actionable best-practice suggestions grounded in specific Junos CLI syntax.

## Zone Architecture
- Strict zone segmentation: trust, untrust, dmz, management, and dedicated partner/vendor zones
- host-inbound-traffic restricted per zone — only allow required protocols (e.g., ssh/ping on management; nothing unnecessary on untrust)
- Never bind management interface (fxp0) to a transit zone
- Every zone should have a screen profile applied for DoS protection
- Prefer global address-book for simplicity — addresses available across all zones and NAT rules

## Policy Design
- Default deny-all cleanup rule per zone pair: then { deny; log { session-init; } }
- Most specific rules first, broadest last — SRX evaluates top-down, first match wins
- Use unified policies (Junos 18.2+) with application identification for NGFW capability
- Avoid any/any/any open rules — flag as critical security issues
- Descriptive names (max 63 chars, alphanumeric + hyphen + underscore, no spaces)
- Add description on every rule explaining business justification
- Review disabled/deactivated rules for removal — audit flags and configuration clutter
- Use address-sets and application-sets to reduce rule count

## Logging
- log session-close on all permit rules (captures byte/packet counts after session ends)
- log session-init on all deny/reject rules (captures blocked connection attempts)
- Avoid enabling both session-init AND session-close on same rule — performance impact
- Forward to remote syslog over TLS for encryption in transit
- Use structured syslog (sd-syslog) for SIEM ingestion
- Always set source-address on syslog forwarding to identify the SRX device

## Security Profiles
### IDP
- Use predefined policy templates as starting point (Recommended, DMZ_Services)
- Apply IDP on trust→untrust and dmz→untrust zone pairs minimum
- Install signature database: request security idp security-package install
- For Junos 18.2+, assign IDP policies per rule via unified policies

### UTM
- Antivirus on HTTP, SMTP, FTP, IMAP protocols
- Web filtering (EWF or local) on outbound web traffic
- Content filtering for file-type blocking
- Anti-spam on inbound SMTP
- Bundle profiles into UTM policy, reference with: then permit { application-services { utm-policy <name>; } }

### Application Firewall / AppID
- Prefer AppID over port-only matching
- SSL proxy may be required to identify encrypted applications
- For Junos 18.2+, use unified policies instead of legacy AppFW rule-sets

### SecIntel (requires A1+ subscription)
- Provides threat intelligence feeds: C&C IPs, infected hosts, GeoIP, malicious URLs
- Requires ATP Cloud enrollment for full functionality (P1/P2)

## NAT
- SRX NAT order of operations: Static NAT and Destination NAT before security policy; Source NAT after policy
- Security policies must reference the real (post-NAT) IP for destination NAT, not the translated IP
- Proxy ARP is mandatory for destination/static NAT when translated IP is not on an SRX interface
- Static NAT is bidirectional and has highest priority
- Use rule-set organization by zone pair for clarity
- Interface-based source NAT (then source-nat interface) for simple internet access

## VPN / IPsec
- Prefer IKEv2 over IKEv1 — fewer exchanges, better DoS resistance, faster SA setup
- Enable Perfect Forward Secrecy (PFS) — minimum group14 (DH-2048)
- Use strong encryption: AES-256-GCM for IKE and IPsec; avoid 3DES, DES, MD5
- Route-based VPNs (st0 tunnels) preferred over policy-based for flexibility
- Ensure st0 tunnel unit is in the correct security zone
- Enable Dead Peer Detection: set security ike gateway <name> dead-peer-detection
- Proxy IDs / traffic selectors must match on both peers — common migration pitfall
- Recommended IKE: sha-256+, aes-256-gcm, group20 (group14 minimum)
- Recommended IPsec: esp, aes-256-gcm, lifetime 3600s

## Screens / DDoS Protection
- Screens are processed before security policy — minimal performance impact
- Apply per zone; untrust needs strictest settings
- Recommended minimums: tcp syn-flood (alarm 1024, attack 200, dest 2048), land, winnuke, syn-frag; udp flood (threshold 1000); icmp ping-death, flood (threshold 1000); ip bad-option, source-route-option, spoofing

## HA / Chassis Cluster
- Both nodes must have identical hardware, software versions, and license keys
- Redundancy group 0 for routing engine; group 1+ for interface (reth) redundancy
- Active/passive for simplicity; active/active only when traffic engineering requires it
- Control link and fabric link must be on dedicated physical ports

## Routing
- Static routes: set routing-options static route <dest> next-hop <nh>
- VRF / routing-instances for network segmentation
- Logical systems for multi-vsys migration from PAN-OS (multiple routing instances, advanced routing)
- Tenant systems for VDOM migration from FortiGate (one routing instance per tenant, scales to more tenants)

## Vendor-Specific Migration Pitfalls

### PAN-OS → SRX
- "application-default" → verify SRX AppID coverage; unmapped apps need custom application definitions
- Security profile groups → individual SRX UTM/IDP policies (no 1:1 group concept)
- Tags → preserve as description fields or comments
- "drop" → "deny" (silent drop), "reset-client/server/both" → "reject"
- Disabled rules → "deactivate" statement
- PAN-OS vsys → SRX logical-system (if multi-vsys)

### FortiGate → SRX
- "accept" → "permit", "deny" → "deny"
- VIP objects (DNAT) → SRX destination NAT rule-sets with proxy-ARP
- IP pools (SNAT) → SRX source NAT rule-sets with pools
- UTM profiles (AV, web-filter, IPS, app-control) → SRX UTM policies + IDP policies
- VDOM → SRX logical-system or tenant-system
- internet-service-id has no direct SRX equivalent — decompose to IP/port
- FQDN addresses → SRX dns-name; wildcard-fqdn not supported on SRX

### Cisco ASA/FTD → SRX
- ACL-based model (interface + direction + ACL) → SRX zone-based model (from-zone/to-zone)
- Security levels determine implicit trust — SRX has no implicit trust, every zone pair needs explicit policy
- nameif + security-level → explicit SRX security zones
- object-group → SRX address-set / application-set
- Twice-NAT (manual NAT) → SRX static NAT with source + destination translation
- Auto-NAT (object NAT) → SRX source/destination NAT rule-sets
- inspect fixups → SRX ALG configurations
- threat-detection → SRX screen options

### SRX → SRX
- Validate deprecated syntax (zone-based vs global address-book)
- Check AppID signature compatibility between Junos versions
- Verify chassis cluster compatibility if upgrading hardware

## Rule Shadowing
- A shadowed rule never matches because a broader rule above already handles all matching packets
- Flag: fully shadowed, partially shadowed, redundant, and contradictory rules
- Resolution: place most specific rules higher; remove fully shadowed; merge redundant
- Same zones + overlapping addresses + overlapping services but different action = contradiction

## Compliance
- PCI DSS v4.0 (mandatory since March 2025): explicit deny-all (1.2.1), all allowed services/ports must have documented business need (1.2.5), review configs at least every 6 months (1.2.7), inbound/outbound CDE traffic limited to necessity (1.3.1/1.3.2)
- NIST SP 800-41r1: segment by sensitivity, log all denied traffic, annual review, test rules before deployment, document every rule with business justification
- CIS Juniper OS Benchmark v2.1.0: disable unused services, restrict management access, enforce password complexity, NTP with auth, SNMP v3 only`;

// ---------------------------------------------------------------------------
// System Prompt Loader
// ---------------------------------------------------------------------------

/**
 * Loads the system prompt from localStorage or falls back to DEFAULT_SYSTEM_PROMPT.
 */
export function loadSystemPrompt() {
  try {
    const saved = localStorage.getItem('llm-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      if (settings.systemPrompt && settings.systemPrompt.trim()) {
        return settings.systemPrompt;
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_SYSTEM_PROMPT;
}

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
 * Multi-turn chat support. Sends a messages array to the configured LLM.
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @param {string} [systemPrompt] - System prompt
 * @returns {Promise<string>} - The LLM response text
 */
export async function getLLMChatResponse(messages, systemPrompt = '') {
  const settings = loadSettings();

  if (!settings.provider) {
    throw new Error('No LLM provider configured. Open Settings to configure one.');
  }

  switch (settings.provider) {
    case 'claude':
      return callClaudeChat(settings, messages, systemPrompt);
    case 'openai':
      return callOpenAIChat(settings, messages, systemPrompt);
    case 'ollama':
      return callOllamaChat(settings, messages, systemPrompt);
    case 'lmstudio':
      return callLMStudioChat(settings, messages, systemPrompt);
    case 'custom':
      return callCustomChat(settings, messages, systemPrompt);
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
// Provider Implementations — Single message
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
// Provider Implementations — Multi-turn chat
// ---------------------------------------------------------------------------

async function callClaudeChat(settings, messages, systemPrompt) {
  if (!settings.apiKey) {
    throw new Error('Claude API key not configured. Open Settings to add your Anthropic API key.');
  }

  const body = {
    model: settings.model || 'claude-sonnet-4-6',
    max_tokens: settings.maxTokens || 2048,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
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

async function callOpenAIChat(settings, messages, systemPrompt) {
  if (!settings.apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  const allMessages = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o',
      messages: allMessages,
      temperature: settings.temperature ?? 0.2,
      max_tokens: settings.maxTokens || 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from OpenAI.';
}

async function callOllamaChat(settings, messages, systemPrompt) {
  const baseUrl = settings.baseUrl || 'http://localhost:11434';

  const allMessages = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model || 'llama3',
      messages: allMessages,
      stream: false,
      options: { temperature: settings.temperature ?? 0.2 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}. Is Ollama running at ${baseUrl}?`);
  }

  const data = await response.json();
  return data.message?.content || 'No response from Ollama.';
}

async function callLMStudioChat(settings, messages, systemPrompt) {
  const baseUrl = settings.baseUrl || 'http://localhost:1234';

  const allMessages = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model || 'local-model',
      messages: allMessages,
      temperature: settings.temperature ?? 0.2,
      max_tokens: settings.maxTokens || 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.status}. Is LM Studio running at ${baseUrl}?`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from LM Studio.';
}

async function callCustomChat(settings, messages, systemPrompt) {
  if (!settings.baseUrl) {
    throw new Error('Custom endpoint URL not configured.');
  }

  const allMessages = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  const response = await fetch(`${settings.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model || 'default',
      messages: allMessages,
      temperature: settings.temperature ?? 0.2,
      max_tokens: settings.maxTokens || 2048,
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

/** Returns a friendly vendor label from the source_vendor code. */
function vendorLabel(sourceVendor) {
  switch (sourceVendor) {
    case 'panos': return 'PAN-OS';
    case 'srx': return 'Junos SRX';
    case 'fortigate': return 'FortiGate';
    case 'cisco_asa': return 'Cisco ASA/FTD';
    default: return sourceVendor || 'firewall';
  }
}

/**
 * Builds a prompt asking the LLM to review a security rule (legacy free-text).
 */
export function buildRuleSuggestionPrompt(rule, targetModel, zones, sourceVendor) {
  const zoneList = (zones || []).map(z => z.name).join(', ');
  const vendor = vendorLabel(sourceVendor);
  return {
    system: loadSystemPrompt(),
    user: `Review this firewall security rule for a ${vendor} to SRX (${targetModel || 'SRX'}) migration and suggest improvements:

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
 * Builds a structured rule suggestion prompt that instructs the LLM to respond with JSON.
 */
export function buildStructuredRuleSuggestionPrompt(rule, targetModel, zones, srxLicense, srxContext, sourceVendor) {
  const zoneList = (zones || []).map(z => z.name).join(', ');
  const systemPrompt = loadSystemPrompt();

  const licenseContext = srxLicense ? `

SUBSCRIPTION CONTEXT:
The target SRX subscription: ${srxLicense}
- Base (no subscriptions): Stateful FW, SSL B&I, Full Routing, VxLAN included
- A1 (Advanced Data Protection): Base + SDC, AppSecure, IPS, & SecIntel
- A2 (Advanced Edge Protection): Base, A1 subs, and URL + Content filtering
- P1 (Premium Data Protection): Base, A1 subs, and ATP Cloud
- P2 (Premium Edge Protection): Base, A2 subs, and ATP Cloud
If this rule uses security features requiring a higher subscription than ${srxLicense}, flag this in your analysis and suggest alternatives available at the ${srxLicense} subscription.` : '';

  // Build security profiles summary
  const profileEntries = Object.entries(rule.security_profiles || {});
  const profileSummary = profileEntries.length > 0
    ? profileEntries.map(([t, n]) => `${t}=${n}`).join(', ')
    : rule.profile_group || '(none)';

  return {
    system: systemPrompt + `

IMPORTANT: You MUST respond with ONLY valid JSON in the exact format below. No markdown fences, no extra text.

{
  "analysis": "Brief 1-2 sentence review of the rule",
  "suggestions": [
    {
      "field": "field_name",
      "current": "current_value",
      "suggested": "new_value",
      "reason": "Why this change is recommended"
    }
  ],
  "verdict": "needs_changes" or "looks_good"
}

Valid field names and their types:
- name (string), action (string: allow/deny/drop/reject), description (string)
- src_zones (array), dst_zones (array), src_addresses (array), dst_addresses (array)
- applications (array), services (array)
- log_start (boolean), log_end (boolean), disabled (boolean)
- profile_group (string), tags (array)

For array fields, use JSON arrays like ["value1", "value2"].
For boolean fields, use true or false (no quotes).` + licenseContext,

    user: `Review this firewall security rule being migrated from ${vendorLabel(sourceVendor)} to SRX (${targetModel || 'SRX'})${srxLicense ? ` (license: ${srxLicense})` : ''}:

=== ORIGINAL ${vendorLabel(sourceVendor).toUpperCase()} RULE ===
Rule: "${rule.name}"
  Action: ${rule.action}
  From zones: ${(rule.src_zones || []).join(', ') || 'any'}
  To zones: ${(rule.dst_zones || []).join(', ') || 'any'}
  Source addresses: ${(rule.src_addresses || []).join(', ') || 'any'}${rule.negate_source ? ' [NEGATED — match all EXCEPT these]' : ''}
  Destination addresses: ${(rule.dst_addresses || []).join(', ') || 'any'}${rule.negate_destination ? ' [NEGATED — match all EXCEPT these]' : ''}
  Applications: ${(rule.applications || []).join(', ') || 'any'}
  Services: ${(rule.services || []).join(', ') || 'any'}
  Logging: start=${rule.log_start}, end=${rule.log_end}
  Disabled: ${rule.disabled}
  Description: ${rule.description || '(none)'}
  Security profiles: ${profileSummary}${rule.profile_group ? ` (from group: ${rule.profile_group})` : ''}
  Tags: ${(rule.tags || []).join(', ') || '(none)'}
${srxContext ? `
=== SRX TRANSLATION (current user edits) ===
  Action: ${srxContext.action}
  Application Services: ${srxContext.applicationServices?.join(', ') || 'none'}
  Logging: ${srxContext.logging?.join(', ') || 'none'}
` : ''}
Available zones: ${zoneList}

Review both the original ${vendorLabel(sourceVendor)} rule and its SRX translation. Identify any issues with the migration mapping, missing security features, or best-practice violations on the SRX side. Respond with ONLY the JSON object.`,
  };
}

/**
 * Builds a prompt for reviewing a NAT rule.
 */
export function buildNATSuggestionPrompt(rule, targetModel, sourceVendor) {
  const vendor = vendorLabel(sourceVendor);
  return {
    system: loadSystemPrompt(),
    user: `Review this NAT rule for a ${vendor} to SRX (${targetModel || 'SRX'}) migration:

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
  const vendor = vendorLabel(stats.source_vendor);
  return {
    system: loadSystemPrompt(),
    user: `Review this firewall policy migration overview for ${vendor} to SRX (${targetModel || 'SRX'}):

Configuration stats:
  Source: ${vendor} ${stats.source_version || 'unknown'}
  Zones: ${stats.zone_count || 0}
  Security rules: ${stats.rule_count || 0}
  NAT rules: ${stats.nat_rule_count || 0}
  Objects: ${stats.object_count || 0}
  VPN tunnels: ${stats.vpn_tunnel_count || 0}
  Static routes: ${stats.static_route_count || 0}

Zone names: ${(intermediateConfig?.zones || []).map(z => z.name).join(', ')}

Provide 3-4 high-level migration recommendations and potential issues to watch for.`,
  };
}

/**
 * Builds the initial prompt for full-ruleset review chat.
 */
export function buildFullReviewPrompt(intermediateConfig, targetModel, srxLicense) {
  const policies = intermediateConfig?.security_policies || [];

  const licenseAnalysis = srxLicense ? `

SUBSCRIPTION ANALYSIS:
The target SRX subscription: ${srxLicense}
- Base (no subscriptions): Stateful FW, SSL B&I, Full Routing, VxLAN included
- A1 (Advanced Data Protection): Base + SDC, AppSecure, IPS, & SecIntel
- A2 (Advanced Edge Protection): Base, A1 subs, and URL + Content filtering
- P1 (Premium Data Protection): Base, A1 subs, and ATP Cloud
- P2 (Premium Edge Protection): Base, A2 subs, and ATP Cloud
Flag any rules that use security features requiring a higher subscription than ${srxLicense}. Specifically:
- URL/Content filtering requires A2+
- ATP Cloud features require P1 or P2
- IPS/AppSecure/SecIntel require A1+
Suggest alternatives or configuration adjustments for features not covered by the ${srxLicense} subscription.` : '';

  const systemPrompt = loadSystemPrompt() + `

When reviewing the full ruleset, also analyze:
- Rule ordering: are most-specific rules first?
- Redundancy: are there overlapping or shadowed rules?
- Missing cleanup rules: is there a deny-all at the end of each zone pair?
- Inconsistent logging: are all permits logging session-close?
- Zone gaps: are there zone pairs with no policies?
- Security profile coverage: which rules lack UTM/IDP profiles?

When suggesting changes to specific rules, include a JSON code block with this format:
\`\`\`json
{"rule_name": "the-rule-name", "field": "field_name", "current": "current_value", "suggested": "new_value", "reason": "Why this change"}
\`\`\`

You may include multiple JSON blocks in your response, interspersed with explanatory text.` + licenseAnalysis;

  // Build compact one-line-per-rule summary
  const ruleSummary = policies.map((r, i) => {
    const src = (r.src_zones || []).join(',') || 'any';
    const dst = (r.dst_zones || []).join(',') || 'any';
    const apps = (r.applications || []).join(',') || 'any';
    const svcs = (r.services || []).join(',') || 'any';
    const profileInfo = Object.entries(r.security_profiles || {}).map(([t, n]) => `${t}=${n}`).join(',');
    const flags = [
      r.disabled ? 'DISABLED' : '',
      r.log_end ? 'logE' : '',
      r.log_start ? 'logS' : '',
      r.profile_group ? `prof=${r.profile_group}` : '',
      profileInfo ? `profiles=[${profileInfo}]` : '',
    ].filter(Boolean).join(' ');
    return `${i + 1}. [${r.action}] "${r.name}" ${src}->${dst} apps=${apps} svc=${svcs} ${flags}`;
  }).join('\n');

  return {
    system: systemPrompt,
    user: `Review this complete firewall ruleset (${policies.length} rules) for a ${vendorLabel(intermediateConfig?.metadata?.source_vendor)} to SRX (${targetModel || 'SRX'}) migration.${srxLicense ? ` Target license: ${srxLicense}.` : ''} Identify issues, suggest improvements, and flag any security concerns.

Ruleset:
${ruleSummary}

Zones: ${(intermediateConfig?.zones || []).map(z => z.name).join(', ')}

Provide a thorough analysis with specific, actionable recommendations. Use JSON code blocks for rule-specific changes.`,
  };
}
