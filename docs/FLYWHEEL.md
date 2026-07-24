# Data Flywheel — Signet

**This defines a new flywheel** (the master artificialBRIDGE flywheel gains a new spoke): the **build-evidence flywheel**.

**Workflow:** founder brief → interrogation → locked contract → governed build → gate outcomes → funding pack (v2).

**Specific data captured (per ledger event stream, already implemented):** briefs and their ambiguities; which interrogation questions founders answer vs. default; contract shapes per domain (criteria counts, no-go patterns, budget levels); gate pass/fail rates per verification type; real token/USD spend per phase; drift-rejection frequency (a direct measure of AI scope-creep pressure); decision latency (how long founders take to judge human gates).

**Repeatable event stream:** every `signet` run appends to a hash-chained `ledger.jsonl`; event taxonomy in `src/ledger/ledger.js` (14 types).

**Feedback loop / improvement mechanism:** aggregate gate-failure and drift patterns → sharpen interrogation prompts (fewer expensive ambiguities survive to build time) → tighter contracts → fewer failures. Question-skip rates prune low-value questions; spend-vs-cap data calibrates the drafter's default budgets.

**Proprietary value:** a corpus of *what non-technical domain experts mean when they describe software*, paired with verified build outcomes. Not scrapeable, not synthesizable, accrues per user.

**Connection path to Bridge Brain:** ledger events map 1:1 onto `bridge_events` (`gate.pass` → validation evidence; `drift.rejected` → correction; `budget.*` → cost telemetry; contracts → `product_specs`; this doc + ADRs → `defensibility_evidence`). A `signet export --bridge` command is the v1.x wiring task.

**Measurable outcomes:** rework count per build, spend per accepted criterion, contract-to-ship time, and (v2) % of funding-pack claims with ledger citations.

**Defensibility potential:** see DEFENSIBILITY.md — the flywheel is the path from copyability 2/5 to 4/5.

**Current honest state:** n=1 (genesis). The flywheel exists as implemented instrumentation plus one real corpus entry; it becomes a moat only with use.
