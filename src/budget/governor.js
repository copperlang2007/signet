// Budget governor: hard caps per contract phase. Never advisory (ADR-0002).
// A cap hit is a ledger event and a thrown error — the loop stops; nothing is silent.

export class BudgetExceededError extends Error {
  constructor(phase, dim, spent, cap) {
    super(`budget cap hit: phase "${phase}" ${dim} — spent ${spent} of cap ${cap}`);
    this.phase = phase; this.dim = dim; this.spent = spent; this.cap = cap;
  }
}

export class BudgetGovernor {
  /** @param budget contract.budget  @param ledger Ledger */
  constructor(budget, ledger) {
    this.caps = new Map(budget.phases.map((p) => [p.name, { max_tokens: p.max_tokens, max_usd: p.max_usd }]));
    this.spent = new Map(budget.phases.map((p) => [p.name, { tokens: 0, usd: 0 }]));
    this.ledger = ledger;
    // Rehydrate from ledger so restarts cannot forget spend.
    for (const e of ledger?.ofType?.('budget.spend') ?? []) {
      const s = this.spent.get(e.payload.phase);
      if (s) { s.tokens += e.payload.tokens ?? 0; s.usd += e.payload.usd ?? 0; }
    }
  }

  /** Record real spend AFTER a provider call. Throws if this spend crossed a cap. */
  record(phase, { tokens = 0, usd = 0, note = '' } = {}) {
    const cap = this.caps.get(phase);
    if (!cap) throw new Error(`unknown budget phase: ${phase}`);
    const s = this.spent.get(phase);
    s.tokens += tokens; s.usd += usd;
    this.ledger.append('budget.spend', { phase, tokens, usd, note, total_tokens: s.tokens, total_usd: s.usd });
    this.#enforce(phase);
    return { ...s };
  }

  /** Guard BEFORE a provider call with a projected spend. Throws instead of calling. */
  guard(phase, { tokens = 0, usd = 0 } = {}) {
    const cap = this.caps.get(phase);
    if (!cap) throw new Error(`unknown budget phase: ${phase}`);
    const s = this.spent.get(phase);
    if (s.tokens + tokens > cap.max_tokens) this.#hit(phase, 'tokens', s.tokens + tokens, cap.max_tokens);
    if (s.usd + usd > cap.max_usd) this.#hit(phase, 'usd', s.usd + usd, cap.max_usd);
    return true;
  }

  remaining(phase) {
    const cap = this.caps.get(phase); const s = this.spent.get(phase);
    if (!cap) throw new Error(`unknown budget phase: ${phase}`);
    return { tokens: Math.max(0, cap.max_tokens - s.tokens), usd: Math.max(0, +(cap.max_usd - s.usd).toFixed(6)) };
  }

  summary() {
    return [...this.caps.entries()].map(([name, cap]) => ({
      phase: name, cap, spent: { ...this.spent.get(name) }, remaining: this.remaining(name)
    }));
  }

  #enforce(phase) {
    const cap = this.caps.get(phase); const s = this.spent.get(phase);
    if (s.tokens > cap.max_tokens) this.#hit(phase, 'tokens', s.tokens, cap.max_tokens);
    if (s.usd > cap.max_usd) this.#hit(phase, 'usd', s.usd, cap.max_usd);
  }

  #hit(phase, dim, spent, cap) {
    this.ledger.append('budget.cap_hit', { phase, dim, spent, cap });
    throw new BudgetExceededError(phase, dim, spent, cap);
  }
}