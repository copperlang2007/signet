// Governed build loop (v1-minimal, real): every increment must cite acceptance
// criteria from the locked contract or it is rejected as drift — recorded, not absorbed.
// The loop consults the budget governor BEFORE and records spend AFTER every
// provider call. Human-decision gates pause the loop; the founder's job is decisions.

import { verifyLock } from '../contract/lock.js';
import { GateEngine } from '../gates/engine.js';

export class DriftRejectedError extends Error {
  constructor(ids) { super(`increment rejected as scope drift: cites no valid criteria (${ids.join(', ') || 'none cited'})`); this.ids = ids; }
}

export class BuildLoop {
  /**
   * @param contract locked contract
   * @param provider { complete({system,user,maxTokens,phase}) → {text, usage:{tokens,usd}} }
   * @param ledger Ledger
   * @param governor BudgetGovernor
   */
  constructor(contract, provider, ledger, governor, cwd = process.cwd(), { allowCommands = false } = {}) {
    verifyLock(contract);
    this.contract = contract;
    this.provider = provider;
    this.ledger = ledger;
    this.governor = governor;
    this.gates = new GateEngine(contract, ledger, cwd, { allowCommands });
  }

  #validCriteria(ids) {
    const known = new Set(this.contract.acceptance_criteria.map((c) => c.id));
    return Array.isArray(ids) && ids.length > 0 && ids.every((i) => known.has(i));
  }

  /**
   * Execute one governed increment.
   * @param phase budget phase name
   * @param intent plain-language description of the increment
   * @param criterionIds acceptance criteria this increment serves — REQUIRED
   * @param projected {tokens, usd} projected spend, guarded before the call
   */
  async increment({ phase, intent, criterionIds, projected = { tokens: 4000, usd: 0.1 } }) {
    verifyLock(this.contract);

    if (!this.#validCriteria(criterionIds)) {
      this.ledger.append('drift.rejected', { phase, intent, cited: criterionIds ?? [] });
      throw new DriftRejectedError(criterionIds ?? []);
    }

    const criteria = criterionIds.map((id) => this.gates.criterion(id));
    const system = [
      'You are the builder bound by a locked Signet Build Contract.',
      'You may ONLY work toward the acceptance criteria cited below.',
      'Anything outside them is scope drift and will be rejected. Do not add features, files, or dependencies the criteria do not require.',
      'No-go list (absolute): ' + this.contract.no_go.join('; ')
    ].join('
');
    const user = [
      `Increment intent: ${intent}`,
      'Cited acceptance criteria:',
      ...criteria.map((c) => `- [${c.id}] ${c.statement}`)
    ].join('
');

    // Budget enforcement around the call (RED_TEAM rounds 4–5). What is GUARANTEED:
    //   (1) no call is issued once the phase cap is already reached (guard throws first);
    //   (2) the model's OUTPUT is bounded to the remaining token budget via maxTokens;
    //   (3) any overshoot from input-estimate error is caught on record() below, which
    //       throws loudly and halts the run — a crossing call's spend is real but no
    //       further call proceeds.
    // What is NOT claimed: that a single call can never overshoot at all. Input tokens are
    // ESTIMATED from character length; ~3 chars/token is tighter than the ~4 English average
    // but is not a hard upper bound for dense/non-English/code input. Honesty over bravado —
    // see README "Budget".
    const MAX_OUT = Number(process.env.SIGNET_MAX_OUTPUT_TOKENS ?? 4096);
    const remainTokens = this.governor.remaining(phase).tokens;
    const estIn = Math.ceil((system.length + user.length) / 3);
    const maxTokens = Math.max(1, Math.min(MAX_OUT, remainTokens - estIn));
    const worstCaseTokens = Math.max(projected.tokens ?? 0, estIn + maxTokens);
    this.governor.guard(phase, { tokens: worstCaseTokens, usd: projected.usd ?? 0 }); // throws BEFORE spending

    const res = await this.provider.complete({ system, user, phase, maxTokens });
    this.governor.record(phase, { tokens: res.usage?.tokens ?? 0, usd: res.usage?.usd ?? 0, note: intent });
    this.ledger.append('build.increment', { phase, intent, criteria: criterionIds, output_chars: res.text?.length ?? 0 });

    // Verify immediately: an increment is not "done" until its gates run.
    const results = criterionIds.map((id) => this.gates.evaluate(id));
    return { output: res.text, gates: results };
  }
}