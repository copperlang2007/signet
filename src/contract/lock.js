// Contract locking: canonicalize → SHA-256 → tamper-evident seal (ADR-0002).
// After lock, any byte of drift invalidates the seal and the build loop refuses to run.

import { createHash } from 'node:crypto';
import { validateContract } from './schema.js';

/** Deterministic JSON: recursively sorted keys, no whitespace variance. */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** The hash covers everything except the seal itself. */
export function contractHash(contract) {
  const { seal, ...body } = contract;
  return sha256(canonicalize(body));
}

export class ContractInvalidError extends Error {
  constructor(errors) { super('contract invalid:\n- ' + errors.join('\n- ')); this.errors = errors; }
}
export class ContractTamperedError extends Error {}

/**
 * Lock a contract: validate, hash, seal. Returns a NEW object; input is not mutated.
 * signed_by records who accepted the contract (the founder). This is an integrity
 * seal, not a cryptographic signature — see ADR-0002 for the honest distinction.
 */
export function lockContract(contract, { signed_by, signed_at } = {}) {
  const { ok, errors } = validateContract(contract);
  if (!ok) throw new ContractInvalidError(errors);
  if (!signed_by) throw new ContractInvalidError(['signed_by required: an unsigned contract binds no one']);
  const body = structuredClone(contract);
  delete body.seal;
  const hash = sha256(canonicalize(body));
  return {
    ...body,
    seal: {
      algorithm: 'sha256-canonical-json',
      hash,
      signed_by,
      signed_at: signed_at ?? new Date().toISOString(),
      locked: true
    }
  };
}

/** Verify a locked contract's seal. Throws ContractTamperedError on any drift. */
export function verifyLock(contract) {
  if (!contract?.seal?.locked) throw new ContractTamperedError('contract is not locked');
  const expected = contractHash(contract);
  if (expected !== contract.seal.hash) {
    throw new ContractTamperedError(
      `contract seal broken: expected ${expected.slice(0, 12)}…, sealed ${String(contract.seal.hash).slice(0, 12)}…`
    );
  }
  return true;
}