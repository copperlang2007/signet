// Anthropic Messages API adapter. BYOK: key from the founder's environment.
// UNVERIFIED-LIVE: this adapter has unit coverage against a stubbed fetch only;
// no live API call was made during v0.1 validation (no key in the build sandbox).
// See README "Honest limits".

const DEFAULT_MODEL = process.env.SIGNET_MODEL ?? 'claude-sonnet-4-5';

// Pricing table is configuration, not truth — override via SIGNET_USD_PER_MTOK_IN/OUT.
// Parse strictly: a mistyped rate (e.g. "15/mtok") must fail at construction, not silently
// become NaN and disable the dollar cap downstream (RED_TEAM round 5).
function rate(name, def) {
  const raw = process.env[name];
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number, got "${raw}"`);
  return n;
}
function num(label, x) {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Anthropic returned a non-numeric ${label}: ${x}`);
  return n;
}
const USD_PER_MTOK_IN = rate('SIGNET_USD_PER_MTOK_IN', 3);
const USD_PER_MTOK_OUT = rate('SIGNET_USD_PER_MTOK_OUT', 15);

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
    // Validate usage numbers: a malformed response must fail loudly, never feed NaN into the
    // budget governor (which fails closed on non-finite, but the clearer error is here). RED_TEAM r5.
    const inTok = num('input_tokens', data.usage?.input_tokens);
    const outTok = num('output_tokens', data.usage?.output_tokens);
    return {
      text,
      usage: {
        tokens: inTok + outTok,
        usd: +((inTok / 1e6) * USD_PER_MTOK_IN + (outTok / 1e6) * USD_PER_MTOK_OUT).toFixed(6)
      }
    };
  }
}