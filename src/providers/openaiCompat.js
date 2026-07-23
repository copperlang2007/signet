// OpenAI-compatible chat completions adapter — covers OpenAI, OpenRouter, Together,
// Groq, local llama.cpp/ollama servers, and most BYOK endpoints.
// UNVERIFIED-LIVE: unit coverage against stubbed fetch only (see README "Honest limits").

export class OpenAICompatProvider {
  constructor({ key, model, baseUrl = 'https://api.openai.com/v1', usdPerMtokIn = 0, usdPerMtokOut = 0, fetchImpl = fetch } = {}) {
    if (!key) throw new Error('OpenAICompatProvider requires an API key (BYOK)');
    if (!model) throw new Error('OpenAICompatProvider requires a model name');
    this.key = key; this.model = model; this.baseUrl = baseUrl;
    this.usdIn = usdPerMtokIn; this.usdOut = usdPerMtokOut; this.fetch = fetchImpl;
  }

  async complete({ system, user, maxTokens = 4096 }) {
    const res = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json` },
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
    const inTok = data.usage?.prompt_tokens ?? 0;
    const outTok = data.usage?.completion_tokens ?? 0;
    return {
      text,
      usage: {
        tokens: inTok + outTok,
        usd: +((inTok / 1e6) * this.usdIn + (outTok / 1e6) * this.usdOut).toFixed(6)
      }
    };
  }
}