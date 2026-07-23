#!/usr/bin/env node
// Signet CLI. Zero dependencies; readline for the interrogation flow.
// Commands:
//   signet init [dir]            scaffold a project (brief.md template)
//   signet interrogate [dir]     brief → questions → answers → contract.draft.json
//   signet lock [dir]            validate + seal contract.draft.json → contract.json + ledger genesis
//   signet verify [dir]          verify contract seal + full ledger chain
//   signet status [dir]          contract, gates, budget, pending decisions
//   signet decide <id> <approve|reject> [dir]   record a founder decision
//   signet gates [phase] [dir]   evaluate automated/evidence gates (optionally one phase)
//   signet ui [dir]              serve the founder UI on localhost

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { validateContract } from './contract/schema.js';
import { lockContract, verifyLock } from './contract/lock.js';
import { Ledger } from './ledger/ledger.js';
import { BudgetGovernor } from './budget/governor.js';
import { GateEngine } from './gates/engine.js';
import { Interrogation } from './interrogation/engine.js';
import { providerFromEnv } from './providers/index.js';
import { serveUi } from './ui/server.js';

const BRIEF_TEMPLATE = `BUILD BRIEF
────────────────────────────
PROBLEM
(What hurts, in your own words. Not the solution — the problem.)

WHO HAS IT
(Who feels this pain, and what do they do today instead?)

DONE LOOKS LIKE
(Describe what the END USER experiences when this works. Not how it works.)

CONSTRAINTS & NO-GO
(Budget, laws, lines you won't cross, things this must never do.)

WHAT I'D HATE
(Outcomes that would make you reject the result even if it "works".)

MY LEASH
(How attached are you to the solution vs the problem? May Signet push back?)
`;

function paths(dir) {
  const root = resolve(dir ?? '.');
  return {
    root,
    brief: join(root, 'brief.md'),
    draft: join(root, 'contract.draft.json'),
    contract: join(root, 'contract.json'),
    ledger: join(root, 'ledger.jsonl')
  };
}

function loadContract(p) {
  if (!existsSync(p.contract)) die(`no locked contract at ${p.contract} — run: signet lock`);
  return JSON.parse(readFileSync(p.contract, 'utf8'));
}

function die(msg) { console.error(`signet: ${msg}`); process.exit(1); }

async function cmdInit(dir) {
  const p = paths(dir);
  mkdirSync(p.root, { recursive: true });
  if (existsSync(p.brief)) die(`brief.md already exists in ${p.root}`);
  writeFileSync(p.brief, BRIEF_TEMPLATE);
  console.log(`Initialized Signet project in ${p.root}`);
  console.log(`1. Fill out brief.md in plain language.`);
  console.log(`2. Run: signet interrogate`);
}

async function cmdInterrogate(dir) {
  const p = paths(dir);
  if (!existsSync(p.brief)) die(`no brief.md in ${p.root} — run: signet init`);
  const brief = readFileSync(p.brief, 'utf8');
  const ledger = new Ledger(p.ledger);
  const provider = providerFromEnv();
  const interro = new Interrogation(provider, ledger);

  console.log('Reading your brief. Preparing interrogation…
');
  const questions = await interro.start(brief);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (const q of questions) {
    console.log(`
[${q.id} · ${q.category}] ${q.question}`);
    console.log(`  why it matters: ${q.why_it_matters}`);
    console.log(`  default if you skip: ${q.default_if_unanswered}`);
    const a = (await rl.question('  your answer (enter to accept default): ')).trim();
    if (a) interro.answer(q.id, a);
  }
  rl.close();
  console.log('
Drafting your Build Contract…');
  const draft = await interro.draftContract();
  writeFileSync(p.draft, JSON.stringify(draft, null, 2));
  console.log(`
Draft written to ${p.draft}`);
  console.log('Read it. Every word binds the builder. When it says what you mean: signet lock');
}

async function cmdLock(dir) {
  const p = paths(dir);
  if (!existsSync(p.draft)) die(`no contract.draft.json in ${p.root} — run: signet interrogate`);
  const draft = JSON.parse(readFileSync(p.draft, 'utf8'));
  const { ok, errors } = validateContract(draft);
  if (!ok) die('draft invalid:
- ' + errors.join('
- '));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const name = (await rl.question('Sign as (your name): ')).trim();
  rl.close();
  if (!name) die('a contract binds no one without a signature');
  const locked = lockContract(draft, { signed_by: name });
  writeFileSync(p.contract, JSON.stringify(locked, null, 2));
  const ledger = new Ledger(p.ledger);
  ledger.append('contract.locked', { title: locked.meta.title, hash: locked.seal.hash, signed_by: name });
  console.log(`
Contract sealed: ${locked.seal.hash}`);
  console.log(`Locked contract at ${p.contract}. From here, drift is rejected, not absorbed.`);
}

async function cmdVerify(dir) {
  const p = paths(dir);
  const contract = loadContract(p);
  verifyLock(contract);
  const ledger = new Ledger(p.ledger);
  const v = ledger.verify();
  console.log(`contract seal   OK  ${contract.seal.hash.slice(0, 16)}…`);
  console.log(`ledger chain    OK  ${v.length} entries, head ${v.head.slice(0, 16)}…`);
}

async function cmdStatus(dir) {
  const p = paths(dir);
  const contract = loadContract(p);
  verifyLock(contract);
  const ledger = new Ledger(p.ledger);
  const governor = new BudgetGovernor(contract.budget, ledger);
  console.log(`
${contract.meta.title}`);
  console.log(`sealed ${contract.seal.hash.slice(0, 16)}… by ${contract.seal.signed_by} at ${contract.seal.signed_at}
`);
  const lastGate = new Map();
  for (const e of ledger.entries) {
    if (e.type === 'gate.pass') lastGate.set(e.payload.criterion, 'pass');
    if (e.type === 'gate.fail') lastGate.set(e.payload.criterion, 'fail');
  }
  for (const c of contract.acceptance_criteria) {
    const s = lastGate.get(c.id) ?? 'unverified';
    const mark = s === 'pass' ? '✓' : s === 'fail' ? '✗' : '·';
    console.log(` ${mark} [${c.id}] ${c.statement}  (${s})`);
  }
  console.log('
budget:');
  for (const b of governor.summary()) {
    console.log(`  ${b.phase}: ${b.spent.tokens}/${b.cap.max_tokens} tokens, $${b.spent.usd.toFixed(2)}/$${b.cap.max_usd}`);
  }
  const decided = new Set(ledger.ofType('decision.made').map((e) => e.payload.criterion));
  const pending = ledger.ofType('decision.requested').map((e) => e.payload.criterion).filter((c) => !decided.has(c));
  if (pending.length) {
    console.log('
awaiting your decision:');
    for (const id of [...new Set(pending)]) console.log(`  signet decide ${id} approve|reject`);
  }
}

async function cmdDecide(id, verdict, dir) {
  if (!id || !['approve', 'reject'].includes(verdict)) die('usage: signet decide <criterion-id> approve|reject');
  const p = paths(dir);
  const contract = loadContract(p);
  const ledger = new Ledger(p.ledger);
  const gates = new GateEngine(contract, ledger, p.root);
  const res = gates.decide(id, { approved: verdict === 'approve', by: contract.seal.signed_by });
  console.log(`[${id}] recorded: ${res.status}`);
}

async function cmdGates(phase, dir) {
  const p = paths(dir);
  const contract = loadContract(p);
  const ledger = new Ledger(p.ledger);
  const gates = new GateEngine(contract, ledger, p.root);
  const targets = contract.acceptance_criteria.filter((c) => (!phase || c.phase === phase) && c.verification.type !== 'human_decision');
  if (!targets.length) die(phase ? `no machine-checkable gates in phase "${phase}"` : 'no machine-checkable gates');
  for (const c of targets) {
    const r = gates.evaluate(c.id);
    console.log(` ${r.status === 'pass' ? '✓' : '✗'} [${r.id}] ${r.detail}`);
  }
}

const [, , cmd, ...rest] = process.argv;
const run = {
  init: () => cmdInit(rest[0]),
  interrogate: () => cmdInterrogate(rest[0]),
  lock: () => cmdLock(rest[0]),
  verify: () => cmdVerify(rest[0]),
  status: () => cmdStatus(rest[0]),
  decide: () => cmdDecide(rest[0], rest[1], rest[2]),
  gates: () => cmdGates(rest[0], rest[1]),
  ui: () => serveUi(paths(rest[0]))
}[cmd];

if (!run) {
  console.log('signet <init|interrogate|lock|verify|status|decide|gates|ui> [dir]');
  process.exit(cmd ? 1 : 0);
}
Promise.resolve(run()).catch((e) => die(e.message));