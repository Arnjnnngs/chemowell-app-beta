// app-v63 gate — password-protected backup files.
//
// Aaron asked for this twice. The reason it matters is not abstract: a ChemoWell backup is a
// complete medical record in a plain-text file, and the whole point of the feature is that people
// SEND it — to a second caregiver, by email, through a shared folder. Every one of those routes
// leaves a copy somewhere neither person controls.
//
// The checks that matter most are the ones about failing closed: a wrong password must not open
// the file, a tampered byte must not be restored as if it were sound, and a hostile iteration
// count in a file must not be run. And one check about not leaking: the protected file, and its
// filename, must contain nothing that identifies the patient.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v63-encrypted-backup.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
// Playwright's location is environment-specific: the old sandbox kept it under a user-global npm
// prefix, this one ships it alongside node. Resolving a LIST of candidates instead of one pinned
// absolute path is what lets the same suite run in both. The pinned path made all 39 browser
// suites in these three repos unrunnable the moment the environment changed -- a gate that cannot
// start is indistinguishable from a gate that passes, which is the failure Rule 5 is about.
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/home/claude/.npm-global/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found; tried:\n  ' + tries.join('\n  '));
})();
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' set.'); process.exit(3); }

const FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : new URL('../index.html', import.meta.url).pathname;
const raw = fs.readFileSync(FILE, 'utf8');

let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (d ? '  |  ' + String(d).replace(/\s+/g,' ').slice(0,220) : '')); c ? pass++ : fail++; };
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);

const at = new Date(); at.setHours(14, 0, 0, 0);
const i = raw.indexOf('function simNow() {');
const end = raw.indexOf('\n}', i);
const html = raw.slice(0, i) + 'function simNow() { return ' + at.getTime() + '; ' + raw.slice(end + 1);

const server = http.createServer((rq, rs) => {
  if (rq.url.startsWith('/index.html')) { rs.writeHead(200, {'Content-Type':'text/html'}); rs.end(html); return; }
  rs.writeHead(404); rs.end();
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const port = server.address().port, URL_ = 'http://127.0.0.1:' + port + '/index.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });

const PATIENT = 'Alpha Patient';
const SECRET_NOTE = 'zzzsecretnotetextzzz';
const SECRET_MED = 'Zofranium';
const PASSWORD = 'correct-horse-9';

const onboard = async (name) => {
  await page.fill('input[placeholder="Enter patient name"]', name);
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: 'Chemo', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
  const sk = page.getByRole('button', { name: 'Skip guide' });
  if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(500); }
};
const skipGuide = async () => {
  const sk = page.getByRole('button', { name: 'Skip guide' });
  if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(400); }
};
const gotoSettings = async () => {
  await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(320);
  await page.getByRole('button', { name: /^Settings/ }).first().click(); await page.waitForTimeout(650);
};
const readKey = (k) => page.evaluate((kk) => JSON.parse(localStorage.getItem(kk) || 'null'), k);
const profiles = () => page.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-profiles-v1') || 'null'));

await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await onboard(PATIENT);

console.log('\nPASSWORD-PROTECTED BACKUP FILES — ChemoWell app-v63\n');

const pid = (await profiles()).activeId;
await page.evaluate(([p, note, med]) => {
  const K = (s) => 'chemowell-app-p-' + p + '-' + s;
  localStorage.setItem(K('entries-v1'), JSON.stringify([
    { id: 'a1', medId: 'weight', weight: 150, dose: '150 lbs', mg: 0, ts: Date.now() - 86400000 },
    { id: 'a2', medId: 'weight', weight: 151, dose: '151 lbs', mg: 0, ts: Date.now() - 43200000 }
  ]));
  localStorage.setItem(K('notes-v1'), JSON.stringify([{ id: 'n1', text: note, ts: Date.now() }]));
  localStorage.setItem(K('med-v1'), JSON.stringify({ version: 1, archivedMeds: {},
    meds: [{ id: 'zofran', name: med, generic: 'Ondansetron', doses: [{ label: '8 mg', mg: 8 }] }] }));
}, [pid, SECRET_NOTE, SECRET_MED]);
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600);
await skipGuide();
await gotoSettings();

// Force the download route and capture what it hands to URL.createObjectURL. Headless Chromium
// exposes navigator.share but refuses it without user activation, so leaving it in place tests the
// share branch and produces no file at all.
const killShare = () => page.evaluate(() => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
});
const tapSel = async (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) { b.click(); return true; } return false; }, sel);
const clickSave = async (waitMs) => page.evaluate(async (w) => {
  let captured = null, name = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = function (b) { captured = b; return realCreate.call(URL, b); };
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) name = this.download; return realClick.call(this); };
  const sv = document.querySelector('[data-bk-save]');
  if (sv) sv.click();
  await new Promise(r => setTimeout(r, w));
  URL.createObjectURL = realCreate;
  HTMLAnchorElement.prototype.click = realClick;
  return { text: captured ? await captured.text() : null, name: name };
}, waitMs);

await killShare();

// ---- the switch itself ----
t('ENC-1 the backup section offers a password, and it is off until asked for',
  await page.evaluate(() => {
    const el = document.querySelector('[data-bk-protect]');
    return !!el && el.getAttribute('data-bk-protect') === 'off' && !document.querySelector('#bk-pw');
  }), 'off by default — an unprotected backup is still the fastest path for someone in a hurry');

// Guarded rather than page.click(): on a build without the switch this must report a FAILING
// check, not die with a TimeoutError that hides the other twenty.
const tapProtect = async () => page.evaluate(() => {
  const b = document.querySelector('[data-bk-protect-toggle]');
  if (b) { b.click(); return true; }
  return false;
});
await tapProtect(); await page.waitForTimeout(400);
t('ENC-2 turning it on asks for the password twice',
  await page.evaluate(() => !!document.querySelector('#bk-pw') && !!document.querySelector('#bk-pw2')),
  'no confirm box means a typo becomes an unopenable file');

// ---- refusing to produce a file it cannot stand behind ----
const typePw = async (sel, v) => page.evaluate(([s, vv]) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, vv);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, [sel, v]);
await typePw('#bk-pw', 'short1'); await page.waitForTimeout(250);
await typePw('#bk-pw2', 'short1'); await page.waitForTimeout(250);
const shortRes = await clickSave(1200);
t('ENC-3 a password under the minimum saves nothing and says why',
  shortRes.text === null && await page.evaluate(() => {
    const n = document.querySelector('[data-bk-notice]');
    return !!n && n.getAttribute('data-bk-notice-kind') === 'bad' && /at least 8/.test(n.textContent);
  }), shortRes.text ? 'a file was produced anyway' : 'refused, with the reason named');

await typePw('#bk-pw', PASSWORD); await page.waitForTimeout(250);
await typePw('#bk-pw2', PASSWORD + 'x'); await page.waitForTimeout(250);
const mismatchRes = await clickSave(1200);
t('ENC-4 two passwords that differ save nothing',
  mismatchRes.text === null && await page.evaluate(() => {
    const n = document.querySelector('[data-bk-notice]');
    return !!n && n.getAttribute('data-bk-notice-kind') === 'bad' && /not the same/.test(n.textContent);
  }), mismatchRes.text ? 'a file was produced from a mistyped password' : 'refused');

// ---- the protected file ----
await typePw('#bk-pw2', PASSWORD); await page.waitForTimeout(250);
const encRes = await clickSave(4000);
const encText = encRes.text;
let env = null; try { env = JSON.parse(encText); } catch (e) {}
t('ENC-5 a valid password produces an encrypted envelope',
  !!env && env.encrypted === true && env.cipher === 'AES-GCM' && env.kdf === 'PBKDF2-SHA256' &&
  typeof env.salt === 'string' && env.blob && typeof env.blob.ciphertext === 'string' && typeof env.blob.iv === 'string',
  env ? JSON.stringify({ enc: env.encrypted, kdf: env.kdf, it: env.iterations }) : 'no file / unparsable');

t('ENC-6 nothing in the file identifies the patient',
  !!encText && !encText.includes(PATIENT) && !encText.includes(SECRET_NOTE) && !encText.includes(SECRET_MED) &&
  !!env && env.profileName === undefined,
  'searched the whole file for the patient name, a note and a medication name');

t('ENC-7 the filename carries no patient name either',
  !!encRes.name && /^chemowell-backup-protected-/.test(encRes.name) &&
  !encRes.name.toLowerCase().includes('alpha'),
  'filename was: ' + encRes.name);

t('ENC-8 a protected file declares a version an older build will refuse rather than read as empty',
  !!env && Number(env.formatVersion) === 2,
  'formatVersion=' + (env ? env.formatVersion : 'n/a') + ' — app-v62 caps at 1 and reports "made by a newer version"');

t('ENC-9 the iteration count is high enough to be worth calling a password',
  !!env && Number(env.iterations) >= 310000, 'iterations=' + (env ? env.iterations : 'n/a'));

// ---- opening it again ----
const feed = async (payloadText) => page.evaluate(async (txt) => {
  const rb = document.querySelector('[data-bk-restore]');
  if (rb) rb.click();
  await new Promise(r => setTimeout(r, 350));
  const inp = document.querySelector('input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File([txt], 'b.json', { type: 'application/json' }));
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 900));
  return { locked: !!document.querySelector('[data-bk-unlock]'), choice: !!document.querySelector('[data-bk-choice]') };
}, payloadText);

const fed = await feed(encText);
t('ENC-10 a protected file asks for the password and shows no manifest before it opens',
  fed.locked === true && fed.choice === false,
  'locked=' + fed.locked + ' choiceShown=' + fed.choice + ' — a manifest here would leak what the password protects');

const entsBefore = await readKey('chemowell-app-p-' + pid + '-entries-v1');
await typePw('#bk-unlock-pw', 'not-the-password'); await page.waitForTimeout(250);
await tapSel('[data-bk-unlock-go]'); await page.waitForTimeout(4000);
const entsAfterWrong = await readKey('chemowell-app-p-' + pid + '-entries-v1');
t('ENC-11 a wrong password opens nothing and writes nothing',
  await page.evaluate(() => {
    const n = document.querySelector('[data-bk-notice]');
    return !!document.querySelector('[data-bk-unlock]') && !document.querySelector('[data-bk-choice]') &&
           !!n && /did not open/.test(n.textContent);
  }) && JSON.stringify(entsBefore) === JSON.stringify(entsAfterWrong),
  'still locked, storage byte-identical');

await typePw('#bk-unlock-pw', PASSWORD); await page.waitForTimeout(250);
await tapSel('[data-bk-unlock-go]'); await page.waitForTimeout(4500);
t('ENC-12 the right password opens it and only then asks where it should go',
  await page.evaluate(() => !document.querySelector('[data-bk-unlock]') && !!document.querySelector('[data-bk-choice]')),
  'unlock panel gone, destination choice shown');

t('ENC-13 what came out of the file is the profile that went in',
  await page.evaluate(() => {
    const el = document.querySelector('[data-bk-choice]');
    return !!el && el.textContent.indexOf('Alpha Patient') >= 0;
  }), 'the manifest names the patient the file was made for');

// Land it in a NEW profile so the round trip is proved end to end without touching the original.
await page.evaluate(async () => {
  const pick = document.querySelector('[data-bk-dest="new"]');
  if (pick) pick.click();
  await new Promise(r => setTimeout(r, 400));
  const go = document.querySelector('[data-bk-go]');
  if (go) go.click();
  return 'ok';
}).catch(() => 'reloaded');
await page.waitForTimeout(3000);
await page.waitForLoadState('domcontentloaded').catch(() => {});
const ps = await profiles();
const newPid = ps && ps.list.length === 2 ? ps.list.find(p => p.id !== pid).id : null;
const newEnts = newPid ? await readKey('chemowell-app-p-' + newPid + '-entries-v1') : null;
const newMeds = newPid ? await readKey('chemowell-app-p-' + newPid + '-med-v1') : null;
const newNotes = newPid ? await readKey('chemowell-app-p-' + newPid + '-notes-v1') : null;
t('ENC-14 every record survives the round trip through encryption',
  Array.isArray(newEnts) && newEnts.length === 2 &&
  !!newMeds && Array.isArray(newMeds.meds) && newMeds.meds.length === 1 && newMeds.meds[0].name === SECRET_MED &&
  Array.isArray(newNotes) && newNotes.length === 1 && newNotes[0].text === SECRET_NOTE,
  'entries=' + (newEnts ? newEnts.length : 'null') + ' meds=' + (newMeds && newMeds.meds ? newMeds.meds.length : 'null') +
  ' notes=' + (newNotes ? newNotes.length : 'null'));

// ---- failing closed on hostile files ----
await skipGuide();
await gotoSettings();
await killShare();

const cryptoProbe = await page.evaluate(async ([encJson, pw]) => {
  const T = window.__syncTest;
  if (!T || !T.cwBkDecryptEnvelope) return { hook: false };
  const out = {};
  out.hook = true;
  const base = JSON.parse(encJson);
  // one flipped byte of ciphertext
  const tampered = JSON.parse(encJson);
  const c = tampered.blob.ciphertext;
  const mid = Math.floor(c.length / 2);
  const swap = c[mid] === 'A' ? 'B' : 'A';
  tampered.blob.ciphertext = c.slice(0, mid) + swap + c.slice(mid + 1);
  try { await T.cwBkDecryptEnvelope(tampered, pw); out.tampered = 'OPENED'; }
  catch (e) { out.tampered = e.message; }
  // a denial-of-service iteration count
  const hostile = JSON.parse(encJson);
  hostile.iterations = 900000000;
  const t0 = Date.now();
  try { await T.cwBkDecryptEnvelope(hostile, pw); out.hostile = 'OPENED'; }
  catch (e) { out.hostile = e.message; }
  out.hostileMs = Date.now() - t0;
  // an envelope whose plaintext decrypts fine but is not a backup
  const notBackup = await T.cwBkEncryptPayload({ format: 'something-else', entries: [] }, pw);
  try { await T.cwBkDecryptEnvelope(notBackup, pw); out.notBackup = 'OPENED'; }
  catch (e) { out.notBackup = e.message; }
  // a plaintext file must not be treated as encrypted, and vice versa
  out.isEncTrue = T.cwBkIsEncrypted(base) === true;
  out.isEncFalse = T.cwBkIsEncrypted({ format: 'chemowell-backup', formatVersion: 1, entries: [] }) === false;
  return out;
}, [encText, PASSWORD]);

t('ENC-15 the test hook reached the real browser crypto', cryptoProbe.hook === true,
  'without this hook every check below would pass vacuously');
t('ENC-16 one flipped byte is rejected, not restored',
  cryptoProbe.tampered === 'bad-password',
  'got: ' + cryptoProbe.tampered + ' — AES-GCM authenticates, so a damaged file must fail rather than half-open');
t('ENC-17 an iteration count out of a file is bounded, not run',
  cryptoProbe.hostile === 'unsupported-cipher' && cryptoProbe.hostileMs < 2000,
  'got: ' + cryptoProbe.hostile + ' in ' + cryptoProbe.hostileMs + 'ms — 900 million rounds would freeze the phone');
t('ENC-18 a correctly-encrypted file that is not a backup is still refused',
  cryptoProbe.notBackup === 'damaged',
  'got: ' + cryptoProbe.notBackup + ' — decrypting proves who wrote it, not what it is');
t('ENC-19 protected and unprotected files are told apart',
  cryptoProbe.isEncTrue === true && cryptoProbe.isEncFalse === true, 'both directions');

// ---- the unprotected path is unchanged ----
await page.evaluate(() => {
  const el = document.querySelector('[data-bk-protect]');
  if (el && el.getAttribute('data-bk-protect') === 'on') document.querySelector('[data-bk-protect-toggle]').click();
});
await page.waitForTimeout(400);
const plainRes = await clickSave(1800);
let plain = null; try { plain = JSON.parse(plainRes.text); } catch (e) {}
t('ENC-20 an unprotected backup is still written at version 1, so older phones can read it',
  !!plain && plain.encrypted === undefined && Number(plain.formatVersion) === 1 && plain.format === 'chemowell-backup',
  plain ? ('formatVersion=' + plain.formatVersion) : 'no file');

t('ENC-21 the password is never written to storage',
  await page.evaluate((pw) => {
    for (let i = 0; i < localStorage.length; i++) {
      const v = localStorage.getItem(localStorage.key(i));
      if (v && v.indexOf(pw) >= 0) return false;
    }
    return true;
  }, PASSWORD), 'swept every localStorage key for the password');

t('ENC-22 no console errors during any of it', errs.length === 0, errs.slice(0, 3).join(' || '));

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
