// Contract locking: canonicalize → SHA-256 → tamper-evident seal (ADR-0002).
// After lock, any byte of drift invalidates the seal and the build loop refuses to run.

import { createHash } from 'node:crypto';
import { validateContract } from './schema.js';
import { auditVerifications } from './verification-audit.js';

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

/**
 * The hash covers everything except the seal's own hash field. Earlier it stripped the
 * ENTIRE seal, which left seal.signed_by and seal.signed_at editable post-lock without
 * breaking verification (RED_TEAM round 5). Now the signer and sign-time are sealed too:
 * only seal.hash (which cannot commit to itself) is excluded.
 */
export function contractHash(contract) {
  const clone = structuredClone(contract);
  if (clone.seal) delete clone.seal.hash;
  return sha256(canonicalize(clone));
}

export class ContractInvalidError extends Error {
  constructor(errors) { super('contract invalid:
- ' + errors.join('
- ')); this.errors = errors; }
}
export class ContractTamperedError extends Error {}
export class VerificationTheaterError extends Error {
  constructor(blocking) {
    super('contract contains checks that verify nothing:
' + blocking.map((b) => `- [${b.id}] ${b.command} — ${b.reason}`).join('
'));
    this.blocking = blocking;
  }
}

/**
 * Lock a contract: validate, hash, seal. Returns a NEW object; input is not mutated.
 * signed_by records who accepted the contract (the founder). This is an integrity
 * seal, not a cryptographic signature — see ADR-0002 for the honest distinction.
 */
export function lockContract(contract, { signed_by, signed_at } = {}) {
  const { ok, errors } = validateContract(contract);
  if (!ok) throw new ContractInvalidError(errors);
  if (!signed_by) throw new ContractInvalidError(['signed_by required: an unsigned contract binds no one']);
  // A contract cannot be sealed around a check that verifies nothing (RED_TEAM round 1).
  const audit = auditVerifications(contract);
  if (!audit.ok) throw new VerificationTheaterError(audit.blocking);
  const sealed = structuredClone(contract);
  // Attach the seal WITHOUT its hash, then hash the whole object (seal included) so the
  // signer and sign-time are covered too. Only seal.hash is excluded (it cannot commit
  // to itself). RED_TEAM round 5.
  sealed.seal = {
    algorithm: 'sha256-canonical-json',
    signed_by,
    signed_at: signed_at ?? new Date().toISOString(),
    locked: true
  };
  sealed.seal.hash = contractHash(sealed);
  return sealed;
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