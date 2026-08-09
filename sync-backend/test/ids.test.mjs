// Local unit checks for the security-relevant helpers in api/_lib/ids.js.
// Run: node test/ids.test.mjs   (from sync-backend/)
// These cover the two Critical findings from outputs/AUDIT_sync_backend_provisioning.md at their
// source: id generation (was Math.random, predictable) and id validation (was absent, allowing
// path traversal out of the profile/ namespace).
import {
  newPairingCode, formatCode, normalizeCode, newId, isSafeId, sha256, safeEqualHex,
} from '../api/_lib/ids.js';

let fail = 0;
const t = (name, cond) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name); if (!cond) fail++; };

// ---- pairing code -----------------------------------------------------------------------
const codes = new Set();
for (let i = 0; i < 20000; i++) codes.add(newPairingCode());
t('20000 codes are all length 10', [...codes].every((c) => c.length === 10));
t('20000 codes are all unique (no collision at sample size)', codes.size === 20000);
t('alphabet excludes ambiguous I, L, O, U', [...codes].every((c) => !/[ILOU]/.test(c)));
t('alphabet coverage is the full 32 chars', new Set([...codes].join('').split('')).size === 32);

const c = newPairingCode();
t('normalize(format(code)) round-trips', normalizeCode(formatCode(c)) === c);
t('normalize accepts lowercase and spaces', normalizeCode(formatCode(c).toLowerCase().replace('-', ' ')) === c);
t('normalize repairs O -> 0', normalizeCode('O' + c.slice(1)) === '0' + c.slice(1));
t('normalize repairs I -> 1', normalizeCode('I' + c.slice(1)) === '1' + c.slice(1));
t('normalize repairs L -> 1', normalizeCode('L' + c.slice(1)) === '1' + c.slice(1));
t('normalize rejects wrong length', normalizeCode('ABC') === null && normalizeCode(c + 'X') === null);
t('normalize rejects non-strings', normalizeCode(null) === null && normalizeCode(123) === null && normalizeCode({}) === null);

// ---- id validation: the path-traversal class --------------------------------------------
const probes = [
  'pair/sess123', '../profile/x/rec1', '..', 'a/b', 'a.b', '%2e%2e%2fx', 'a b', '',
  'x'.repeat(65), 'tok en', './x', String.fromCharCode(92) + 'x', 'a' + String.fromCharCode(0) + 'b',
];
t('isSafeId rejects every traversal/injection probe', probes.every((v) => !isSafeId(v)));
t('isSafeId rejects non-strings', !isSafeId(null) && !isSafeId(undefined) && !isSafeId(5) && !isSafeId({}));
t('isSafeId accepts real generated ids and plain record ids',
  isSafeId(newId('prof')) && isSafeId(newId('sess')) && isSafeId('rec-1_A') && isSafeId('x'.repeat(64)));

// ---- opaque ids -------------------------------------------------------------------------
const ids = new Set();
for (let i = 0; i < 20000; i++) ids.add(newId('prof'));
t('20000 ids are unique', ids.size === 20000);
t('ids are prefix + 26 random chars', [...ids].every((i) => i.length === 30 && i.startsWith('prof')));

// The old scheme embedded Date.now().toString(36), so consecutive ids shared a long identical
// prefix and were largely predictable. Consecutive ids should now diverge almost immediately.
const a = newId('x'); const b = newId('x');
let shared = 0;
for (let i = 1; i < a.length; i++) { if (a[i] === b[i]) shared++; else break; }
t('consecutive ids share no long predictable prefix', shared < 4);

// ---- hashing / constant-time compare -----------------------------------------------------
t('sha256 is stable and 64 hex chars', /^[0-9a-f]{64}$/.test(sha256('abc')) && sha256('abc') === sha256('abc'));
t('safeEqualHex true on match', safeEqualHex(sha256('t'), sha256('t')));
t('safeEqualHex false on mismatch', !safeEqualHex(sha256('t'), sha256('u')));
t('safeEqualHex false on length mismatch and non-strings',
  !safeEqualHex('ab', 'abc') && !safeEqualHex(null, 'a') && !safeEqualHex(undefined, undefined));

console.log(fail === 0 ? 'ALL CHECKS GREEN' : fail + ' FAILURES');
process.exit(fail ? 1 : 0);
