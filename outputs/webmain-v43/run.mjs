// Lead Developer self-verification for WEB-MAIN v43 (CSV export + printable report).
// Runs against an OFFLINE harness: Firebase is stubbed with fixtures and has no credentials, so
// this cannot reach Brandi's real Firestore. The stub RECORDS writes rather than performing them,
// which is how the read-only property is tested rather than merely asserted.
import { createRequire } from 'node:module';
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
const fs = require('fs');

const BASE = 'http://127.0.0.1:8917/index.html';
let fail = 0;
const t = (n, c, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  |  ' + d : '')); if (!c) fail++; };
const noise = s => /gstatic|firebase|FCM|Failed to load resource|ERR_/i.test(s);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);

const body = await page.evaluate(() => document.body.innerText || '');
t('app boots against the harness', body.length > 60, body.slice(0, 70).replace(/\n/g, ' | '));
t('no app console errors on load (firebase/CDN noise excluded)', errs.length === 0, errs.slice(0, 2).join(' | '));

// --- reach Reports
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Reports$/.test((x.innerText || '').trim())); if (b) b.click(); });
await page.waitForTimeout(700);
let rb = await page.evaluate(() => document.body.innerText || '');
t('Reports shows the new save-a-copy card', /Save a copy of your records/.test(rb), rb.slice(0, 90).replace(/\n/g, ' | '));
t('the card explains it stays on the device', /Nothing is sent anywhere/.test(rb));
t('the five existing reports are still listed', (rb.match(/History|Weight|Cycle|Bowel|Appetite/g) || []).length >= 5);

// --- touch targets
const sizes = await page.evaluate(() => ['Download CSV', 'Printable report'].map(l => {
  const el = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === l);
  if (!el) return { l, found: false };
  const r = el.getBoundingClientRect();
  return { l, found: true, h: Math.round(r.height), w: Math.round(r.width) };
}));
t('both export buttons exist', sizes.every(s => s.found), JSON.stringify(sizes));
t('both meet the 44px touch floor', sizes.every(s => s.found && s.h >= 44), JSON.stringify(sizes));
t('no horizontal overflow on Reports', (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);

// --- CSV
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Download CSV'); b.click(); })
]);
const csvPath = '/tmp/out.csv';
await dl.saveAs(csvPath);
const csv = fs.readFileSync(csvPath, 'utf8');
t('CSV filename is patient + kind + date', /Brandi-records-\d{4}-\d{2}-\d{2}\.csv/.test(dl.suggestedFilename()), dl.suggestedFilename());
t('CSV starts with a UTF-8 BOM so Excel reads °F correctly', csv.charCodeAt(0) === 0xFEFF);

const lines = csv.replace(/^﻿/, '').split('\r\n');
t('header is the agreed 11 columns', lines[0] === 'Date,Time,Timestamp,Time of day,Type,Med ID,Detail,Amount (mg),Note,Source,Entry ID', lines[0]);

// Parse properly (quoted fields contain commas and newlines).
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' && text[i+1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const rows = parseCsv(csv.replace(/^﻿/, ''));
const data = rows.slice(1).filter(r => r.length > 1);
const col = (r, name) => r[rows[0].indexOf(name)];

t('every row has 11 fields', data.every(r => r.length === 11), 'widths: ' + [...new Set(data.map(r => r.length))].join(','));
t('all 21 fixture documents are present', data.filter(r => col(r, 'Source') === 'logged').length === 21,
  data.filter(r => col(r, 'Source') === 'logged').length + ' logged rows');
t('all three chemo-date records are INCLUDED (excluded by the phone app; her only backup needs them)',
  data.filter(r => col(r, 'Med ID') === 'chemo_date').length === 3);
t('the cleared-chemo tombstone (ts:0) does not print as 1970', !data.some(r => /1970/.test(col(r, 'Date') + col(r, 'Timestamp'))),
  (data.find(r => /1970/.test(r.join(''))) || []).join(' | ') || 'no 1970 anywhere');
t('an entry whose medication was deleted is NOT dropped, and keeps its raw id',
  data.some(r => col(r, 'Med ID') === 'a-deleted-med'), 'row present');
t('Med ID carries the raw id on every row (device-independent restore key)',
  data.every(r => col(r, 'Med ID').length > 0));
t('CSV injection is neutralised', (data.find(r => /cmd\|calc/.test(col(r, 'Note'))) || [])[8] === "'=cmd|calc",
  JSON.stringify((data.find(r => /cmd\|calc/.test(col(r, 'Note'))) || [])[8]));
t('a note with quotes, a comma and a newline survives intact',
  data.some(r => col(r, 'Note') === 'she said "worse", then\nbetter'));
t('an override is recorded as taken early (WEB-MAIN uses boolean override, not overrideReason)',
  data.some(r => /taken early \(override\)/.test(col(r, 'Detail'))));
t('pain level is carried', data.some(r => /pain 9\/10/.test(col(r, 'Detail'))));
t('Tylenol Liquid volume is carried', data.some(r => /30 mL/.test(col(r, 'Detail'))));
t('symptom free-text lives in the Note column and is not truncated',
  data.some(r => col(r, 'Note') === 'sharp rib pain'));
t('temperature exports with its unit', data.some(r => /100\.9/.test(col(r, 'Detail'))));
t('Amount (mg) carries the numeric dose', data.some(r => col(r, 'Amount (mg)') === '1000'));
t('Timestamp is ISO-8601 wherever there is a real time',
  data.filter(r => col(r, 'Timestamp')).every(r => /^\d{4}-\d{2}-\d{2}T/.test(col(r, 'Timestamp'))));
t('derived missed doses are labelled derived, never logged',
  // app-v66: this carried a literal `|| true`, which made the predicate unconditionally true and
  // the assertion permanently green -- a check that cannot fail, in the exact form CLAUDE.md records
  // as having shipped here before. Removed, so the assertion is now the one its name claims.
  data.filter(r => col(r, 'Source') === 'derived').every(r => /not logged/.test(col(r, 'Detail'))));
t('rows are in chronological order', (() => {
  const ts = data.map(r => col(r, 'Timestamp')).filter(Boolean);
  return ts.every((v, i) => i === 0 || ts[i-1] <= v);
})());

// --- printable report
const [dl2] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'Printable report'); b.click(); })
]);
await dl2.saveAs('/tmp/out.html');
const rep = fs.readFileSync('/tmp/out.html', 'utf8');
t('report filename is patient + report + date', /Brandi-report-\d{4}-\d{2}-\d{2}\.html/.test(dl2.suggestedFilename()), dl2.suggestedFilename());
t('report is a complete HTML document', /^<!DOCTYPE html>/.test(rep) && /<\/html>$/.test(rep.trim()));
t('report names the patient', rep.includes('Treatment record — Brandi'));
t('report states it is patient-logged, not clinical', /not a clinical document/.test(rep));
t('report has the doses-by-medication table', /Doses recorded, by medication/.test(rep));
t('report has a symptoms section carrying the free text', /Symptoms reported/.test(rep) && /sharp rib pain/.test(rep));
t('missed doses are flagged derived with the caveat', /class="chip">derived/.test(rep) && /not recorded by the patient/.test(rep));
// Rendering the report against a realistic span produced ~165 "not logged" rows that buried the
// daily log. The report summarises per medication; the CSV keeps every row.
t('the report SUMMARISES missed doses rather than listing every one',
  (() => { const sec = (rep.split('Missed scheduled doses')[1] || '').split('<h2>')[0]; return (sec.match(/<tr/g) || []).length <= 12; })(),
  'rows in the missed section: ' + (((rep.split('Missed scheduled doses')[1] || '').split('<h2>')[0].match(/<tr/g) || []).length));
t('...and still states the true total, so nothing is hidden', /\d+ scheduled doses? with nothing logged/.test(rep),
  (rep.match(/\d+ scheduled doses? with nothing logged/) || ['(absent)'])[0]);
t('...and points at the spreadsheet for the individual occurrences', /listed in the spreadsheet export/.test(rep));
t('the CSV still carries EVERY individual missed dose', data.filter(r => col(r, 'Source') === 'derived').length > 20,
  data.filter(r => col(r, 'Source') === 'derived').length + ' derived rows in the CSV');
t('the reporting period does not run into the future', (() => {
  const m = rep.match(/PERIOD<\/span>|Period<\/span>/i) ? rep.split(/>Period</i)[1] : null;
  const b = (rep.match(/<span>Period<\/span><b[^>]*>([^<]+)<\/b>/) || [])[1] || '';
  const end = b.split('–').pop().trim();
  return !end || new Date(end).getTime() <= Date.now() + 86400000;
})(), (rep.match(/<span>Period<\/span><b[^>]*>([^<]+)<\/b>/) || ['', '(not found)'])[1]);
t('report states the missed-dose tracking floor', /Tracking begins/.test(rep));
t('day tables use fixed layout so columns align across days', /table-layout:fixed/.test(rep));
t('table headers repeat across printed pages', /thead\{display:table-header-group\}/.test(rep));
t('rows never split across a page break', /tr\{break-inside:avoid\}/.test(rep));
t('no stubbed page-number that CSS cannot fill', !/Page <span/.test(rep));
t('the upcoming chemo date appears in the header', /Next treatment date/.test(rep),
  (rep.match(/Next treatment date:[^<]*<b>[^<]*/) || ['(absent)'])[0]);
t('and NOT as a future day at the top of the daily log', (() => {
  const log = rep.split('<h2>Daily log</h2>')[1] || '';
  const heads = [...log.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => new Date(m[1]).getTime());
  return heads.every(t => t <= Date.now());
})(), (rep.split('<h2>Daily log</h2>')[1] || '').slice(0, 60));
t('report escapes HTML rather than injecting it', !/<script/i.test(rep.split('</style>')[1] || ''));

// --- THE load-bearing one
const writes = await page.evaluate(() => window.__fbWrites || []);
t('READ-ONLY: zero writes reached Firestore during the entire export flow', writes.length === 0,
  JSON.stringify(writes).slice(0, 200));
t('no console errors across the whole flow', errs.length === 0, errs.slice(0, 2).join(' | '));

await ctx.close(); await browser.close();
console.log('\n' + (fail === 0 ? 'ALL GREEN' : fail + ' FAILURES'));
process.exit(fail ? 1 : 0);
