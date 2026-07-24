// Budget governor: hard caps per contract phase. Never advisory (ADR-0002).
// A cap hit is a ledger event and a thrown error — the loop stops; nothing is silent.

export class BudgetExceededError extends Error {
  constructor(phase, dim, spent, cap) {
    super(`budget cap hit: phase "${phase}" ${dim} — spent ${spent} of cap ${cap}`);
    this.phase = phase; this.dim = dim; this.spent = spent; this.cap = cap;
  }
}

export class BudgetInputError extends Error {}

// A hard cap must fail CLOSED. Provider-reported usage and pricing-env math can produce
// NaN/Infinity/negatives (mistyped SIGNET_USD_PER_MTOK_*, a malformed OpenAI-compatible
// endpoint returning a string token count). If those flowed into the accumulator, `NaN > cap`
// is always false and the cap would be silently, permanently disabled (RED_TEAM round 5).
// So every number entering the governor is validated; a bad number throws loudly instead.
function finiteNonNeg(label, x) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) {
    throw new BudgetInputError(`budget received a non-finite/negative ${label}: ${x} — refusing to run open-loop`);
  }
  return x;
}

export class BudgetGovernor {
  /** @param budget contract.budget  @param ledger Ledger */
  constructor(budget, ledger) {
    // Validate the CAPS themselves, not just spend (RED_TEAM round 6). A non-finite cap
    // (Infinity, or NaN from a mistyped env like SIGNET_INTERROGATION_MAX_TOKENS="60k")
    // makes `spent > cap` always false and silently disables enforcement. The interrogation
    // bootstrap cap is env-derived and bypasses the schema, so this constructor is the only
    // chokepoint that catches it. A cap must fail closed.
    this.caps = new Map(budget.phases.map((p) => [p.name, {
      max_tokens: finiteNonNeg(`cap max_tokens for phase "${p.name}"`, p.max_tokens),
      max_usd: finiteNonNeg(`cap max_usd for phase "${p.name}"`, p.max_usd)
    }]));
    this.spent = new Map(budget.phases.map((p) => [p.name, { tokens: 0, usd: 0 }]));
    this.ledger = ledger;
    // Rehydrate from ledger so restarts cannot forget spend.
    for (const e of ledger?.ofType?.('budget.spend') ?? []) {
      const s = this.spent.get(e.payload.phase);
      if (!s) continue;
      // Guard rehydration too: a NaN smuggled into a hand-edited ledger must not poison the
      // accumulator (which would silently disable the cap). Non-finite entries are ignored;
      // the ledger hash chain independently flags the edit on `verify()`.
      const t = e.payload.tokens, u = e.payload.usd;
      if (Number.isFinite(t) && t >= 0) s.tokens += t;
      if (Number.isFinite(u) && u >= 0) s.usd = +(s.usd + u).toFixed(6);
    }
  }

  /** Record real spend AFTER a provider call. Throws if this spend crossed a cap. */
  record(phase, { tokens = 0, usd = 0, note = '' } = {}) {
    const cap = this.caps.get(phase);
    if (!cap) throw new Error(`unknown budget phase: ${phase}`);
    finiteNonNeg('token spend', tokens); finiteNonNeg('usd spend', usd);
    const s = this.spent.get(phase);
    // Round USD to the cent-thousandth on every accumulation so float drift cannot
    // silently push spend under or over a cap across many increments (RED_TEAM round 1).
    s.tokens += tokens; s.usd = +(s.usd + usd).toFixed(6);
    this.ledger.append('budget.spend', { phase, tokens, usd, note, total_tokens: s.tokens, total_usd: s.usd });
    this.#enforce(phase);
    return { ...s };
  }

  /** Guard BEFORE a provider call with a projected spend. Throws instead of calling. */
  guard(phase, { tokens = 0, usd = 0 } = {}) {
    const cap = this.caps.get(phase);
    if (!cap) throw new Error(`unknown budget phase: ${phase}`);
    finiteNonNeg('projected tokens', tokens); finiteNonNeg('projected usd', usd);
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