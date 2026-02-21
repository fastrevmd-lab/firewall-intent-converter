/**
 * Unified LLM API Client
 * ========================
 * Phase 3 Feature
 *
 * Provides a unified interface for communicating with different LLM providers.
 * API keys are stored in the browser's localStorage and sent directly from
 * the frontend to the LLM provider — never touching this server.
 *
 * Supported providers (Phase 3):
 *   - Claude (Anthropic) — default
 *   - OpenAI (GPT-4o, GPT-4-turbo)
 *   - Ollama (local)
 *   - LM Studio (local)
 *   - Custom OpenAI-compatible endpoint
 *
 * This server-side module provides helper functions for prompt construction;
 * actual API calls happen client-side.
 */

/**
 * Builds a system prompt for the interview LLM based on the parsed config context.
 * Phase 3 implementation.
 *
 * @param {Object} intermediateConfig - Parsed intermediate JSON
 * @returns {string} - System prompt for the LLM
 */
export function buildInterviewSystemPrompt(intermediateConfig) {
  return 'You are a firewall policy conversion expert. Help the user resolve ambiguities in their PAN-OS to SRX conversion.';
}
