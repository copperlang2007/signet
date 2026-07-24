import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { serveUi } from '../src/ui/server.js';
import { lockContract } from '../src/contract/lock.js';
import { Ledger } from '../src/ledger/ledger.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sampleContract } from './helpers.js';

function project() {
  const root = mkdtempSync(join(tmpdir(), 'signet-ui-'));
  const p = { root, brief: join(root, 'brief.md'), draft: join(root, 'd.json'), contract: join(root, 'contract.json'), ledger: join(root, 'ledger.jsonl') };
  writeFileSync(p.brief, 'my private brief with a secret idea');
  const locked = lockContract(sampleContract(), { signed_by: 'Lang' });
  writeFileSync(p.contract, JSON.stringify(locked));
  new Ledger(p.ledger).append('contract.locked', { hash: locked.seal.hash });
  return p;
}

// fetch() forbids overriding the Host header, so drive raw http to simulate the rebind.
function get(port, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/state', method: 'GET', headers: { host: hostHeader } }, (res) => {
      let body = ''; res.on('data', (d) => (body += d)); res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject); req.end();
  });
}

test('UI serves loopback Host and refuses foreign Host (anti DNS-rebinding)', async () => {
  const p = project();
  const server = serveUi(p, 0);
  await once(server, 'listening');
  const port = server.address().port;
  try {
    const ok = await get(port, `127.0.0.1:${port}`);
    assert.equal(ok.status, 200);
    const evil = await get(port, 'attacker.example.com');
    assert.equal(evil.status, 403); // the founder's brief is NOT handed to a rebound hostname
    assert.ok(!evil.body.includes('secret idea'));
  } finally {
    server.close();
  }
});