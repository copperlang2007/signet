import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTRACT_VERSION } from '../src/contract/schema.js';

export function tmpFile(name = 'ledger.jsonl') {
  return join(mkdtempSync(join(tmpdir(), 'signet-')), name);
}

/** A minimal valid contract used across tests. */
export function sampleContract(overrides = {}) {
  return {
    meta: { title: 'Test Contract', version: CONTRACT_VERSION, created: '2026-07-23T00:00:00.000Z' },
    problem: { statement: 'Test problem', who_has_it: 'Testers' },
    outcome: ['The tester sees green'],
    acceptance_criteria: [
      { id: 'AC-1', statement: 'True is true', phase: 'core', verification: { type: 'automated', check: { kind: 'command', command: 'true' } } },
      { id: 'AC-2', statement: 'Founder approves the look', phase: 'core', verification: { type: 'human_decision', prompt: 'Do you approve?' } },
      { id: 'AC-3', statement: 'A contract was locked', phase: 'core', verification: { type: 'evidence', event_type: 'contract.locked' } }
    ],
    no_go: ['No scope drift'],
    quality_bar: ['Feels considered'],
    budget: { phases: [{ name: 'core', max_tokens: 10000, max_usd: 1 }, { name: 'interrogation', max_tokens: 20000, max_usd: 1 }] },
    decision_points: ['Approve the look'],
    assumptions: [{ statement: 'Node >= 18 available', risk: 'low', test: 'node --version' }],
    ...overrides
  };
}