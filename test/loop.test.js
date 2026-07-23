import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/ledger/ledger.js';
import { BudgetGovernor, BudgetExceededError } from '../src/budget/governor.js';
import { BuildLoop, DriftRejectedError } from '../src/build/loop.js';
import { MockProvider } from '../src/providers/mock.js';
import { lockContract } from '../src/contract/lock.js';
import { tmpFile, sampleContract } from './helpers.js';

function setup(responses = [{ text: 'built the thing', usage: { tokens: 2000, usd: 0.05 } }]) {
  const ledger = new Ledger(tmpFile());
  const contract = lockContract(sampleContract(), { signed_by: 'Lang' });
  const governor = new BudgetGovernor(contract.budget, ledger);
  const provider = new MockProvider(responses);
  return { ledger, contract, governor, provider, loop: new BuildLoop(contract, provider, ledger, governor) };
}

test('an increment citing no criteria is rejected as drift — recorded, not absorbed', async () => {
  const { loop, ledger } = setup();
  await assert.rejects(
    loop.increment({ phase: 'core', intent: 'add a cool extra feature', criterionIds: [] }),
    DriftRejectedError
  );
  assert.equal(ledger.ofType('drift.rejected').length, 1);
});

test('an increment citing an unknown criterion is drift', async () => {
  const { loop } = setup();
  await assert.rejects(
    loop.increment({ phase: 'core', intent: 'x', criterionIds: ['AC-99'] }),
    DriftRejectedError
  );
});

test('a valid increment runs, records spend, and verifies its gates immediately', async () => {
  const { loop, ledger, provider } = setup();
  const r = await loop.increment({ phase: 'core', intent: 'satisfy AC-1', criterionIds: ['AC-1'] });
  assert.equal(r.gates[0].status, 'pass');
  assert.equal(ledger.ofType('build.increment').length, 1);
  assert.equal(ledger.ofType('budget.spend').length, 1);
  // the builder prompt carries the no-go list — scope edges travel with every call
  assert.ok(provider.calls[0].system.includes('No scope drift'));
});

test('the loop cannot outspend the contract — guard fires before the call', async () => {
  const { loop } = setup();
  await assert.rejects(
    loop.increment({ phase: 'core', intent: 'huge', criterionIds: ['AC-1'], projected: { tokens: 999999 } }),
    BudgetExceededError
  );
});