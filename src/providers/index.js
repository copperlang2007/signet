// BYOK provider adapters (ADR-0004). Signet never holds keys server-side —
// there is no server. Keys come from the founder's own environment variables.
// Interface: provider.complete({system, user, maxTokens?, phase?}) → { text, usage: { tokens, usd } }

import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatProvider } from './openaiCompat.js';
import { MockProvider } from './mock.js';

export { AnthropicProvider, OpenAICompatProvider, MockProvider };

export function providerFromEnv(name = process.env.SIGNET_PROVIDER ?? 'anthropic') {
  if (name === 'anthropic') {
    const key = process.env.SIGNET_ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('set SIGNET_ANTHROPIC_KEY (or ANTHROPIC_API_KEY) — Signet is bring-your-own-keys');
    return new AnthropicProvider({ key });
  }
  if (name === 'openai-compat') {
    const key = process.env.SIGNET_OPENAI_KEY ?? process.env.OPENAI_API_KEY;
    const model = process.env.SIGNET_OPENAI_MODEL;
    const baseUrl = process.env.SIGNET_OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
    if (!key || !model) throw new Error('set SIGNET_OPENAI_KEY and SIGNET_OPENAI_MODEL (BYOK)');
    return new OpenAICompatProvider({ key, model, baseUrl });
  }
  if (name === 'mock') throw new Error('mock provider must be constructed in code with scripted responses');
  throw new Error(`unknown provider: ${name}. Use anthropic | openai-compat.`);
}