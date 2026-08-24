// app-v59 gate — paracentesis becomes its own record, and the legacy weight-entry shape is migrated.
//
// Aaron, 2026-08-21: "we need to add para, but maybe leave it as a standalone so it doesn't affect
// weight trend. there can be notes for weight that can add the para together to see how much was
// drained."
//
// The hard part here is not the new feature, it is the OLD one. ChemoWell has stored paracentesis
// as weightReason:'paracentesis' + litersDrained on the weight entry since app-v21. Shipping a
// second, separate store next to it would leave two non-communicating records of the same event
// and the total litres would be wrong for anyone who had used both. So the data is MOVED, and
// these checks prove the move happens, is idempotent, and does not disturb the weight value.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v59-para.mjs
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
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);

const browser = await chromium.launch();

async function boot() {
  const at = new Date(); at.setHours(14, 0, 0, 0);
  const i = raw.indexOf('function simNow() {');
  const end = raw.indexOf('\n}', i);
  const html = raw.slice(0, i) + 'function simNow() { return ' + at.getTime() + '; ' + raw.slice(end + 1);
  const server = http.createServer((rq, rs) => {
    if (rq.url.startsWith('/index.html')) { rs.writeHead(200, {'Content-Type':'text/html'}); rs.end(html); return; }
    rs.writeHead(404); rs.end();
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });
  const url = 'http://127.0.0.1:' + port + '/index.html';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.fill('input[placeholder="Enter patient name"]', 'Para Test');
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: 'Chemo', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
  const home = async () => { await page.click('[data-tour="nav-home"]'); await page.waitForTimeout(700);
    return page.evaluate(() => document.querySelector('main').innerText); };
  // The entries key does not EXIST until something is saved, so looking for it directly returns
  // undefined on a fresh profile -- and localStorage.setItem(undefined, ...) then happily creates a
  // key called "undefined" that the app never reads. The first version of this file did exactly
  // that and reported the migration broken when the migration was fine. Derive the key from the
  // profile id instead, and fail loudly if it cannot be derived.
  const entriesKey = async () => {
    const k = await page.evaluate(() => {
      const direct = Object.keys(localStorage).find(x => /^chemowell-app-p-.+-entries-v1$/.test(x));
      if (direct) return direct;
      const any = Object.keys(localStorage).find(x => /^chemowell-app-p-.+?-/.test(x));
      const m = any && any.match(/^chemowell-app-p-(.+?)-/);
      return m ? ('chemowell-app-p-' + m[1] + '-entries-v1') : null;
    });
    if (!k) { console.error('could not derive the entries key — seeding would be meaningless'); process.exit(4); }
    return k;
  };
  const readEntries = async () => { const k = await entriesKey();
    return page.evaluate((kk) => JSON.parse(localStorage.getItem(kk) || '[]'), k); };
  const writeEntries = async (rows) => { const k = await entriesKey();
    await page.evaluate(([kk, r]) => localStorage.setItem(kk, JSON.stringify(r)), [k, rows]); };
  const settingsToggle = async (label) => {
    await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(350);
    await page.getByRole('button', { name: /^Settings/ }).first().click(); await page.waitForTimeout(650);
    const r = await page.evaluate((l) => {
      const b = [...document.querySelectorAll('main button')].find(x => (x.innerText||'').startsWith(l));
      if (!b) return 'missing';
      if (b.getAttribute('aria-pressed') !== 'true') b.click();
      return 'ok';
    }, label);
    await page.waitForTimeout(400);
    return r;
  };
  return { page, ctx, server, url, home, readEntries, writeEntries, errs,
           reload: async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
             const s = page.getByRole('button', { name: 'Skip guide' }); if (await s.count()) { await s.first().click(); await page.waitForTimeout(500); } },
           settingsToggle,
           close: async () => { await ctx.close(); server.close(); } };
}

console.log('\nPARACENTESIS — ChemoWell app-v59, standalone record plus legacy migration\n');

const b = await boot();

// Asserted BY ABSENCE against the shipped bytes, not against a screen. Two of the ten were in copy
// no suite opens, so a screen check would have missed them.
//
// app-v66 narrowed this from "nowhere" to "nowhere visible". There is exactly ONE legitimate home
// for the British spelling: the Help search keyword aliases, which are never rendered -- they exist
// to catch what a user TYPES. app-v65 stripped the alias along with the visible copy, and a search
// for "litres" then matched nothing at all: helpStem() turns it into "litr", the index only holds
// "liter", and helpFuzzy()'s 1-edit budget for a 6-letter word cannot bridge the 2-edit gap. The
// term scored 0 AND counted against the denominator, so it actively pushed the topic down.
//
// This gate fails in BOTH directions, which is the point: a "Litres" that creeps back into a
// placeholder or a Help step makes total > inKeywords, and deleting the alias again makes
// inKeywords 0.
const kwBlocks = (raw.match(/keywords:\s*\[[^\]]*\]/g) || []).join(' ');
const litreTotal = (raw.match(/[Ll]itre/g) || []).length;
const litreInKw = (kwBlocks.match(/[Ll]itre/g) || []).length;
t('PARA-0 "litre" appears only as a search alias, never in visible copy',
  litreTotal === litreInKw && litreInKw === 1,
  litreTotal + ' occurrence(s) of "litre", ' + litreInKw + ' of them inside keyword arrays');

t('CW-PARA-1 off by default — no card on Home until it is switched on',
  !/paracentesis/i.test(await b.home()), (await b.home()).slice(0, 120));

// ---- the migration, which is the whole risk of this release ----
await b.writeEntries([
  { id: 'w1', medId: 'weight', weight: 180, unit: 'lbs', dose: '180 lbs', mg: 0, ts: Date.now() - 5*86400000,
    weightReason: 'paracentesis', litersDrained: 4.5 },
  { id: 'w2', medId: 'weight', weight: 176, unit: 'lbs', dose: '176 lbs', mg: 0, ts: Date.now() - 2*86400000,
    weightReason: 'paracentesis', litersDrained: 3 },
  { id: 'w3', medId: 'weight', weight: 175, unit: 'lbs', dose: '175 lbs', mg: 0, ts: Date.now() - 1*86400000,
    weightReason: 'fluid_retention' }
]);
await b.reload();
const after = await b.readEntries();
const paras = after.filter(e => e.medId === 'paracentesis');
const weights = after.filter(e => e.medId === 'weight');

t('CW-PARA-2 legacy records are moved into standalone ones',
  paras.length === 2 && Math.abs(paras.reduce((s,p)=>s+Number(p.liters),0) - 7.5) < 0.001,
  paras.length + ' record(s), ' + paras.map(p=>p.liters).join('+') + ' L');

t('CW-PARA-3 the legacy fields are stripped, so the same drain is never counted twice',
  weights.every(w => w.weightReason !== 'paracentesis' && w.litersDrained === undefined),
  JSON.stringify(weights.map(w => ({ id: w.id, r: w.weightReason, l: w.litersDrained }))));

t('CW-PARA-4 the weight VALUES are untouched by the migration',
  paras.length === 2 && weights.length === 3 && [180,176,175].every(v => weights.some(w => w.weight === v)),
  JSON.stringify(weights.map(w => w.weight)));

t('CW-PARA-5 an unrelated weight reason survives',
  paras.length === 2 && weights.some(w => w.weightReason === 'fluid_retention'), 'fluid_retention must not be collateral damage');

await b.reload();
const twice = (await b.readEntries()).filter(e => e.medId === 'paracentesis');
t('CW-PARA-6 the migration is idempotent — a second load creates nothing new',
  twice.length === 2, twice.length + ' record(s) after two loads');

// ---- the feature itself ----
t('CW-PARA-7 the report appears once records exist, even with the toggle still off',
  /paracentesis/i.test(await (async () => { await b.page.click('[data-tour="nav-reports"]'); await b.page.waitForTimeout(700);
    return b.page.evaluate(() => document.querySelector('main').innerText); })()),
  'migrated data must not become invisible');

t('CW-PARA-8 its report is its OWN, not the Appetite fallthrough',
  await (async () => {
    const txt = await b.page.evaluate(async () => {
      const card=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim().startsWith('Paracentesis'));
      if(!card) return '';
      card.click(); await new Promise(r=>setTimeout(r,800));
      return document.querySelector('main').innerText;
    });
    return /7\.5 L/.test(txt) && /Total drained/i.test(txt) && !/No Appetite|Little to none/i.test(txt);
  })(), 'expected the Paracentesis stat cards and a 7.5 L total');

t('CW-PARA-9 the toggle switches the Home card on',
  await (async () => { const r = await b.settingsToggle('Paracentesis tracking');
    if (r !== 'ok') return false; return /paracentesis/i.test(await b.home()); })(),
  'Settings -> Procedures -> Paracentesis tracking');

t('CW-PARA-10 the Weight report adds the drains together for the window it shows',
  await (async () => {
    await b.page.click('[data-tour="nav-reports"]'); await b.page.waitForTimeout(700);
    const txt = await b.page.evaluate(async () => {
      const card=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim().startsWith('Weight'));
      if(!card) return '';
      card.click(); await new Promise(r=>setTimeout(r,800));
      return document.querySelector('main').innerText;
    });
    return /2 paracentesis procedures in this range/i.test(txt) && /7\.5 L drained/i.test(txt)
        && /not adjusted for drainage/i.test(txt);
  })(), 'the drained total and the unadjusted-weights statement must both be on the Weight report');

t('CW-PARA-11 no console or page errors across the whole run', b.errs.length === 0, b.errs[0]);
await b.close();
await browser.close();

// ---- source guards ----
t('CW-PARA-12 the legacy shape can never be created again',
  !/\{\s*id:\s*'paracentesis',\s*label:/.test(raw) && /weightReasonLabel\(id\)\s*\{\s*if \(id === 'paracentesis'\)/.test(raw),
  'retired from WEIGHT_REASONS, but still resolvable as a label');
t('CW-PARA-13 the Help centre no longer tells people to log it on the weight card',
  !/If you pick \*\*Paracentesis/.test(raw) && /id: "proc-para"/.test(raw),
  'old step removed and a dedicated topic added');
t('CW-PARA-14 weight and litres are never combined arithmetically',
  !/weight\s*[-+]\s*[A-Za-z_.]*[Ll]iters/.test(raw) && !/liters\s*[-+]\s*[A-Za-z_.]*[Ww]eight/.test(raw));
t('CW-PARA-15 no owner name and no pre-saved medication',
  ![...raw.matchAll(/brandi/gi)].some(m => !raw.slice(Math.max(0,m.index-12), m.index+12).toLowerCase().includes('branding'))
  && /DEFAULT_MEDS\s*=\s*\[\s*\]/.test(raw));

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail === 0 ? 0 : 1);
