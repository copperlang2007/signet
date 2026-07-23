import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContract } from '../src/contract/schema.js';
import { lockContract, verifyLock, ContractInvalidError, ContractTamperedError, canonicalize } from '../src/contract/lock.js';
import { sampleContract } from './helpers.js';

test('valid contract passes validation', () => {
  assert.equal(validateContract(sampleContract()).ok, true);
});

test('contract without no_go is invalid — scope must have edges', () => {
  const { ok, errors } = validateContract(sampleContract({ no_go: [] }));
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('no_go')));
});

test('assumption without a test is invalid — a hope is not a contract term', () => {
  const c = sampleContract({ assumptions: [{ statement: 'it will be fine', risk: 'high' }] });
  assert.equal(validateContract(c).ok, false);
});

test('locking requires a signature', () => {
  assert.throws(() => lockContract(sampleContract(), {}), ContractInvalidError);
});

test('locked contract verifies; any post-lock edit breaks the seal', () => {
  const locked = lockContract(sampleContract(), { signed_by: 'Lang' });
  assert.equal(verifyLock(locked), true);
  const tampered = structuredClone(locked);
  tampered.no_go.push('sneaky new scope'); // even ADDING scope is tamper
  assert.throws(() => verifyLock(tampered), ContractTamperedError);
  const tampered2 = structuredClone(locked);
  tampered2.budget.phases[0].max_usd = 999999; // raising your own budget cap is tamper
  assert.throws(() => verifyLock(tampered2), ContractTamperedError);
});

test('canonicalize is key-order independent', () => {
  assert.equal(canonicalize({ b: 1, a: { d: 2, c: 3 } }), canonicalize({ a: { c: 3, d: 2 }, b: 1 }));
});

test('an unlocked contract never verifies', () => {
  assert.throws(() => verifyLock(sampleContract()), ContractTamperedError);
});