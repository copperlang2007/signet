import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/ledger/ledger.js';
import { BudgetGovernor, BudgetExceededError } from '../src/budget/governor.js';
import { tmpFile, sampleContract } from './helpers.js';

test('guard blocks a call that would cross the cap — before spending', () => {
  const ledger = new Ledger(tmpFile());
  const g = new BudgetGovernor(sampleContract().budget, ledger);
  assert.equal(g.guard('core', { tokens: 9000 }), true);
  assert.throws(() => g.guard('core', { tokens: 10001 }), BudgetExceededError);
});

test('record enforces caps and writes cap_hit to the ledger — never silent', ()2 => {
  const ledger = new Ledger(tmpFile());
  const g = new BudgetGovernor(sampleContract().budget, ledger);
  g.record('core', { tokens: 6000, usd: 0.5 });
  assert.throws(() => g.record('core', { tokens: 6000, usd: 0.1 }), BudgetExceededError);
  assert.equal(ledger.ofType('budget.cap_hit').length, 1);
  assert.equal(ledger.ofType('budget.spend').length, 2);
});

test('spend survives restart via ledger rehydration — restarts cannot forget', () => {
  const path = tmpFile();
  const ledger = new Ledger(path);
  const g1 = new BudgetGovernor(sampleContract().budget, ledger);
  g1.record('core', { tokens: 8000, usd: 0.2 });
  // new process, same ledger
  const g2 = new BudgetGovernor(sampleContract().budget, new Ledger(path));
  assert.equal(g2.remaining('core').tokens, 2000);
  assert.throws(() => g2.guard('core', { tokens: 3000 }), BudgetExceededError);
});

test('unknown phase is an error, not a free pass', () => {
  const g = new BudgetGovernor(sampleContract().budget, new Ledger(tmpFile()));
  assert.throws(() => g.guard('never-declared', { tokens: 1 }));
});