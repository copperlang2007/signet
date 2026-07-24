// GENESIS AUTHORED CONTENT — provenance note (honesty over polish):
// These are the interrogation questions and contract draft for Signet itself.
// They were authored offline by the model (Claude, claude-fable-5) acting in the
// interrogator/drafter roles, then replayed through MockProvider so the REAL
// engine code paths (state machine, ledger, validation, locking, gates, budget)
// execute end-to-end without an API key in the build sandbox.
// What this validates: every deterministic engine path, with real content.
// What this does NOT validate: live-API interrogation quality. See README "Honest limits".

export const GENESIS_QUESTIONS = {
  questions: [
    {
      id: 'Q1', category: 'outcome',
      question: 'When the funding pack finally lands on a desk, whose desk is it — an angel writing a $25k check, an accelerator screener with 90 seconds, or an institutional associate building a memo?',
      why_it_matters: 'These three readers reject for different reasons; a pack tuned for the wrong one fails silently.',
      default_if_unanswered: 'Pre-seed angel and accelerator screener; institutional-grade rigor, screener-grade brevity.'
    },
    {
      id: 'Q2', category: 'scope_boundary',
      question: 'Version one must prove itself on one real, currently-stalled build. Which one is the subject of the first contract?',
      why_it_matters: 'A tool validated only on demos is a demo; the first contract decides what "works" means.',
      default_if_unanswered: 'Signet itself — the engine builds under its own contract (genesis dogfood).'
    },
    {
      id: 'Q3', category: 'budget',
      question: 'In your own API dollars, what is the hard cap per build phase before the engine must stop and put the decision back in your hands?',
      why_it_matters: 'Silent overspend is the exact waste this product exists to kill; an unset cap is an unlimited one.',
      default_if_unanswered: '$25 per phase, hard stop, resumable only by an explicit founder decision.'
    },
    {
      id: 'Q4', category: 'no_go',
      question: 'If the builder is certain you would love a feature the contract does not name, may it build it anyway?',
      why_it_matters: 'This single yes/no decides whether scope drift is a judgment call or a rejected event; judgment calls are how codebases bloat.',
      default_if_unanswered: 'No. Uncontracted work is rejected and recorded, however good the idea; good ideas go into the next contract.'
    },
    {
      id: 'Q5', category: 'quality_bar',
      question: 'Name one object — not software — whose feel the founder-facing surface should be mistaken for.',
      why_it_matters: '"Not generic or cheap" is unenforceable; a concrete reference object is a testable taste anchor.',
      default_if_unanswered: 'A finely typeset legal instrument on heavy paper, executed with a wax seal.'
    },
    {
      id: 'Q6', category: 'decision_rights',
      question: 'Which decisions must never be made without you, even if waiting costs days?',
      why_it_matters: 'Everything not on this list the engine will decide alone; an incomplete list surrenders rights you meant to keep.',
      default_if_unanswered: 'Locking the contract, judging every human gate, raising any budget cap, and the kill/iterate call.'
    },
    {
      id: 'Q7', category: 'assumption',
      question: 'You believe contract discipline — not smarter models — is what cuts the waste. If the first governed build fails to beat your current workflow on rework and spend, is that a kill or an iterate?',
      why_it_matters: 'Deciding the failure rule before the result exists is the only version of the decision that is honest.',
      default_if_unanswered: 'Iterate once with a revised contract; a second miss is a kill.'
    }
  ]
};

export const GENESIS_ANSWERS = {
  Q2: 'Signet itself. The engine ships under its own locked contract — genesis dogfood — then the next contract is one of my stalled artificialBRIDGE apps.',
  Q4: 'No. Drift rejected, always. Good ideas go in the next contract.'
};

export const GENESIS_CONTRACT = {
  meta: {
    title: 'Signet v1 — the open-source build contract engine',
    version: '1.0',
    created: '2026-07-23T00:00:00.000Z'
  },
  problem: {
    statement: 'Domain experts with zero technical knowledge cannot get their solutions to market: AI build tools assume technical fluency, iterate wastefully without a binding definition of done, and produce nothing a funding round can stand on. There is no enforceable contract between a founder and an AI builder, and no open-source bring-your-own-keys engine to hold one.',
    who_has_it: 'Domain-expert founders of the AI era — people who bring deep field knowledge and nothing else, currently burning usage on iteration loops that bloat code and stall at fundraising.'
  },
  outcome: [
    'A founder writes a plain-language brief and is interrogated like a client of expensive counsel — never asked a technical question.',
    'The founder signs a Build Contract they fully understand, and from that moment nothing can quietly change it.',
    'The build runs on the founder’s own AI keys, stops hard at the founder’s own budget caps, and pauses only for decisions — never for actions.',
    'Every step of the build leaves tamper-evident evidence a future investor pack can cite line by line.'
  ],
  acceptance_criteria: [
    {
      id: 'AC-1',
      statement: 'A founder hands Signet a plain-language brief and receives five to nine clarifying questions, none of which mention technology, each carrying a stated default so skipping is always allowed.',
      phase: 'interrogation',
      verification: { type: 'human_decision', prompt: 'Read examples/signet-genesis/interrogation — would a non-technical founder understand every word, and does every question earn its place?' }
    },
    {
      id: 'AC-2',
      statement: 'Once the founder signs, the contract cannot be quietly changed — altering any word, adding scope, or raising a budget cap breaks the seal and stops the build.',
      phase: 'core',
      verification: { type: 'automated', check: { kind: 'command', command: "node --test 'test/contract.test.js'" } }
    },
    {
      id: 'AC-3',
      statement: 'Every action the engine takes is written to an append-only ledger; editing or deleting any historical entry is detectable by anyone.',
      phase: 'core',
      verification: { type: 'automated', check: { kind: 'command', command: "node --test 'test/ledger.test.js'" } }
    },
    {
      id: 'AC-4',
      statement: 'The engine can never outspend the founder’s caps: each call is bounded so it cannot cross the token cap, the dollar cap halts the run the instant a recorded spend crosses it, cap hits are loud, and restarts cannot forget prior spend.',
      phase: 'core',
      verification: { type: 'automated', check: { kind: 'command', command: "node --test 'test/budget.test.js'" } }
    },
    {
      id: 'AC-5',
      statement: 'Work the contract does not name is rejected and recorded as drift — never absorbed, however good the idea.',
      phase: 'core',
      verification: { type: 'automated', check: { kind: 'command', command: "node --test 'test/loop.test.js'" } }
    },
    {
      id: 'AC-6',
      statement: 'The founder’s only job is decisions: gates that need human judgment pause the engine and ask; nothing ever requires the founder to perform an action.',
      phase: 'core',
      verification: { type: 'automated', check: { kind: 'command', command: "node --test 'test/gates.test.js'" } }
    },
    {
      id: 'AC-7',
      statement: 'Signet runs on the founder’s own AI keys and installs with zero third-party runtime code — nothing to subscribe to, nothing to trust but the source.',
      phase: 'core',
      verification: { type: 'automated', check: { kind: 'command', command: 'node -e 'const p=require("./package.json"); process.exit(Object.keys(p.dependencies||{}).length?1:0)'' } }
    },
    {
      id: 'AC-8',
      statement: 'Signet itself was built under a Signet contract: a locked, sealed contract for this engine exists in its own ledger.',
      phase: 'core',
      verification: { type: 'evidence', event_type: 'contract.locked' }
    },
    {
      id: 'AC-9',
      statement: 'The founder-facing surface reads as a fine legal instrument — heavy paper, set type, wax seal — and would never be mistaken for a generic developer dashboard.',
      phase: 'ui',
      verification: { type: 'human_decision', prompt: 'Open the Signet UI. Is it something you would be proud to put in front of an investor?' }
    }
  ],
  no_go: [
    'No IDE or code editor — the founder never sees code.',
    'No hosting or deployment infrastructure — builds target existing free tiers.',
    'No model hosting, fine-tuning, or key custody — keys never leave the founder’s machine.',
    'No autonomous procurement or filing documents in v1.',
    'No template marketplace, multi-tenant SaaS, or billing system.',
    'No uncontracted features, ever — drift is rejected, not absorbed.'
  ],
  quality_bar: [
    'The UI reads as a finely typeset legal instrument, not a developer tool.',
    'Every interrogation question earns its place; skipping is always allowed via stated defaults.',
    'No claim of success without recorded evidence; the promise is "no unverified output ships", never "no mistakes happen".'
  ],
  budget: {
    phases: [
      { name: 'interrogation', max_tokens: 50000, max_usd: 5 },
      { name: 'core', max_tokens: 400000, max_usd: 25 },
      { name: 'ui', max_tokens: 200000, max_usd: 25 },
      { name: 'docs', max_tokens: 100000, max_usd: 10 }
    ]
  },
  decision_points: [
    'Signing (locking) the Build Contract.',
    'Judging every human gate (AC-1, AC-9).',
    'Raising any budget cap — which requires a new contract, since the old one is sealed.',
    'The kill-or-iterate call if the first governed build fails its assumption test.'
  ],
  assumptions: [
    {
      statement: 'Contract discipline — not smarter models — is the binding constraint on build waste.',
      risk: 'high: the whole thesis',
      test: 'Run one real stalled app through Signet end-to-end; compare rework count and API spend against the founder’s current workflow. Iterate once on a miss; a second miss is a kill.'
    },
    {
      statement: 'Founders will accept bring-your-own-keys: free means free software, not free tokens.',
      risk: 'medium',
      test: 'Founder zero completes a governed build using his own key without exceeding a $25 phase cap.'
    },
    {
      statement: 'A funding pack is only differentiated if generated from build evidence, so the ledger must exist from the first build.',
      risk: 'medium: pays off only in v2',
      test: 'v2 Evidence Compiler can cite a ledger seq for at least 90% of the claims in its generated pack.'
    }
  ]
};