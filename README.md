# Signet

**The open-source build contract engine. Bring your own keys.**

Signet is a binding, tamper-evident contract between a non-technical founder and an AI builder. You bring the domain expertise and a plain-language brief; Signet interrogates it like expensive counsel, drafts a Build Contract you can actually read, seals it with a hash the moment you sign, and then governs the AI build against it — gated verification, hard budget caps on your own API keys, and an append-only evidence ledger that records everything.

Your only job is decisions. Never actions.

## The honest promise

Signet does **not** claim to eliminate AI mistakes — nothing can, and anyone claiming otherwise is selling something. Signet's promise is narrower and enforceable:

> **No unverified output ever ships.** Mistakes may happen inside the loop; gates catch them before they reach you. Scope drift is rejected, not absorbed. Overspend is blocked before the money leaves your account. And any attempt to quietly change the signed contract — even one word, even by the builder itself — breaks the seal and stops everything.

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

## Install

```bash
git clone <this repo> && cd signet
npm test                                # zero dependencies; Node >= 18.17
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
- **The build loop is minimal.** It governs single-increment provider calls with gates, budgets, and drift rejection. It does not yet manage multi-file codebases, plans, or deployment — that is the next contract.
- **The Evidence Compiler (funding pack) is v2.** The ledger exists now precisely so v2 can cite it. Ledger integrity is tamper-*evident* (hash chain), not tamper-*proof* — an attacker who rewrites the entire file and every hash can forge history; external anchoring of the head hash is a v2 countermeasure.
- **Contract seal ≠ cryptographic signature.** It proves integrity (nothing changed since signing), not identity. Keypair signatures are future work.

## Roadmap (each stage is its own Signet contract)

- **v1.x** — live-API validation; richer build loop (plan → multi-increment → deploy-to-free-tier); interrogation + lock from the UI, not just the CLI.
- **v2** — Evidence Compiler: deck, model, and data room generated from the ledger, every claim citing a seq number.

## License

MIT. The engine is free forever; you pay only your own model provider.