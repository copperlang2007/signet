// GENESIS: Signet builds its own contract — the engine\'s first real run.
// Real engine paths throughout (interrogation state machine, schema validation,
// locking, ledger, budget governor, gates, drift rejection, tamper detection).
// Model content is replayed via MockProvider — see scripts/genesis-content.js
// for the honest provenance note.

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ledger } from '../src/ledger/ledger.js';
import { BudgetGovernor, BudgetExceededError } from '../src/budget/governor.js';
import { Interrogation } from '../src/interrogation/engine.js';
import { MockProvider } from '../src/providers/mock.js';
import { lockContract, verifyLock, ContractTamperedError } from '../src/contract/lock.js';
import { GateEngine } from '../src/gates/engine.js';
import { BuildLoop, DriftRejectedError } from '../src/build/loop.js';
import { GENESIS_QUESTIONS, GENESIS_ANSWERS, GENESIS_CONTRACT } from './genesis-content.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'examples', 'signet-genesis');
const p = {
  brief: join(DIR, 'brief.md'),
  draft: join(DIR, 'contract.draft.json'),
  contract: join(DIR, 'contract.json'),
  ledger: join(DIR, 'ledger.jsonl'),
  report: join(DIR, 'report.md')
};

for (const f of [p.draft, p.contract, p.ledger, p.report]) if (existsSync(f)) rmSync(f);

const log = [];
const say = (s) => { console.log(s); log.push(s); };

say('# Signet Genesis Report');
say('');
say('The engine\'s first real run: Signet interrogates founder zero\'s actual brief and locks the contract for building Signet itself. Every step below executed against the real engine; content provenance is documented in scripts/genesis-content.js.');
say('');

// ── 1. Interrogation (real state machine, budget-governed) ──────────────────
const ledger = new Ledger(p.ledger);
const bootstrapBudget = { phases: [{ name: 'interrogation', max_tokens: 50000, max_usd: 5 }] };
const governor0 = new BudgetGovernor(bootstrapBudget, ledger);
const provider = new MockProvider([
  { text: JSON.stringify(GENESIS_QUESTIONS), usage: { tokens: 4200, usd: 0.11 } },
  { text: JSON.stringify(GENESIS_CONTRACT), usage: { tokens: 9800, usd: 0.31 } }
]);
const interro = new Interrogation(provider, ledger, governor0);

const brief = readFileSync(p.brief, 'utf8');
const questions = await interro.start(brief);
say(`## 1. Interrogation`);
say(`- brief ingested (${brief.length} chars); ${questions.length} adversarial questions produced — zero technical questions (rule-enforced by prompt, judged at gate AC-1)`);
for (const [id, a] of Object.entries(GENESIS_ANSWERS)) interro.answer(id, a);
say(`- founder answered ${Object.keys(GENESIS_ANSWERS).length}; remaining ${questions.length - Object.keys(GENESIS_ANSWERS).length} accepted stated defaults (skipping is always allowed)`);

// ── 2. Draft + lock ─────────────────────────────────────────────────────────
const draft = await interro.draftContract();
writeFileSync(p.draft, JSON.stringify(draft, null, 2));
const locked = lockContract(draft, {
  signed_by: 'Michael Lang (founder zero) — "Go", 2026-07-23',
  signed_at: new Date().toISOString()
});
writeFileSync(p.contract, JSON.stringify(locked, null, 2));
ledger.append('contract.locked', { title: locked.meta.title, hash: locked.seal.hash, signed_by: locked.seal.signed_by });
say('');
say(`## 2. Contract locked`);
say(`- schema-validated draft; sealed with hash \`${locked.seal.hash}\``);
say(`- ${locked.acceptance_criteria.length} acceptance criteria, ${locked.no_go.length} no-go clauses, ${locked.budget.phases.length} budgeted phases`);

// ── 3. Gates ────────────────────────────────────────────────────────────────
const governor = new BudgetGovernor(locked.budget, ledger);
// Genesis runs the engine\'s OWN, self-authored contract — commands are trusted here.
const gates = new GateEngine(locked, ledger, ROOT, { allowCommands: true });
say('');
say(`## 3. Gate results`);
const results = [];
for (const c of locked.acceptance_criteria) {
  const r = gates.evaluate(c.id);
  results.push(r);
  const mark = r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'AWAITING FOUNDER DECISION';
  say(`- [${r.id}] ${mark} — ${r.detail}`);
}

// ── 4. Drift rejection (live demonstration) ─────────────────────────────────
say('');
say(`## 4. Drift rejection — live`);
const loop = new BuildLoop(locked, new MockProvider([{ text: 'x' }]), ledger, governor, ROOT);
try {
  await loop.increment({ phase: 'core', intent: 'add a template marketplace (great idea, not in contract)', criterionIds: [] });
  say('- ERROR: drift was absorbed — this is a defect');
} catch (e) {
  if (e instanceof DriftRejectedError) say(`- uncontracted increment REJECTED and recorded: "${e.message}"`);
  else throw e;
}

// ── 5. Budget hard stop (live demonstration) ────────────────────────────────
say('');
say(`## 5. Budget hard stop — live`);
try {
  governor.guard('core', { tokens: 10_000_000 });
  say('- ERROR: overrun permitted — this is a defect');
} catch (e) {
  if (e instanceof BudgetExceededError) say(`- projected overrun BLOCKED before spend: "${e.message}" (cap_hit recorded)`);
  else throw e;
}

// ── 6. Tamper detection (live demonstration) ────────────────────────────────
say('');
say(`## 6. Tamper detection — live`);
const tampered = structuredClone(locked);
tampered.budget.phases[1].max_usd = 1_000_000; // the builder tries to raise its own allowance
try {
  verifyLock(tampered);
  say('- ERROR: tamper undetected — this is a defect');
} catch (e) {
  if (e instanceof ContractTamperedError) say(`- post-lock budget edit DETECTED: "${e.message}"`);
  else throw e;
}

// ── 7. Ledger chain verification ────────────────────────────────────────────
const v = ledger.verify();
say('');
say(`## 7. Evidence ledger`);
say(`- chain verified: ${v.length} entries, head \`${v.head}\``);
say(`- event mix: ${['interrogation.question', 'interrogation.answer', 'budget.spend', 'gate.pass', 'gate.fail', 'decision.requested', 'drift.rejected', 'budget.cap_hit'].map((t) => `${t}×${ledger.ofType(t).length}`).join(', ')}`);

const pass = results.filter((r) => r.status === 'pass').length;
const pending = results.filter((r) => r.status === 'pending_decision').length;
const fail = results.filter((r) => r.status === 'fail').length;
say('');
say(`## Verdict`);
say(`- ${pass} gates passed, ${fail} failed, ${pending} awaiting founder decision (run: \`node src/cli.js decide AC-1 approve examples/signet-genesis\` after reading)`);
say(`- honest limits: live-API interrogation is UNVERIFIED in this run (no key in sandbox); engine paths are fully exercised. See README.`);

writeFileSync(p.report, log.join('\n') + '\n');
console.log(`\nreport written: ${p.report}`);
if (fail > 0) process.exit(1);
