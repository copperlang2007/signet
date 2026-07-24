// OpenAI-compatible chat completions adapter — covers OpenAI, OpenRouter, Together,
// Groq, local llama.cpp/ollama servers, and most BYOK endpoints.
// UNVERIFIED-LIVE: unit coverage against stubbed fetch only (see README "Honest limits").

// A malformed/local endpoint must fail loudly, never feed NaN into the budget governor
// (which fails closed; the clearer error is here). RED_TEAM round 5.
function num(label, x) {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) throw new Error(`OpenAI-compatible endpoint returned a non-numeric ${label}: ${x}`);
  return n;
}

export class OpenAICompatProvider {
  constructor({ key, model, baseUrl = 'https://api.openai.com/v1', usdPerMtokIn = 0, usdPerMtokOut = 0, fetchImpl = fetch } = {}) {
    if (!key) throw new Error('OpenAICompatProvider requires an API key (BYOK)');
    if (!model) throw new Error('OpenAICompatProvider requires a model name');
    if (!Number.isFinite(usdPerMtokIn) || usdPerMtokIn < 0 || !Number.isFinite(usdPerMtokOut) || usdPerMtokOut < 0) {
      throw new Error('OpenAICompatProvider pricing (usdPerMtokIn/Out) must be non-negative numbers');
    }
    this.key = key; this.model = model; this.baseUrl = baseUrl;
    this.usdIn = usdPerMtokIn; this.usdOut = usdPerMtokOut; this.fetch = fetchImpl;
  }

  async complete({ system, user, maxTokens = 4096 }) {
    const res = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI-compatible API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    const inTok = num('prompt_tokens', data.usage?.prompt_tokens ?? 0);
    const outTok = num('completion_tokens', data.usage?.completion_tokens ?? 0);
    return {
      text,
      usage: {
        tokens: inTok + outTok,
        usd: +((inTok / 1e6) * this.usdIn + (outTok / 1e6) * this.usdOut).toFixed(6)
      }
    };
  }
}