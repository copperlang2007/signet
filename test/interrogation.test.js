import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../src/ledger/ledger.js';
import { Interrogation } from '../src/interrogation/engine.js';
import { MockProvider } from '../src/providers/mock.js';
import { extractJson } from '../src/interrogation/prompts.js';
import { tmpFile, sampleContract } from './helpers.js';

const QUESTIONS = {
  questions: [
    { id: 'Q1', category: 'outcome', question: 'Who exactly clicks first?', why_it_matters: 'wrong user, wrong product', default_if_unanswered: 'the founder themselves' },
    { id: 'Q2', category: 'budget', question: 'Hard monthly cap in USD?', why_it_matters: 'silent overspend kills trust', default_if_unanswered: '$50' }
  ]
};

test('start → questions land in the ledger; answers recorded; draft validates', async () => {
  const ledger = new Ledger(tmpFile());
  const provider = new MockProvider([
    { text: '```json\n' + JSON.stringify(QUESTIONS) + '\n```' },
    { text: JSON.stringify(sampleContract()) }
  ]);
  const i = new Interrogation(provider, ledger);
  const qs = await i.start('BUILD BRIEF: test');
  assert.equal(qs.length, 2);
  assert.equal(ledger.ofType('interrogation.question').length, 2);
  i.answer('Q1', 'my customers');
  const draft = await i.draftContract();
  assert.equal(draft.meta.title, 'Test Contract');
  assert.equal(ledger.ofType('interrogation.drafted').length, 1);
  // unanswered Q2 travels to the drafter with its default, not as a blank
  assert.ok(provider.calls[1].user.includes('use stated default: $50'));
});

test('a drafted contract that fails schema validation is refused', async () => {
  const ledger = new Ledger(tmpFile());
  const bad = sampleContract({ no_go: [] }); // invalid: no edges
  const provider = new MockProvider([
    { text: JSON.stringify(QUESTIONS) },
    { text: JSON.stringify(bad) }
  ]);
  const i = new Interrogation(provider, ledger);
  await i.start('brief');
  await assert.rejects(i.draftContract(), /failed schema validation/);
});

test('extractJson tolerates fences and prose', () => {
  assert.deepEqual(extractJson('sure! ```json\n{"a":1}\n``` hope that helps'), { a: 1 });
  assert.deepEqual(extractJson('{"a":{"b":[1,2]}}'), { a: { b: [1, 2] } });
  assert.throws(() => extractJson('no json here'));
});

test('interrogation state machine refuses out-of-order calls', async () => {
  const i = new Interrogation(new MockProvider([]), new Ledger(tmpFile()));
  assert.throws(() => i.answer('Q1', 'x'), /cannot answer/);
  await assert.rejects(i.draftContract(), /cannot draft/);
});