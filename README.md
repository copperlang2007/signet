# Signet

**The open-source build contract engine. Bring your own keys.**

Signet is a binding, tamper-evident contract between a non-technical founder and an AI builder. You bring the domain expertise and a plain-language brief; Signet interrogates it like expensive counsel, drafts a Build Contract you can actually read, seals it with a hash the moment you sign, and then governs the AI build against it — gated verification, hard budget caps on your own API keys, and an append-only evidence ledger that records everything.

Your only job is decisions. Never actions.

## The honest promise

Signet does **not** claim to eliminate AI mistakes — nothing can, and anyone claiming otherwise is selling something. Signet's promise is narrower and enforceable:

> **No unverified output ever ships.** Mistakes may happen inside the loop; gates catch them before they reach you. Every build increment must be attributed to a named acceptance criterion — an increment that cites none is rejected as drift, not absorbed. No new model call starts once a budget cap is reached, each call's output is bounded to your remaining budget, and any overshoot halts the run the instant it is recorded. And any attempt to quietly change the signed contract — even one word, even the signer's name — breaks the seal and stops everything.

## How it works

```
brief.md  ──►  signet interrogate  ──►  contract.draft.json  ──►  signet lock
                (5–9 adversarial            (you read it;             (sealed with
                 questions, none             every word binds          SHA-256; ledger
                 technical)                  the builder)              genesis)
                                                                          │
              signet ui  ◄──  ledger.jsonl  ◄──  governed build loop  ◄──┘
              (a typeset       (append-only,       (gates + budget caps +
               legal            hash-chained        drift rejection)
               instrument)      evidence)
```

1. `signet init` — scaffold a project with a brief template. Write your brief in plain language.
2. `signet interrogate` — Signet asks the 5–9 questions whose wrong assumptions would be expensive. Every question has a stated default; skipping is always allowed.
3. `signet lock` — read the drafted contract; sign it. It is sealed: acceptance criteria, no-go list, quality bar, budget caps, decision rights, and assumptions (each with its own test).
4. The build loop runs on **your** keys, must cite contract criteria for every increment, verifies immediately, and pauses only when a decision needs you: `signet decide AC-x approve|reject`.
5. `signet status` / `signet verify` / `signet ui` — see everything; trust nothing without evidence.

Command-based checks execute shell, so they only run when you explicitly consent: `signet gates --run-commands`. Without the flag they are reported but not executed — so cloning and inspecting an untrusted project is always safe. Signet also **refuses to lock** any contract whose checks are trivially-passing (`true`, `echo`) or destructive (`rm -rf`, `curl … | sh`), and re-checks the destructive denylist at execution as a backstop.

## Install

```bash
git clone <this repo> && cd signet
npm test                                # zero dependencies; Node >= 20
export SIGNET_ANTHROPIC_KEY=sk-ant-…    # bring your own key (BYOK)
node src/cli.js init my-product && cd my-product
# edit brief.md, then:
node ../src/cli.js interrogate
```

Providers: Anthropic (default), any OpenAI-compatible endpoint (`SIGNET_PROVIDER=openai-compat` — covers OpenAI, OpenRouter, Groq, local llama.cpp/ollama). Keys never leave your machine; there is no Signet server.

## Genesis: Signet built under its own contract

`npm run genesis` replays the engine's first real run: founder zero's actual brief is interrogated, the contract for Signet itself is drafted, sealed, and gated. See [`examples/signet-genesis/`](examples/signet-genesis/) — the brief, the locked contract, the hash-chained ledger, and the [report](examples/signet-genesis/report.md) with live demonstrations of drift rejection, budget hard-stop, and tamper detection.

## Honest limits (v0.1)

- **Live-API calls are unverified.** The build sandbox had no API key; provider adapters have unit coverage against stubbed responses only. The genesis run replays model-authored content through the real engine (provenance documented in `scripts/genesis-content.js`). First live run is the immediate next action.
- **A check can be weaker than the criterion it verifies.** The automated checks are drafted by the same LLM being governed, and the founder is non-technical by definition. Signet does three things about this: it **refuses to lock** a contract containing a trivially-passing check (`true`, `echo`, `… || true`, tautologies like `test 1 = 1` / `[ -d . ]`, or an `evidence` gate pointed at an event the loop emits automatically), or a destructive/exfiltrating one (`rm -rf`, `curl … | sh`, `git push`, `npm publish`); it **re-checks at execution** so cloning an untrusted repo and running `signet gates` blocks the common destructive/exfiltrating command forms (`rm -rf` and its long-flag spellings, `find … -delete`, `curl … | sh`, reverse shells) — a denylist that raises the bar, **not a sandbox** that closes every spelling; and it **renders every check in plain language** and makes you confirm it before you sign. What it still cannot guarantee: that a *syntactically safe but semantically weak* check (e.g. `ls` for "the app works") actually proves its criterion. That residual is what the human-decision gates are for, and an independent second-model check-auditor is the v1.x fix. The denylist is a bar-raiser, **not a sandbox** — containerized check execution is v1.x.
- **Drift rejection is attribution-level, not semantic.** Every increment must cite a real acceptance criterion or it is rejected; what Signet cannot guarantee is that a builder which *cites* a criterion actually worked only on it. The immediate gate re-run catches this for machine-checkable criteria; human-decision criteria are where a founder catches the rest. Content-level drift detection is v1.x.
- **Budget: enforced before each call and again on record — but input tokens are estimated.** Signet refuses to start a call once a cap is reached, bounds the model's output to the remaining token budget, and re-checks real spend on record (halting the run loudly the instant a cap is crossed). What it does **not** promise is that a single call can never overshoot at all: input tokens are estimated from character length (~3 chars/token, tighter than the ~4 English average but not a hard upper bound for dense/non-English/code input), so a call can overshoot by its estimate error — which then stops the run on the very next check. Non-finite or negative usage/pricing (a mistyped `SIGNET_USD_PER_MTOK_*`, a malformed local endpoint) fails **closed**: the governor throws rather than silently disabling the cap. Set token caps as your hard ceiling; treat the dollar cap as a fast tripwire.
- **The build loop is minimal.** It governs single-increment provider calls with gates, budgets, and drift rejection. It does not yet manage multi-file codebases, plans, or deployment — that is the next contract.
- **The Evidence Compiler (funding pack) is v2.** The ledger exists now precisely so v2 can cite it. Ledger integrity is tamper-*evident* (hash chain), not tamper-*proof* — an attacker who rewrites the entire file and every hash can forge history, and deleting the ledger resets budget-spend accounting; external anchoring of the head hash is a v2 countermeasure.
- **Contract seal ≠ cryptographic signature.** It proves integrity (nothing changed since signing), not identity — anyone can compute a valid seal around a contract they wrote. Keypair signatures are future work; the execution-time danger scan exists precisely because the seal alone does not establish trust.

## Roadmap (each stage is its own Signet contract)

- **v1.x** — live-API validation; richer build loop (plan → multi-increment → deploy-to-free-tier); interrogation + lock from the UI, not just the CLI.
- **v2** — Evidence Compiler: deck, model, and data room generated from the ledger, every claim citing a seq number.

## License

MIT. The engine is free forever; you pay only your own model provider.
