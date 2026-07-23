# ADR-0004 — BYOK provider adapters; no server, no key custody, MIT license

**Status:** accepted · 2026-07-23

**Context:** The brief's cost constraint is absolute ("no income right now") and names the gap: "there is no open-source version of Replit — bring your own keys." Hosted builders charge rent on the iteration loop and profit from its inefficiency.

**Decision:** Signet is local-only software. Keys come from the founder's environment (`SIGNET_ANTHROPIC_KEY` etc.), calls go direct from the founder's machine to their provider, and there is no Signet server to trust or pay. Two adapters cover the market: Anthropic Messages API, and OpenAI-compatible chat completions (OpenAI, OpenRouter, Groq, Together, local llama.cpp/ollama). A deterministic MockProvider makes the engine fully testable offline. License is MIT: adoption is the moat's oxygen; the defensibility lives in the ledger corpus, the interrogation IP, and the workflow lock-in — not in the license (see docs/DEFENSIBILITY.md).

**Alternatives considered:** hosted proxy with margin (rent-seeking, custody risk, kills the positioning); Apache-2.0 (fine too; MIT chosen for shortest possible trust surface); vendoring official SDKs (violates ADR-0001).

**Tradeoffs:** Cost accounting uses a configurable pricing table, not billing-API truth — caps enforce against estimates (conservative defaults; override via env). Live adapters are UNVERIFIED as of v0.1 (no key in the build sandbox) — flagged in README and in each adapter's header comment.

**Security/compliance impact:** no PHI/PII custody, no key custody; the founder's existing provider agreements govern.
**Reversibility:** easy — a hosted convenience tier can be added later without breaking local-first.
**Evidence:** `src/providers/*`, AC-7 gate pass, `package.json` dependencies: {}.