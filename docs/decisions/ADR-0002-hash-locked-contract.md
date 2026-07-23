# ADR-0002 — The contract is a hash-locked artifact; the promise is "no unverified output ships"

**Status:** accepted · 2026-07-23

**Context:** The founding brief asked for a contract that "eliminates any potential" of AI hallucination and assumption. That claim is not technically honest — no prompt or contract can make a probabilistic model deterministic. Building on a false claim would poison the product's credibility, especially in front of investors.

**Decision:** Two-part architecture. (1) The Build Contract is sealed at signing: canonical-JSON SHA-256 over the full body; every gate evaluation re-verifies the seal, so any post-lock edit — by founder, builder, or model — halts the system. (2) The enforceable promise is **verification, not perfection**: every increment must cite contract criteria (else drift-rejected), every criterion carries an executable verification, and nothing "ships" past a failed or unverified gate.

**Alternatives considered:** prompt-only discipline (unenforceable); full cryptographic signatures with keypairs (right eventually; overkill for v1 and adds key-management burden onto non-technical founders); mutable contracts with change logs (reintroduces silent drift — the disease this product treats).

**Reasoning:** Integrity-sealing is cheap, zero-dependency, and gives the founder a real guarantee they can explain in one sentence. Budget caps live inside the sealed body, so *the builder cannot raise its own allowance* — demonstrated live in the genesis report (§6).

**Tradeoffs:** Changing anything requires a new contract (deliberate — friction is the feature); seal proves integrity, not signer identity (documented in README "Honest limits").

**Moat impact:** the locked-contract discipline is the product's core differentiator vs. iterate-until-broke builders.
**Reversibility:** one-way door for the honesty framing (correct); easy to extend to real signatures.
**Evidence:** `test/contract.test.js` (tamper cases), `test/gates.test.js` (mid-run tamper), genesis report §3–§6.