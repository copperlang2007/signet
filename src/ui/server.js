// Local founder UI server. Serves ui/index.html and a read-only JSON state API.
// No auth, binds to localhost only: this is the founder's own machine and keys.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ledger } from '../ledger/ledger.js';
import { BudgetGovernor } from '../budget/governor.js';
import { verifyLock } from '../contract/lock.js';

const UI_HTML = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'ui', 'index.html');

export function buildState(p) {
  const state = { brief: null, draft: null, contract: null, seal: null, ledger: [], budget: [], pending_decisions: [], gate_status: {} };
  if (existsSync(p.brief)) state.brief = readFileSync(p.brief, 'utf8');
  if (existsSync(p.draft)) state.draft = JSON.parse(readFileSync(p.draft, 'utf8'));
  if (existsSync(p.contract)) {
    state.contract = JSON.parse(readFileSync(p.contract, 'utf8'));
    try { verifyLock(state.contract); state.seal = { valid: true, hash: state.contract.seal.hash }; }
    catch (e) { state.seal = { valid: false, error: e.message }; }
  }
  if (existsSync(p.ledger)) {
    const ledger = new Ledger(p.ledger);
    try { ledger.verify(); state.ledger_chain = { valid: true, length: ledger.entries.length }; }
    catch (e) { state.ledger_chain = { valid: false, error: e.message }; }
    state.ledger = ledger.entries;
    const c = state.contract;
    if (c) {
      const governor = new BudgetGovernor(c.budget, ledger);
      state.budget = governor.summary();
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
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Signet UI: http://127.0.0.1:${port}  (project: ${p.root})`);
  });
  return server;
}