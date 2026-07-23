// Governed build loop (v1-minimal, real): every increment must cite acceptance
// criteria from the locked contract or it is rejected as drift — recorded, not absorbed.
// The loop consults the budget governor BEFORE and records spend AFTER every
// provider call. Human-decision gates pause the loop; the founder's job is decisions.

import { verifyLock } from '../contract/lock.js';
import { GateEngine } from '../gates/engine.js';

export class DriftRejectedError extends Error extends Error {