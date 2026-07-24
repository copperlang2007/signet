// Regression tests for RED_TEAM round 5 (independent adversarial pass).
// Each pins a fix that closed a proven gap between a claim and the code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Ledger, LedgerCorruptError } from '../src/ledger/ledger.js';
import { BudgetGovernor, BudgetInputError } from '../src/budget/governor.js';
import { lockContract, verifyLock, contractHash, ContractTamperedError, VerificationTheaterError } from '../src/contract/lock.js';
import { validateContract } from '../src/contract/schema.js';
import { auditVerifications, isTrivialCommand, isCircularEvidence } from '../src/contract/verification-audit.js';
import { tmpFile, sampleContract } from './helpers.js';

// SERIOUS-1 — a hard cap must fail CLOSED on non-finite/negative numbers.
test('R5-1: budget throws (never runs open-loop) on NaN / Infinity / negative spend', () => {
  const led = new Ledger(tmpFile());
  const g = new BudgetGovernor(sampleContract().budget, led);
  for (const bad of [NaN, Infinity, -1, 'oops']) {
    assert.throws(() => g.record('core', { tokens: bad, usd: 0 }), BudgetInputError, `tokens=${bad}`);
    assert.throws(() => g.record('core', { tokens: 0, usd: bad }), BudgetInputError, `usd=${bad}`);
    assert.throws(() => g.guard('core', { tokens: bad }), BudgetInputError, `guard tokens=${bad}`);
  }
});

test('R5-1: a NaN smuggled into the ledger does not poison the accumulator on rehydrate', () => {
  const path = tmpFile();
  const led = new Ledger(path);
  new BudgetGovernor(sampleContract().budget, led).record('core', { tokens: 5000, usd: 0.2 });
  // hand-inject a NaN spend (as a raw line) and confirm rehydration ignores it, cap still enforced
  writeFileSync(path, readFileSync(path, 'utf8') + JSON.stringify({ seq: 99, ts: 'x', type: 'budget.spend', payload: { phase: 'core', tokens: null, usd: 'NaN' }, prev_hash: '0', hash: '0' }) + '
');
  const g2 = new BudgetGovernor(sampleContract().budget, new Ledger(path));
  assert.equal(Number.isFinite(g2.remaining('core').tokens), true);
  assert.equal(g2.remaining('core').tokens, 5000); // the poisoned entry was ignored
});

// SERIOUS-3 — the anti-theater audit now covers evidence gates, not just commands.
test('R5-3: a circular evidence gate (auto-emitted event) is refused at lock', () => {
  assert.equal(isCircularEvidence('build.increment'), true);
  assert.equal(isCircularEvidence('contract.locked'), false); // provenance milestone is allowed
  const c = sampleContract();
  c.acceptance_criteria[0].verification = { type: 'evidence', event_type: 'build.increment' };
  assert.equal(auditVerifications(c).ok, false);
  assert.throws(() => lockContract(c, { signed_by: 'Lang' }), VerificationTheaterError);
});

// FLAG-4 — tautological no-ops are caught.
test('R5-4: tautological commands verify nothing and are flagged', () => {
  for (const cmd of ['test 1 = 1', '[ -d . ]', 'sleep 0', 'date', 'pwd', 'cd /tmp']) {
    assert.equal(isTrivialCommand(cmd), true, `should flag: "${cmd}"`);
  }
});

// FLAG-5 — ledger verify() rejects entries append() would never have written.
test('R5-5: ledger verify() rejects unknown event types, stray fields, and seq breaks', () => {
  const mk = (entries) => { const p = tmpFile(); writeFileSync(p, entries.map((e) => JSON.stringify(e)).join('
') + '
'); return new Ledger(p); };
  // valid single entry to copy shape from
  const good = new Ledger(tmpFile()); good.append('note', { a: 1 });
  const base = good.entries[0];
  assert.throws(() => mk([{ ...base, type: 'totally.made.up' }]).verify(), LedgerCorruptError);
  assert.throws(() => mk([{ ...base, injected: 'extra' }]).verify(), LedgerCorruptError);
  assert.throws(() => mk([{ ...base, seq: 7 }]).verify(), LedgerCorruptError);
});

// FLAG-6 — the seal now covers the signer and sign-time.
test('R5-6: rewriting signed_by or signed_at after lock breaks the seal', () => {
  const locked = lockContract(sampleContract(), { signed_by: 'Lang' });
  assert.equal(verifyLock(locked), true);
  const a = structuredClone(locked); a.seal.signed_by = 'attacker@evil.com';
  assert.throws(() => verifyLock(a), ContractTamperedError);
  const b = structuredClone(locked); b.seal.signed_at = '1999-01-01T00:00:00.000Z';
  assert.throws(() => verifyLock(b), ContractTamperedError);
});

// FLAG-7 — schema cross-checks acceptance-criteria phases against budget phases.
test('R5-7: a criterion in an unbudgeted phase fails validation', () => {
  const c = sampleContract();
  c.acceptance_criteria[0].phase = 'ghost-phase';
  const { ok, errors } = validateContract(c);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('ghost-phase')));
});