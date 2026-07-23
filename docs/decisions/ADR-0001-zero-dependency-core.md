# ADR-0001 — Zero-dependency core in plain Node ESM

**Status:** accepted · 2026-07-23

**Context:** Signet asks non-technical founders to trust an engine with their API keys and their build. Every runtime dependency is supply-chain surface, install friction, and audit burden. The founder-zero budget is $0.

**Decision:** The engine ships with zero runtime dependencies. Plain Node ≥18.17 ESM; `node:test` for tests; `node:crypto` for hashing; `node:http` for the local UI; hand-rolled schema validation and CLI parsing.

**Alternatives considered:** TypeScript + zod + commander + vitest (better DX, but a build step plus ~200 transitive deps); Bun/Deno (smaller audience, ecosystem risk).

**Reasoning:** "Nothing to trust but the source" is a sellable, verifiable property (enforced as contract criterion AC-7 — a gate literally fails if `dependencies` is non-empty). Install is `git clone`; nothing to compile; runs anywhere Node runs.

**Tradeoffs:** No static types (mitigated by aggressive runtime validation and 28 tests); hand-rolled validation is more code to maintain.

**Master data flywheel impact:** none directly; lowers adoption friction, which feeds the flywheel.
**Moat impact:** trust/auditability positioning vs. dependency-heavy competitors.
**Reversibility:** easy — types and deps can be added later; the reverse migration is the painful one.
**Evidence:** `package.json` (`"dependencies": {}`), gate AC-7 pass in `examples/signet-genesis/report.md`.