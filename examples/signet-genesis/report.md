# Signet Genesis Report

The engine's first real run: Signet interrogates founder zero's actual brief and locks the contract for building Signet itself. Every step below executed against the real engine; content provenance is documented in scripts/genesis-content.js.

## 1. Interrogation
- brief ingested (2758 chars); 7 adversarial questions produced — zero technical questions (rule-enforced by prompt, judged at gate AC-1)
- founder answered 2; remaining 5 accepted stated defaults (skipping is always allowed)

## 2. Contract locked
- schema-validated draft; sealed with hash `ed23e678039d5e382456d0b9a9d742833e36a748f4d419f2fc39366c70dbbefd`
- 9 acceptance criteria, 6 no-go clauses, 4 budgeted phases

## 3. Gate results
- [AC-1] AWAITING FOUNDER DECISION — Read examples/signet-genesis/interrogation — would a non-technical founder understand every word, and does every question earn its place?
- [AC-2] PASS — command exited 0: node --test 'test/contract.test.js'
- [AC-3] PASS — command exited 0: node --test 'test/ledger.test.js'
- [AC-4] PASS — command exited 0: node --test 'test/budget.test.js'
- [AC-5] PASS — command exited 0: node --test 'test/loop.test.js'
- [AC-6] PASS — command exited 0: node --test 'test/gates.test.js'
- [AC-7] PASS — command exited 0: node -e 'const p=require("./package.json"); process.exit(Object.keys(p.dependencies||{}).length?1:0)'
- [AC-8] PASS — evidence contract.locked: present
- [AC-9] AWAITING FOUNDER DECISION — Open the Signet UI. Is it something you would be proud to put in front of an investor?

## 4. Drift rejection — live
- uncontracted increment REJECTED and recorded: "increment rejected as scope drift: cites no valid criteria (none cited)"

## 5. Budget hard stop — live
- projected overrun BLOCKED before spend: "budget cap hit: phase "core" tokens — spent 10000000 of cap 400000" (cap_hit recorded)

## 6. Tamper detection — live
- post-lock budget edit DETECTED: "contract seal broken: expected bb79d5911e40…, sealed ed23e678039d…"

## 7. Evidence ledger
- chain verified: 25 entries, head `40494dfc752807328c1558d61304f7512a299905077f4aa53313c893dfbde9c9`
- event mix: interrogation.question×7, interrogation.answer×2, budget.spend×2, gate.pass×7, gate.fail×0, decision.requested×2, drift.rejected×1, budget.cap_hit×1

## Verdict
- 7 gates passed, 0 failed, 2 awaiting founder decision (run: `node src/cli.js decide AC-1 approve examples/signet-genesis` after reading)
- honest limits: live-API interrogation is UNVERIFIED in this run (no key in sandbox); engine paths are fully exercised. See README.
