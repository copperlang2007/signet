import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Ledger, LedgerCorruptError } from '../src/ledger/ledger.js';
import { tmpFile } from './helpers.js';

test('ledger appends, persists, and verifies across reloads', () => {
  const path = tmpFile();
  const l1 = new Ledger(path);
  l1.append('note', { msg: 'first' });
  l1.append('note', { msg: 'second' });
  const l2 = new Ledger(path); // reload from disk
  assert.equal(l2.entries.length, 2);
  assert.deepEqual(l2.verify().ok, true);
});

test('editing any historical entry corrupts the chain', () => {
  const path = tmpFile();
  const l = new Ledger(path);
  l.append('note', { msg: 'honest' });
  l.append('note', { msg: 'also honest' });
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const doctored = JSON.parse(lines[0]);
  doctored.payload.msg = 'rewritten history';
  writeFileSync(path, [JSON.stringify(doctored), lines[1]].join('\n') + '\n');
  assert.throws(() => new Ledger(path).verify(), LedgerCorruptError);
});

test('deleting an entry corrupts the chain', () => {
  const path = tmpFile();
  const l = new Ledger(path);
  l.append('note', { msg: 'a' });
  l.append('note', { msg: 'b' });
  l.append('note', { msg: 'c' });
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
  writeFileSync(path, [lines[0], lines[2]].join('\n') + '\n'); // drop the middle
  assert.throws(() => new Ledger(path).verify(), LedgerCorruptError);
});

test('unknown event types are refused', () => {
  const l = new Ledger(tmpFile());
  assert.throws(() => l.append('made.up.event', {}));
});