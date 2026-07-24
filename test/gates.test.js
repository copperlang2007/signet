import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/ledger/ledger.js';
import { GateEngine } from '../src/gates/engine.js';
import { lockContract } from '../src/contract/lock.js';
import { ContractTamperedError } from '../src/contract/lock.js';
import { tmpFile, sampleContract } from './helpers.js';

function setup(mutate) {
  const ledger = new Ledger(tmpFile());
  const contract = lockContract(sampleContract(), { signed_by: 'Lang' });
  if (mutate) mutate(contract);
  return { ledger, contract };
}

// Command gates require explicit consent (RED_TEAM round 3) — pass it for trusted-contract tests.
const ALLOW = { allowCommands: true };

test('command gates do NOT run without explicit consent (clone-and-run is safe by default)', () => {
  const { ledger, contract } = setup();
  const g = new GateEngine(contract, ledger); // no allowCommands
  const r = g.evaluate('AC-1');
  assert.equal(r.status, 'blocked');
  assert.match(r.detail, /require explicit consent/);
});

test('automated command gate passes and is recorded (with consent)', () => {
  const { ledger, contract } = setup();
  const g = new GateEngine(contract, ledger, process.cwd(), ALLOW);
  const r = g.evaluate('AC-1');
  assert.equal(r.status, 'pass');
  assert.equal(ledger.ofType('gate.pass').length, 1);
});

test('failing command records gate.fail', () => {
  const ledger = new Ledger(tmpFile());
  const c = sampleContract();
  c.acceptance_criteria[0].verification.check.command = 'false';
  const locked = lockContract(c, { signed_by: 'Lang' });
  const g = new GateEngine(locked, ledger, process.cwd(), ALLOW);
  assert.equal(g.evaluate('AC-1').status, 'fail');
  assert.equal(ledger.ofType('gate.fail').length, 1);
});

test('human_decision gate pauses with decision.requested, then founder decides', () => {
  const { ledger, contract } = setup();
  const g = new GateEngine(contract, ledger);
  const r = g.evaluate('AC-2');
  assert.equal(r.status, 'pending_decision');
  assert.equal(ledger.ofType('decision.requested').length, 1);
  const d = g.decide('AC-2', { approved: true, by: 'Lang' });
  assert.equal(d.status, 'pass');
  assert.equal(ledger.ofType('decision.made').length, 1);
});
test('evidence gate reads the ledger itself', () => {
  const { ledger, contract } = setup();
  const g = new GateEngine(contract, ledger);
  assert.equal(g.evaluate('AC-3').status, 'fail'); // no contract.locked event yet
  ledger.append('contract.locked', { hash: contract.seal.hash });
  assert.equal(g.evaluate('AC-3').status, 'pass');
});

test('a tampered contract cannot run gates — even mid-run', () => {
  const { ledger, contract } = setup();
  const g = new GateEngine(contract, ledger);
  g.evaluate('AC-1');
  contract.acceptance_criteria[0].verification.check.command = 'false && sneaky';
  assert.throws(() => g.evaluate('AC-1'), ContractTamperedError);
});