# Defensibility Ledger — Signet v0.1

**IP assets created:** the interrogation prompt system (`src/interrogation/prompts.js` — the adversarial-counsel posture, question-economics rules, default-if-unanswered mechanic); the Build Contract schema (plain-language + machine-checkable duality); the sealed-contract + gated-loop + evidence-ledger architecture (ADR-0002/0003); the "legal instrument" design language (`ui/index.html`); the genesis dogfood corpus.

**Moat type:** workflow lock-in + accumulating evidence data + trust positioning. Every project's ledger is an accumulating, non-portable evidence corpus; the longer you build under Signet, the more your eventual funding pack depends on it.

**Master data flywheel contribution:** every run emits the structured event stream defined in docs/FLYWHEEL.md — this repo's own genesis ledger is contribution #1.

**Workflow lock-in:** the contract discipline reshapes how the founder works (decisions, not actions); switching back means returning to ungoverned iteration. Switching cost grows with each locked contract and each ledger.

**Proprietary dataset (path):** cross-project corpus of brief → questions → answers → contract → gate outcomes → spend. This is training data for "what non-technical founders actually mean" that no competitor can scrape. v0.1 holds one project (genesis); the dataset moat is a trajectory, not a current fact — honest gap.

**Copyability score: 2/5 today → path to 4/5.**
- *Why 2:* the engine mechanics (hashing, chaining, gates, caps) are replicable by a competent team in weeks; open source accelerates copying by design.
- *What's hard to copy:* the interrogation IP's quality, the evidence-corpus accumulation per user, the honest-promise brand posture, and (v2) the pack compiler trained on real ledger corpora.
- *Path to 4:* ship v2 Evidence Compiler (evidence-cited packs are useless without ledgers, and ledgers accrue only inside Signet); community contract-template corpus; anchored-ledger notarization.

**Reverse-moat threats & countermeasures:**
1. *Replit/Lovable/Cursor add "contract mode"* — likeliest threat. Countermeasure: they profit from loop inefficiency and hold keys; Signet's BYOK + no-rent + open-source posture is structurally hard for them to match without cannibalizing revenue. Speed matters: ship v2 before they move.
2. *Model providers make verification native* — partial commoditization. Countermeasure: Signet is provider-neutral; native verification becomes a cheaper gate backend, not a replacement for contracts + ledgers.
3. *An OSS clone forks this repo* — countermeasure: the moat was never the code (MIT, deliberately); it's the corpus, the interrogation quality iteration, and the brand of honesty. Keep the prompt IP improving faster than forks.
4. *Platform shift: agents get cheap enough that waste stops hurting* — countermeasure: the ledger/funding-pack value is independent of token cost; reposition weight toward evidence if needed.

**Evidence:** genesis report (7 machine gates passed, live drift/budget/tamper demonstrations), 28 passing tests, zero-dependency package.json.
**Open proof gaps:** no live-API run; n=1 project corpus; no external user; UI human gates (AC-1, AC-9) await founder judgment.
**ADR links:** 0001–0004.