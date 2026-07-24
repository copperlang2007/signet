// Regression tests for RED_TEAM round 6.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/ledger/ledger.js';
import { BudgetGovernor, BudgetInputError } from '../src/budget/governor.js';
import { tmpFile } from './helpers.js';

// SERIOUS — a non-finite CAP (not just spend) must fail closed. The interrogation bootstrap
// cap is env-derived (Number('60k') → NaN), which previously disabled enforcement silently.
test('R6: a non-finite or negative budget cap is refused at construction', () => {
  for (const bad of [NaN, Infinity, -5, 'lots']) {
    assert.throws(
      () => new BudgetGovernor({ phases: [{ name: 'interrogation', max_tokens: bad, max_usd: 5 }] }, new Ledger(tmpFile())),
      BudgetInputError,
      `max_tokens=${bad}`
    );
    assert.throws(
      () => new BudgetGovernor({ phases: [{ name: 'interrogation', max_tokens: 60000, max_usd: bad }] }, new Ledger(tmpFile())),
      BudgetInputError,
      `max_usd=${bad}`
    );
  }
});

test('R6: replicating the CLI interrogation bootstrap with a mistyped env fails closed', () => {
  // exactly what cmdInterrogate builds from SIGNET_INTERROGATION_MAX_TOKENS="60k"
  const bootstrap = { phases: [{ name: 'interrogation', max_tokens: Number('60k'), max_usd: Number('5') }] };
  assert.throws(() => new BudgetGovernor(bootstrap, new Ledger(tmpFile())), BudgetInputError);
});

test('R6: a legitimate zero cap is still allowed (blocks all spend, does not throw)', () => {
  const g = new BudgetGovernor({ phases: [{ name: 'p', max_tokens: 0, max_usd: 0 }] }, new Ledger(tmpFile()));
  assert.throws(() => g.guard('p', { tokens: 1 })); // 0 cap blocks, but construction succeeded
});