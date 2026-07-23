// Append-only, hash-chained evidence ledger (ADR-0003).
// Every engine action becomes an entry; every entry commits to its predecessor.
// This ledger is the raw material for the v2 Evidence Compiler (funding pack):
// every claim in a future data room cites a seq number here.

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { canonicalize, sha256 } from '../contract/lock.js';

export const GENESIS_PREV = '0'.repeat(64);

export const EVENT_TYPES = [
  'contract.locked',
  'interrogation.started', 'interrogation.question', 'interrogation.answer', 'interrogation.drafted',
  'gate.pass', 'gate.fail',
  'budget.spend', 'budget.cap_hit',
  'decision.requested', 'decision.made',
  'build.increment', 'drift.rejected',
  'note'
];

export class LedgerCorruptError extends Error {}

export class Ledger {
  constructor(path) {
    this.path = path;
    this.entries = [];
    if (existsSync(path)) {
      const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
      this.entries = lines.map((l) => JSON.parse(l));
    }
  }

  get lastHash() {
    return this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS_PREV;
  }

  /** Append an event. Returns the written entry. */
  append(type, payload = {}) {
    if (!EVENT_TYPES.includes(type)) throw new Error(`unknown ledger event type: ${type}`);
    const entry = {
      seq: this.entries.length,
      ts: new Date().toISOString(),
      type,
      payload,
      prev_hash: this.lastHash
    };
    entry.hash = sha256(entry.prev_hash + canonicalize({ seq: entry.seq, ts: entry.ts, type: entry.type, payload: entry.payload }));
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, JSON.stringify(entry) + '\n');
    this.entries.push(entry);
    return entry;
  }

  /** Recompute the full chain. Throws LedgerCorruptError on any break. */
  verify() {
    let prev = GENESIS_PREV;
    for (const e of this.entries) {
      if (e.prev_hash !== prev) throw new LedgerCorruptError(`chain break at seq ${e.seq}: prev_hash mismatch`);
      const expected = sha256(e.prev_hash + canonicalize({ seq: e.seq, ts: e.ts, type: e.type, payload: e.payload }));
      if (expected !== e.hash) throw new LedgerCorruptError(`chain break at seq ${e.seq}: entry hash mismatch`);
      prev = e.hash;
    }
    return { ok: true, length: this.entries.length, head: prev };
  }

  ofType(type) { return this.entries.filter((e) => e.type === type); }
}