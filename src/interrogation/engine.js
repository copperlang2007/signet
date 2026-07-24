// Interrogation engine: brief → adversarial questions → answers → draft contract.
// A deterministic state machine around provider calls; every step is a ledger event,
// so the eventual funding pack can cite the exact question that shaped the product.

import { INTERROGATOR_SYSTEM, DRAFTER_SYSTEM, extractJson } from './prompts.js';
import { validateContract, CONTRACT_VERSION } from '../contract/schema.js';

const PHASE = 'interrogation';

export class Interrogation {
  /** @param provider BYOK provider  @param ledger Ledger  @param governor BudgetGovernor|null */
  constructor(provider, ledger, governor = null) {
    this.provider = provider;
    this.ledger = ledger;
    this.governor = governor;
    this.state = 'idle'; // idle → questioned → answered → drafted
    this.brief = null;
    this.questions = [];
    this.answers = {};
    this.draft = null;
  }

  #spend(usage, note) {
    if (this.governor) this.governor.record(PHASE, { tokens: usage?.tokens ?? 0, usd: usage?.usd ?? 0, note });
  }

  /** Ingest the brief; produce 5–9 adversarial questions. */
  async start(briefText) {
    if (this.state !== 'idle') throw new Error(`cannot start from state ${this.state}`);
    this.brief = briefText;
    this.ledger.append('interrogation.started', { brief_chars: briefText.length });
    if (this.governor) this.governor.guard(PHASE, { tokens: 6000, usd: 0.2 });
    const res = await this.provider.complete({ system: INTERROGATOR_SYSTEM, user: briefText, phase: PHASE });
    this.#spend(res.usage, 'interrogation questions');
    const parsed = extractJson(res.text);
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('interrogator returned no questions');
    }
    for (const q of parsed.questions) {
      if (!q.id || !q.question || !q.default_if_unanswered) {
        throw new Error(`malformed question: ${JSON.stringify(q).slice(0, 120)}`);
      }
      this.ledger.append('interrogation.question', q);
    }
    this.questions = parsed.questions;
    this.state = 'questioned';
    return this.questions;
  }

  /** Record a founder answer (or explicitly accept the default). */
  answer(id, text) {
    if (this.state !== 'questioned' && this.state !== 'answered') throw new Error(`cannot answer in state ${this.state}`);
    const q = this.questions.find((x) => x.id === id);
    if (!q) throw new Error(`unknown question id: ${id}`);
    this.answers[id] = text;
    this.ledger.append('interrogation.answer', { id, answer: text });
    this.state = 'answered';
  }

  /** Draft the contract. Unanswered questions use their stated defaults. */
  async draftContract() {
    if (this.state !== 'questioned' && this.state !== 'answered') throw new Error(`cannot draft in state ${this.state}`);
    const qa = this.questions.map((q) => ({
      question: q.question,
      category: q.category,
      answer: this.answers[q.id] ?? `(unanswered — use stated default: ${q.default_if_unanswered})`
    }));
    const user = ['BUILD BRIEF:', this.brief, '', 'INTERROGATION Q&A:', JSON.stringify(qa, null, 2)].join('
');
    if (this.governor) this.governor.guard(PHASE, { tokens: 12000, usd: 0.5 });
    const res = await this.provider.complete({ system: DRAFTER_SYSTEM, user, phase: PHASE, maxTokens: 8192 });
    this.#spend(res.usage, 'contract draft');
    const draft = extractJson(res.text);
    draft.meta = { ...draft.meta, version: CONTRACT_VERSION, created: draft.meta?.created ?? new Date().toISOString() };
    const { ok, errors } = validateContract(draft);
    if (!ok) throw new Error('drafted contract failed schema validation:
- ' + errors.join('
- '));
    this.draft = draft;
    this.state = 'drafted';
    this.ledger.append('interrogation.drafted', {
      title: draft.meta.title,
      criteria: draft.acceptance_criteria.length,
      no_go: draft.no_go.length,
      phases: draft.budget.phases.map((p) => p.name)
    });
    return draft;
  }
}