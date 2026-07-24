// Local founder UI server. Serves ui/index.html and a read-only JSON state API.
// No auth, binds to localhost only: this is the founder's own machine and keys.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ledger } from '../ledger/ledger.js';
import { BudgetGovernor } => '../budget/governor.js';
import { verifyLock } from '../contract/lock.js';

const UI_HTML = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'ui', 'index.html');

function readJson(path) {
  // A half-written or hand-corrupted project file must degrade to a visible error,
  // never crash the UI (RED_TEAM round 4). Returns { value } or { error }.
  try { return { value: JSON.parse(readFileSync(path, 'utf8')) }; }
  catch (e) { return { error: `unreadable ${path.split('/').pop()}: ${e.message}` }; }
}

export function buildState(p) {
  const state = { brief: null, draft: null, contract: null, seal: null, ledger: [], budget: [], pending_decisions: [], gate_status: {}, errors: [] };
  if (existsSync(p.brief)) {
    try { state.brief = readFileSync(p.brief, 'utf8'); } catch (e) { state.errors.push(`unreadable brief: ${e.message}`); }
  }
  if (existsSync(p.draft)) {
    const r = readJson(p.draft);
    if (r.error) state.errors.push(r.error); else state.draft = r.value;
  }
  if (existsSync(p.contract)) {
    const r = readJson(p.contract);
    if (r.error) { state.errors.push(r.error); state.seal = { valid: false, error: r.error }; }
    else {
      state.contract = r.value;
      try { verifyLock(state.contract); state.seal = { valid: true, hash: state.contract.seal.hash }; }
      catch (e) { state.seal = { valid: false, error: e.message }; }
    }
  }
  if (existsSync(p.ledger)) {
    let ledger;
    try { ledger = new Ledger(p.ledger); }
    catch (e) { state.errors.push(`unreadable ledger: ${e.message}`); state.ledger_chain = { valid: false, error: e.message }; return state; }
    try { ledger.verify(); state.ledger_chain = { valid: true, length: ledger.entries.length }; }
    catch (e) { state.ledger_chain = { valid: false, error: e.message }; }
    state.ledger = ledger.entries;
    const c = state.contract;
    if (c && c.budget) {
      try {
        const governor = new BudgetGovernor(c.budget, ledger);
        state.budget = governor.summary();
      } catch (e) { state.errors.push(`budget unavailable: ${e.message}`); }
      for (const e of ledger.entries) {
        if (e.type === 'gate.pass') state.gate_status[e.payload.criterion] = 'pass';
        if (e.type === 'gate.fail') state.gate_status[e.payload.criterion] = 'fail';
      }
      const decided = new Set(ledger.ofType('decision.made').map((e) => e.payload.criterion));
      state.pending_decisions = [...new Set(ledger.ofType('decision.requested').map((e) => e.payload.criterion))].filter((x) => !decided.has(x));
    }
  }
  return state;
}

export function serveUi(p, port = Number(process.env.SIGNET_UI_PORT ?? 4177)) {
  const server = createServer((req, res) => {
    // Anti DNS-rebinding: the state payload includes the founder's full brief. Only
    // requests whose Host is loopback are served, so a malicious website cannot rebind
    // a hostname to 127.0.0.1 and read it (RED_TEAM round 1, FLAG).
    const host = String(req.headers.host ?? '').split(':')[0];
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]' && host !== '::1') {
      res.writeHead(403); res.end('forbidden: Signet UI serves loopback only'); return;
    }
    // A thrown handler crashes the whole UI process; never let one bad request do that
    // (RED_TEAM round 4). Any failure becomes a 500 the page can render, not a dead server.
    try {
      if (req.url === '/api/state') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(buildState(p)));
        return;
      }
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(readFileSync(UI_HTML, 'utf8'));
        return;
      }
      res.writeHead(404); res.end('not found');
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `Signet UI server error: ${e.message}` }));
    }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Signet UI: http://127.0.0.1:${port}  (project: ${p.root})`);
  });
  return server;
}
