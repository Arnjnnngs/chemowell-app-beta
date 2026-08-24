// app-v61 gate — backup and restore, with the destination asked rather than assumed.
//
// Three things depend on this and none are optional: Plus already sells it at $4.99; it is the only
// route Brandi's records take into ChemoWell; and with no accounts and no cloud copy, the backup
// file IS the recovery path.
//
// The checks that matter most are the ones about restraint: a restore must never remove anything,
// must never merge two patients together without being told to, must be safe to run twice, and must
// NEVER be blocked by the free-tier profile cap — refusing someone their own medical history to
// force a $4.99 upgrade is not a paywall, it is hostage-taking.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v61-backup.mjs
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
const t = (n, c, d) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (d ? '  |  ' + String(d).replace(/\s+/g,' ').slice(0,200) : '')); c ? pass++ : fail++; };
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

const onboard = async (name) => {
  await page.fill('input[placeholder="Enter patient name"]', name);
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: 'Chemo', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
  const sk = page.getByRole('button', { name: 'Skip guide' });
  if (await sk.count()) { await sk.first().click(); await page.waitForTimeout(500); }
};
const gotoSettings = async () => {
  await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(320);
  await page.getByRole('button', { name: /^Settings/ }).first().click(); await page.waitForTimeout(650);
};
const keys = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('chemowell-app-p-') === 0));
const readKey = (k) => page.evaluate((kk) => JSON.parse(localStorage.getItem(kk) || 'null'), k);
const profiles = () => page.evaluate(() => JSON.parse(localStorage.getItem('chemowell-app-profiles-v1') || 'null'));

await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await onboard('Alpha Patient');

console.log('\nBACKUP & RESTORE — ChemoWell app-v61\n');

// Seed this profile with real content, then take a backup of it.
const pid = (await profiles()).activeId;
await page.evaluate(([p]) => {
  const K = (s) => 'chemowell-app-p-' + p + '-' + s;
  localStorage.setItem(K('entries-v1'), JSON.stringify([
    { id: 'a1', medId: 'weight', weight: 150, dose: '150 lbs', mg: 0, ts: Date.now() - 86400000 },
    { id: 'a2', medId: 'weight', weight: 151, dose: '151 lbs', mg: 0, ts: Date.now() - 43200000 }
  ]));
  localStorage.setItem(K('notes-v1'), JSON.stringify([{ id: 'n1', text: 'felt ok', ts: Date.now() }]));
  localStorage.setItem(K('med-v1'), JSON.stringify({ version: 1, archivedMeds: {},
    meds: [{ id: 'zofran', name: 'Zofran', generic: 'Ondansetron', doses: [{ label: '8 mg', mg: 8 }] }] }));
}, [pid]);
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1600);
const sk2 = page.getByRole('button', { name: 'Skip guide' });
if (await sk2.count()) { await sk2.first().click(); await page.waitForTimeout(500); }
await gotoSettings();

t('BK-1 the backup section exists in Settings',
  await page.evaluate(() => !!document.querySelector('[data-backup-section]')), 'Export → Backup & restore');

// Capture the produced file by intercepting the download anchor.
// Force the DOWNLOAD route and capture the blob it hands to URL.createObjectURL. Headless Chromium
// exposes navigator.share but refuses it without user activation, so leaving it in place tested the
// share branch and produced no file at all -- which read as "backup is broken" when it was not.
const backupJson = await page.evaluate(async () => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  let captured = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = function (b) { captured = b; return realCreate.call(URL, b); };
  document.querySelector('[data-bk-save]').click();
  await new Promise(r => setTimeout(r, 1400));
  URL.createObjectURL = realCreate;
  return captured ? await captured.text() : null;
});
t('BK-2 saving a backup produces a file', !!backupJson, backupJson ? (backupJson.length + ' bytes') : 'no file was produced');

let parsed = null;
try { parsed = JSON.parse(backupJson); } catch (e) {}
t('BK-3 the file holds everything the profile owns',
  !!parsed && parsed.format === 'chemowell-backup' && parsed.entries.length === 2 &&
  parsed.notes.length === 1 && parsed.medications && parsed.medications.meds.length === 1,
  parsed ? ('entries=' + parsed.entries.length + ' notes=' + parsed.notes.length +
            ' meds=' + (parsed.medications ? parsed.medications.meds.length : 0)) : 'unparsable');

// ---- restore into the SAME profile: additive, idempotent, medication list respected ----
const restore = async (payload, dest) => page.evaluate(async ([pl, d]) => {
  // The hidden file input is created lazily by the Restore button, so it does not exist until
  // that button has been pressed. Querying for it first returned null and the whole suite died
  // on "Cannot set properties of null".
  document.querySelector('[data-bk-restore]').click();
  await new Promise(r => setTimeout(r, 350));
  const inp = document.querySelector('input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(new File([JSON.stringify(pl)], 'b.json', { type: 'application/json' }));
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 900));
  const pick = document.querySelector('[data-bk-dest="' + d + '"]');
  if (pick) pick.click();
  await new Promise(r => setTimeout(r, 400));
  const go = document.querySelector('[data-bk-go]');
  if (!go) return 'no-choice-shown';
  go.click();
  // Return IMMEDIATELY. A successful restore calls location.reload() shortly after, which destroys
  // this execution context -- waiting in here produced "Execution context was destroyed" and killed
  // the run. The wait belongs outside the page.
  return 'ok';
}, [payload, dest]).catch(() => 'reloaded');

const extra = JSON.parse(JSON.stringify(parsed));
extra.entries.push({ id: 'a3', medId: 'weight', weight: 152, dose: '152 lbs', mg: 0, ts: Date.now() });
extra.medications.meds.push({ id: 'senokot', name: 'Senokot', generic: 'Senna', doses: [{ label: '2 pills', mg: 0 }] });

t('BK-4 the destination is always asked before anything is written',
  await page.evaluate(async ([pl]) => {
    document.querySelector('[data-bk-restore]').click();
    await new Promise(r => setTimeout(r, 350));
    const inp = document.querySelector('input[type="file"]');
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(pl)], 'b.json', { type: 'application/json' }));
    inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 900));
    const shown = !!document.querySelector('[data-bk-choice]');
    const c = document.querySelector('[data-bk-cancel]'); if (c) c.click();
    await new Promise(r => setTimeout(r, 300));
    return shown;
  }, [extra]), 'a manifest and two destinations, before any write');

await restore(extra, 'merge');
await page.waitForTimeout(2600);
await page.waitForLoadState('domcontentloaded').catch(() => {});
const ents = await readKey('chemowell-app-p-' + pid + '-entries-v1');
t('BK-5 merging adds only what is new', Array.isArray(ents) && ents.length === 3,
  'expected 3 entries (2 existing + 1 new), got ' + (ents ? ents.length : 'null'));

const meds = await readKey('chemowell-app-p-' + pid + '-med-v1');
t('BK-6 the medication list is not replaced when the profile has one',
  meds && meds.meds.length === 1 && meds.meds[0].id === 'zofran',
  'expected the local list untouched, got ' + (meds ? meds.meds.map(m => m.id).join(',') : 'null'));

const sk3 = page.getByRole('button', { name: 'Skip guide' });
if (await sk3.count()) { await sk3.first().click(); await page.waitForTimeout(400); }
await gotoSettings();
await restore(extra, 'merge');
await page.waitForTimeout(2600);
await page.waitForLoadState('domcontentloaded').catch(() => {});
const ents2 = await readKey('chemowell-app-p-' + pid + '-entries-v1');
t('BK-7 restoring the same file twice changes nothing', Array.isArray(ents2) && ents2.length === 3,
  'expected still 3, got ' + (ents2 ? ents2.length : 'null'));

// ---- restore into a NEW profile, on FREE, which caps at one profile ----
const before = await profiles();
t('BK-8 this is the Free tier, which caps at one profile',
  before.list.length === 1 && (await page.evaluate(() => (JSON.parse(localStorage.getItem('chemowell-app-license-v1') || '{"tier":"free"}')).tier)) === 'free',
  before.list.length + ' profile(s)');

const other = JSON.parse(JSON.stringify(parsed));
other.profileName = 'Beta Patient';
other.entries = [{ id: 'z1', medId: 'weight', weight: 200, dose: '200 lbs', mg: 0, ts: Date.now() }];
const sk4 = page.getByRole('button', { name: 'Skip guide' });
if (await sk4.count()) { await sk4.first().click(); await page.waitForTimeout(400); }
await gotoSettings();
await restore(other, 'new');
await page.waitForTimeout(2600);
await page.waitForLoadState('domcontentloaded').catch(() => {});
const after = await profiles();
t('BK-9 restoring your own data is never blocked by the profile cap',
  after && after.list.length === 2,
  'expected a second profile to be created on Free, got ' + (after ? after.list.length : 'null'));

const newId = after ? after.list[after.list.length - 1].id : null;
const newEnts = newId ? await readKey('chemowell-app-p-' + newId + '-entries-v1') : null;
t('BK-10 the new profile holds the restored records and nothing leaked into the old one',
  Array.isArray(newEnts) && newEnts.length === 1 && newEnts[0].id === 'z1' &&
  (await readKey('chemowell-app-p-' + pid + '-entries-v1')).length === 3,
  'new=' + (newEnts ? newEnts.length : 'null'));

t('BK-11 no console or page errors across the whole run', errs.length === 0, errs[0]);

// ---- app-v62: a restore can be taken back ----
// Aaron: "if someone is doing a backup and it fits wrong or they accidentally add to wrong profile.
// there needs to be a way to undo or capture their live data before input." The destination picker
// reduces the chance of choosing wrong; these checks cover the person who chooses wrong anyway.
t('BK-16 an undo point is captured before a restore writes anything',
  await page.evaluate(() => !!localStorage.getItem('chemowell-app-restore-undo-v1')),
  'the snapshot must exist after the restores above');

t('BK-17 the undo control is offered after a restore',
  await (async () => { await gotoSettings(); return page.evaluate(() => !!document.querySelector('[data-bk-undo]')); })(),
  'not a toast — the person realises a minute later, not in four seconds');

// Undo the LAST restore, which created a second profile for Beta Patient.
const beforeUndo = await profiles();
// Captured BEFORE the undo so BK-20 can require that a point actually existed. Without this it
// passes VACUOUSLY on any build that never creates one -- which is exactly what it did on app-v61.
const undoPointExisted = await page.evaluate(() => !!localStorage.getItem('chemowell-app-restore-undo-v1'));
await page.evaluate(async () => {
  const b = document.querySelector('[data-bk-undo]');
  if (b) b.click();
}).catch(() => {});
await page.waitForTimeout(2600);
await page.waitForLoadState('domcontentloaded').catch(() => {});
const afterUndo = await profiles();

t('BK-18 undoing a restore that created a profile removes that profile',
  beforeUndo.list.length === 2 && afterUndo && afterUndo.list.length === 1,
  'before=' + beforeUndo.list.length + ' after=' + (afterUndo ? afterUndo.list.length : 'null'));

t('BK-19 the original profile is untouched by the undo',
  undoPointExisted && (await readKey('chemowell-app-p-' + pid + '-entries-v1')).length === 3,
  'the profile that was not restored into must be exactly as it was');

t('BK-20 the undo point is consumed, so it cannot be applied twice',
  undoPointExisted && await page.evaluate(() => !localStorage.getItem('chemowell-app-restore-undo-v1')),
  'a second undo would put back a state that is no longer the previous one');

await browser.close(); server.close();

// ---- source guards ----
t('BK-12 restoring is never gated on the paid tier', (() => {
  const m = raw.match(/function createProfileForRestore[\s\S]*?\n\}/);
  return !!m && !/tierLimit/.test(m[0]);
})(), 'createProfileForRestore must not consult tierLimit');
t('BK-13 the restore path only ever adds', (() => {
  const m = raw.match(/function cwBkApplyTo[\s\S]*?\n  return res;/);
  return !!m && !/removeItem|localStorage\.clear/.test(m[0]);
})(), 'no removeItem or clear in the apply path');
t('BK-14 record ids merge on a Map, so an id of "constructor" cannot vanish',
  /function cwBkMergeById[\s\S]{0,400}new Map\(\)/.test(raw));
t('BK-15 Plus no longer says backup is coming', !/Backup & restore[^']*coming in beta/.test(raw));

t('BK-21 a restore refuses to run when no undo point can be saved', (() => {
  // Source-level: both restore paths must bail out with the same honest message rather than
  // writing anyway. Restoring with no way back is the exact risk this feature exists to remove.
  const m = raw.match(/function cwBkConfirmRestore[\s\S]*?\n\}/);
  return !!m && (m[0].match(/not enough free space/g) || []).length === 2;
})(), 'both the new-profile and the merge path must refuse');

t('BK-22 the snapshot copies raw values rather than re-serialising them', (() => {
  const m = raw.match(/function cwSnapshotProfile[\s\S]*?\n\}/);
  return !!m && !/JSON\.parse/.test(m[0]);
})(), 'an undo that returns almost what was there is worse than no undo');

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail === 0 ? 0 : 1);
