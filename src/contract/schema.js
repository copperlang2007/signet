// Signet Build Contract schema + validator. Zero dependencies by design (ADR-0001).
// The contract is the product: a plain-language, machine-enforceable agreement
// between a founder and an AI builder. Every field is either founder-readable
// or machine-checkable — nothing in between.

export const CONTRACT_VERSION = '1.0';

export const VERIFICATION_TYPES = ['automated', 'human_decision', 'evidence'];
export const CHECK_KINDS = ['command', 'file_exists', 'file_absent'];

function isStr(x) { return typeof x === 'string' && x.trim().length > 0; }
function isNum(x) { return typeof x === 'number' && Number.isFinite(x) && x >= 0; }

/**
 * Validate a contract object. Returns { ok, errors[] }.
 * Deliberately strict: an invalid contract must never be lockable.
 */
export function validateContract(c) {
  const errors = [];
  const err = (m) => errors.push(m);

  if (!c || typeof c !== 'object') return { ok: false, errors: ['contract must be an object'] };

  // meta
  if (!c.meta || typeof c.meta !== 'object') err('meta missing');
  else {
    if (!isStr(c.meta.title)) err('meta.title required');
    if (c.meta.version !== CONTRACT_VERSION) err(`meta.version must be "${CONTRACT_VERSION}"`);
    if (!isStr(c.meta.created)) err('meta.created (ISO timestamp) required');
  }

  // problem + outcome
  if (!c.problem || !isStr(c.problem.statement)) err('problem.statement required');
  if (!Array.isArray(c.outcome) || c.outcome.length === 0) err('outcome[] required: what done looks like to the end user');
  else c.outcome.forEach((o, i) => { if (!isStr(o)) err(`outcome[${i}] must be a non-empty string`); });

  // acceptance criteria — the heart of the contract
  if (!Array.isArray(c.acceptance_criteria) || c.acceptance_criteria.length === 0) {
    err('acceptance_criteria[] required');
  } else {
    const ids = new Set();
    c.acceptance_criteria.forEach((a, i) => {
      const p = `acceptance_criteria[${i}]`;
      if (!isStr(a.id)) err(`${p}.id required`);
      else if (ids.has(a.id)) err(`${p}.id duplicate: ${a.id}`);
      else ids.add(a.id);
      if (!isStr(a.statement)) err(`${p}.statement required (plain language, end-user observable)`);
      if (!isStr(a.phase)) err(`${p}.phase required`);
      const v = a.verification;
      if (!v || !VERIFICATION_TYPES.includes(v.type)) {
        err(`${p}.verification.type must be one of ${VERIFICATION_TYPES.join('|')}`);
      } else if (v.type === 'automated') {
        if (!v.check || !CHECK_KINDS.includes(v.check.kind)) err(`${p}.verification.check.kind must be one of ${CHECK_KINDS.join('|')}`);
        else if (v.check.kind === 'command' && !isStr(v.check.command)) err(`${p}.verification.check.command required`);
        else if (v.check.kind !== 'command' && !isStr(v.check.path)) err(`${p}.verification.check.path required`);
      } else if (v.type === 'human_decision' && !isStr(v.prompt)) {
        err(`${p}.verification.prompt required for human_decision`);
      } else if (v.type === 'evidence' && !isStr(v.event_type)) {
        err(`${p}.verification.event_type required for evidence`);
      }
    });
  }

  // no-go list — scope drift is rejected against this
  if (!Array.isArray(c.no_go) || c.no_go.length === 0) err('no_go[] required: what will NOT be built');
  if (c.quality_bar !== undefined && !Array.isArray(c.quality_bar)) err('quality_bar must be an array of strings');

  // budget — hard caps, never advisory
  if (!c.budget || !Array.isArray(c.budget.phases) || c.budget.phases.length === 0) {
    err('budget.phases[] required');
  } else {
    const names = new Set();
    c.budget.phases.forEach((ph, i) => {
      const p = `budget.phases[${i}]`;
      if (!isStr(ph.name)) err(`${p}.name required`);
      else if (names.has(ph.name)) err(`${p}.name duplicate`);
      else names.add(ph.name);
      if (!isNum(ph.max_tokens)) err(`${p}.max_tokens required (number)`);
      if (!isNum(ph.max_usd)) err(`${p}.max_usd required (number)`);
    });
  }

  // decision rights — founder decides, never executes
  if (!Array.isArray(c.decision_points)) err('decision_points[] required (may enumerate zero or more)');

  // assumptions carry their own tests
  if (!Array_isArray(c.assumptions)) err('assumptions[] required');
  else c.assumptions.forEach((a, i) => {
    if (!isStr(a?.statement)) err(`assumptions[${i}].statement required`);
    if (!isStr(a?.test)) err(`assumptions[${i}].test required — an assumption without a test is a hope`);
  });

  return { ok: errors.length === 0, errors };
}