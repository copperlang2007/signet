# Changelog

All notable changes to Signet. Format: reverse-chronological; each entry states what changed and why it mattered.

## v0.1.1 — 2026-07-23 — adversarial hardening to convergence

Six independent RED_TEAM rounds (4–9) on top of the v0.1 build. Every finding was
proven by executing code, fixed, and pinned with a regression test. The severity
trend decayed to zero: 3 serious → 1 serious → 1 flag → 1 low → **converged**.
Tests grew from 28 to 57; the genesis dogfood still passes 7/7 machine gates.

### Security
- **Command execution is consent-gated.** Gate commands (LLM-authored shell) do not run unless the operator passes `--run-commands`; a freshly cloned, untrusted contract cannot execute embedded shell by default.
- **Destructive/exfiltrating command denylist**, enforced at lock *and* execution: `rm -rf` and its long-flag/`-R` spellings, `find … -delete`, `find -exec rm`, `curl … | sh`, `nc -e` and `/dev/tcp` reverse shells, `git push` / `npm publish`, credential exfiltration. Disclosed as a bar-raiser, not a sandbox.
- **UI server** rejects non-loopback `Host` headers (anti DNS-rebinding) and never crashes on a corrupt project file — malformed `contract.json` / `ledger.jsonl` degrade to visible errors instead of taking down the process.

### Correctness — the core promises
- **Budget now fails closed.** Non-finite/negative spend, pricing env (`SIGNET_USD_PER_MTOK_*`), and — as of round 6 — the budget *caps themselves* (including the env-derived interrogation bootstrap cap) all throw instead of silently disabling enforcement.
- **Budget enforced before spend, not only after.** Each model call's output is bounded to the remaining token budget and refused before it is issued once a cap is reached; overshoot from input-estimate error halts the run loudly on record.
- **Contract seal now covers the signer and sign-time**, not just the body — rewriting `signed_by` or `signed_at` post-lock breaks the seal.
- **Ledger `verify()`** now rejects out-of-taxonomy event types, stray top-level fields the entry hash didn't cover, and sequence breaks.
- **Anti-theater audit widened** beyond commands: circular `evidence` gates (events the loop emits automatically) and tautological no-ops (`test 1 = 1`, `[ -d . ]`, `sleep 0`, `true # comment`) are refused at lock. `contract.locked` remains allowed as a genuine provenance milestone.
- **Schema** cross-checks that every acceptance-criterion phase is a budgeted phase.
- **Interrogation** now runs under a real budget cap in the CLI path (was uncapped).

### Compatibility & docs
- **Node engine** corrected to `>=20`; `npm test` uses the portable `node --test` (the previous glob form required Node 21+ despite the declared floor).
- **License** made consistent (MIT across `package.json`, `LICENSE`, README, ADRs).
- **README "Honest limits"** expanded and made precise: the budget claim, the denylist ("not a sandbox"), the input-token estimate ("not a hard bound"), and the ledger ("tamper-evident, not tamper-proof") now match actual behavior exactly. Every hard claim was verified un-falsifiable by an independent reviewer.

## v0.1.0 — 2026-07-23 — initial build

Open-source, BYOK build-contract engine. Interrogation → hash-locked Build Contract →
governed build loop with drift rejection, hard budget caps, and an append-only
hash-chained evidence ledger. Founder UI ("legal instrument" aesthetic). Genesis
dogfood: the engine's own contract, built under Signet. Zero runtime dependencies.
ADR-0001…0004, DEFENSIBILITY.md, FLYWHEEL.md. 28 tests.