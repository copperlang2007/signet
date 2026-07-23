# ADR-0003 — Append-only hash-chained ledger, shipped in v1, designed for the v2 Evidence Compiler

**Status:** accepted · 2026-07-23

**Context:** The end-state product includes a funding pack (deck, model, data room). Auto-generated packs are commodity prose every investor discounts. The only defensible version is one where every claim traces to recorded build evidence — which requires the evidence to exist from the very first build.

**Decision:** Ship the ledger in v1 core even though its full payoff is v2. Every engine action — question asked, answer given, contract locked, gate passed/failed, dollar spent, cap hit, decision requested/made, drift rejected — is an append-only JSONL entry hash-chained to its predecessor (`hash = sha256(prev_hash + canonical(entry))`). The budget governor rehydrates from the ledger so restarts cannot forget spend.

**Alternatives considered:** plain logs (editable, worthless as evidence); SQLite (a dependency, violates ADR-0001; and a file of hash-chained JSON is human-auditable with `cat`); defer to v2 (kills the moat — packs would degenerate into templates).

**Reasoning:** Tamper-*evidence* (not tamper-*proofness*) is the achievable v1 property: any edit or deletion of history is detectable by anyone with the file. External anchoring of head hashes (e.g., periodic commit to a public git ref) is the v2 countermeasure for whole-file rewrites.

**Tradeoffs:** JSONL grows unbounded (fine at v1 scale); no privacy layer yet — briefs land in the ledger, so contracts containing secrets need the v1.x redaction layer before multi-user use.

**Master data flywheel impact:** the ledger IS the flywheel's event stream (see docs/FLYWHEEL.md).
**Moat impact:** proprietary evidence corpus per project; the v2 pack's differentiation depends on it.
**Reversibility:** easy to extend, costly to retrofit — which is exactly why it ships now.
**Evidence:** `test/ledger.test.js` (edit + deletion detection), genesis ledger: 25 verified entries.