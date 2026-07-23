// Deterministic scripted provider for tests and offline demos.
// Responses are dequeued in order; usage is reported so the budget governor
// is exercised exactly as it would be with a live provider.

export class MockProvider {
  /** @param responses Array<{text, usage?:{tokens,usd}}> */
  constructor(responses = []) {
    this.queue = [...responses];
    this.calls = [];
  }

  async complete({ system, user, maxTokens, phase }) {
    this.calls.push({ system, user, maxTokens, phase });
    if (this.queue.length === 0) throw new Error('MockProvider: no scripted response left');
    const r = this.queue.shift();
    return { text: r.text, usage: r.usage ?? { tokens: 1000, usd: 0.01 } };
  }
}