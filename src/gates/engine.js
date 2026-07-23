// Gate engine: acceptance criteria become gates. Nothing ships past a failed gate.
// Three verification types (schema.js):
//   automated      — command exit code or file existence, machine-checked
//   human_decision — founder decides; engine pauses (decision.requested)
//   evidence       — the ledger must already contain a matching event
// The honest promise (ADR-0002): mistakes may occur inside the loop;
// gates guarantee no UNVERIFIED output ever ships. Not "no mistakes ever".

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyLock } from '../contract/lock.js';

export class GateEngine {
  /** @param contract locked contract  @param ledger Ledger  @param cwd project root for checks */
  constructor(contract, ledger, cwd = process.cwd()) {
    verifyLock(contract); // a broken seal means no gates run, ever
    this.contract = contract;
    this.ledger = ledger;
    this.cwd = cwd;
  }

  criterion(id) {
    const c = this.contract.acceptance_criteria.find((a) => a.id === id);
    if (!c) throw new Error(`unknown acceptance criterion: ${id}`);
    return c;
  }

  /**
   * Evaluate one criterion. Returns { id, status: 'pass'|'fail'|'pending_decision', detail }.
   * Every outcome is a ledger event — no unrecorded verification.
   */
  evaluate(id) {
    verifyLock(this.contract); // re-verify on every evaluation: tamper mid-run is still tamper
    const c = this.criterion(id);
    const v = c.verification;

    if (v.type === 'human_decision') {
      this.ledger.append('decision.requested', { criterion: id, prompt: v.prompt });
      return { id, status: 'pending_decision', detail: v.prompt };
    }

    if (v.type === 'evidence') {
      const found = this.ledger.entries.some((e) => e.type === v.event_type);
      const status = found ? 'pass' : 'fail';
      this.ledger.append(found ? 'gate.pass' : 'gate.fail', { criterion: id, via: 'evidence', event_type: v.event_type });
      return { id, status, detail: `evidence ${v.event_type}: ${found ? 'present' : 'absent'}` };
    }

    // automated
    let pass = false; let detail = '';
    try {
      if (v.check.kind === 'command') {
        // execFile with shell:false-style split is too naive for real commands; use bash -c
        // deliberately and record the exact command in the ledger for auditability.
        execFileSync('bash', ['-c', v.check.command], { cwd: this.cwd, stdio: 'pipe', timeout: 300000 });
        pass = true; detail = `command exited 0: ${v.check.command}`;
      } else if (v.check.kind === 'file_exists') {
        pass = existsSync(resolve(this.cwd, v.check.path));
        detail = `file ${v.check.path} ${pass ? 'exists' : 'missing'}`;
      } else if (v.check.kind === 'file_absent') {
        pass = !existsSync(resolve(this.cwd, v.check.path));
        detail = `file ${v.check.path} ${pass ? 'absent (good)' : 'present (violates no-go)'}`;
      }
    } catch (e) {
      pass = false; detail = `command failed: ${v.check.command} — ${String(e.message).slice(0, 400)}`;
    }
    this.ledger.append(pass ? 'gate.pass' : 'gate.fail', { criterion: id, via: v.check.kind, detail });
    return { id, status: pass ? 'pass' : 'fail', detail };
  }

  /** Record the founder's decision for a pending human_decision gate. */
  decide(id, { approved, by, note = '' }) {
    const c = this.criterion(id);
    if (c.verification.type !== 'human_decision') throw new Error(`${id} is not a human_decision gate`);
    this.ledger.append('decision.made', { criterion: id, approved: !!approved, by, note });
    this.ledger.append(approved ? 'gate.pass' : 'gate.fail', { criterion: id, via: 'human_decision', by, note });
    return { id, status: approved ? 'pass' : 'fail' };
  }

  /** Evaluate every criterion in a phase. */
  evaluatePhase(phase) {
    return this.contract.acceptance_criteria.filter((c) => c.phase === phase).map((c) => this.evaluate(c.id));
  }
}