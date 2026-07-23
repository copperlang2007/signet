// Anthropic Messages API adapter. BYOK: key from the founder'''s environment.
// UNVERIFIED-LIVE: this adapter has unit coverage against a stubbed fetch only;
// no live API call was made during v0.1 validation (no key in the build sandbox).
// See README "Honest limits".

const DEFAULT_MODEL = process.env.SIGNET_MODEL ?? 'claude-sonnet-4-5';

// Pricing table is configuration, not truth — override via SIGNET_USD_PER_MTOK_IN/OUT.
const USD_PER_MTOK_IN = Number(process.env.SIGNET_USD_PER_MTOK_IN ?? 3);
const USD_PER_MTOK_OUT = Number(process.env.SIGNET_USD_PER_MTOK_OUT ?? 15);

export class AnthropicProvider {
  constructor({ key, model = DEFAULT_MODEL, baseUrl = 'https://api.anthropic.com', fetchImpl = fetch } = {}) {
    if (!key) throw new Error('AnthropicProvider requires an API key (BYOK)');
    this.key = key; this.model = model; this.baseUrl = baseUrl; this.fetch = fetchImpl;
  }

  async complete({ system, user, maxTokens = 4096 }) {
    const res = await this.fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const inTok = data.usage?.input_tokens ?? 0;
    const outTok = data.usage?.output_tokens ?? 0;
    return {
      text,
      usage: {
        tokens: inTok + outTok,
        usd: +((inTok / 1e6) * USD_PER_MTOK_IN + (outTok / 1e6) * USD_PER_MTOK_OUT).toFixed(6)
      }
    };
  }
}