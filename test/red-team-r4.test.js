// Regression tests for RED_TEAM round 4 findings. Each test pins a fix that closed
// a confirmed gap between a shipped claim and the code's actual behavior.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ledger } from '../src/ledger/ledger.js';
import { BudgetGovernor, BudgetExceededError } from '../src/budget/governor.js';
import { BuildLoop } from '../src/build/loop.js';
import { GateEngine } from '../src/gates/engine.js';
import { MockProvider } from '../src/providers/mock.js';
import { lockContract, ContractTamperedError } from '../src/contract/lock.js';
import { buildState } from '../src/ui/server.js';
import { tmpFile, sampleContract } from './helpers.js';

function locked() { return lockContract(sampleContract(), { signed_by: 'Lang' }); }

test('R4-A: a single call cannot cross the token cap — provider is never called', async () => {
  const c = locked();
  const ledger = new Ledger(tmpFile());
  const governor = new BudgetGovernor(c.budget, ledger);
  const provider = new MockProvider([{ text: 'x', usage: { tokens: 999999, usd: 0.01 } }]);
  const loop = new BuildLoop(c, provider, ledger, governor);
  governor.record('core', { tokens: 9990, usd: 0 }); // near the 10000 cap
  await assert.rejects(
    loop.increment({ phase: 'core', intent: 'one more', criterionIds: ['AC-1'] }),
    BudgetExceededError
  );
  assert.equal(provider.calls.length, 0, 'money must not be spent when the guard fires');
});

test('R4-A: the model output is bounded by remaining budget (maxTokens passed through)', async () => {
  const c = locked();
  const ledger = new Ledger(tmpFile());
  const governor = new BudgetGovernor(c.budget, ledger);
  const provider = new MockProvider([{ text: 'built', usage: { tokens: 500, usd: 0.01 } }]);
  const loop = new BuildLoop(c, provider, ledger, governor);
  governor.record('core', { tokens: 6000, usd: 0 }); // 4000 tokens left, below the 4096 default output size
  // low explicit projection so the conservative default floor doesn't (correctly) refuse
  await loop.increment({ phase: 'core', intent: 'small', criterionIds: ['AC-1'], projected: { tokens: 100, usd: 0 } });
  const passed = provider.calls[0].maxTokens;
  assert.ok(passed >= 1 && passed <= 4000, `maxTokens (${passed}) must be clamped to remaining budget, not the 4096 default`);
});

test('R4-E: a tampered contract cannot record a founder decision', () => {
  const c = locked();
  const ledger = new Ledger(tmpFile());
  const gates = new GateEngine(c, ledger);
  c.no_go.push('post-lock scope creep'); // break the seal after construction
  assert.throws(() => gates.decide('AC-2', { approved: true, by: 'Lang' }), ContractTamperedError);
});

test('R4-D: UI state survives a corrupt contract and a corrupt ledger', () => {
  const root = mkdtempSync(join(tmpdir(), 'signet-ui-'));
  const p = {
    root,
    brief: join(root, 'brief.md'),
    draft: join(root, 'contract.draft.json'),
    contract: join(root, 'contract.json'),
    ledger: join(root, 'ledger.jsonl')
  };
  writeFileSync(p.contract, '{ not valid json ]');
  writeFileSync(p.ledger, 'garbage\n{still bad}\n');
  const state = buildState(p); // must not throw
  assert.ok(Array.isArray(state.errors) && state.errors.length >= 2);
  assert.equal(state.seal.valid, false);
});