// PM gate re-verification (commit 64998ad) — FAQ answers now go through helpRich().
// Run: env -u HTTPS_PROXY … node test/pm-v55b.mjs [width]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');

const W = parseInt(process.argv[2] || '360', 10);
const BASE = 'http://127.0.0.1:8899/index.html';
const noise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr|Failed to load resource/i.test(s);
let fail = 0, pass = 0;
const t = (n, c, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  |  ' + d : '')); c ? pass++ : fail++; };

// --- source of truth: pull the 15 FAQ answers straight out of index.html ---
const src = fs.readFileSync('index.html', 'utf8').split('\n');
const s0 = src.findIndex(l => l.startsWith('const FAQ_ITEMS'));
const s1 = s0 + src.slice(s0).findIndex(l => l.trim() === '];');
const faqSrc = [];
for (const line of src.slice(s0, s1 + 1)) {
  const m = line.match(/\{ id: '([^']+)', q: '(.*?)', a: '(.*)' \},?\s*$/);
  if (m) faqSrc.push({ id: m[1], q: m[2], a: m[3] });
}
const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
const stripMd = (s) => unesc(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/`([^`]+)`/g, '$1');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push(m.text()); });
page.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.fill('input[placeholder="Enter patient name"]', 'PM Re');
await page.getByRole('button', { name: 'Female', exact: true }).click();
await page.getByRole('button', { name: 'Chemo', exact: true }).click();
await page.getByRole('button', { name: 'Get started' }).click();
await page.waitForTimeout(900);
const skip = page.getByRole('button', { name: 'Skip guide' });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(320);
await page.getByRole('button', { name: /^Help/ }).first().click();
await page.waitForTimeout(450);

t('B0 15 FAQ entries parsed out of the source', faqSrc.length === 15, faqSrc.length + '');

await page.getByRole('button', { name: /^Common questions/ }).first().click();
await page.waitForTimeout(320);

const rows = page.locator('main section:last-child button[aria-expanded]');
const n = await rows.count();
t('B1 all 15 FAQ rows present', n === 15, n + '');

const dirty = [], mismatch = [], boldOn = [];
for (let i = 0; i < n; i++) {
  const b = rows.nth(i);
  const label = (await b.innerText()).replace(/\n[+−]$/, '').trim();
  await b.click(); await page.waitForTimeout(160);
  const panel = await page.evaluate(() => {
    const btn = document.querySelector('main [aria-expanded="true"]');
    const box = btn && btn.parentElement;
    const div = box && box.querySelector('div:not([aria-expanded])');
    const last = box && box.lastElementChild;
    return last && last !== btn ? { text: last.innerText, strong: last.querySelectorAll('strong').length, em: last.querySelectorAll('em').length, code: last.querySelectorAll('code').length } : null;
  });
  if (!panel) { mismatch.push(label + ' (no panel)'); await b.click(); await page.waitForTimeout(90); continue; }
  if (/\*|`/.test(panel.text)) dirty.push(label + ' :: ' + (panel.text.match(/.{0,45}[*`].{0,25}/) || [''])[0]);
  const srcRow = faqSrc.find(f => norm(unesc(f.q)) === norm(label));
  if (!srcRow) mismatch.push('no source row for "' + label + '"');
  else if (norm(panel.text) !== norm(stripMd(srcRow.a))) {
    mismatch.push(label + '\n      rendered: ' + norm(panel.text).slice(0, 160) + '\n      expected: ' + norm(stripMd(srcRow.a)).slice(0, 160));
  }
  if (panel.strong || panel.em || panel.code) boldOn.push(label + ' [strong=' + panel.strong + ' em=' + panel.em + ' code=' + panel.code + ']');
  await b.click(); await page.waitForTimeout(90);
}
t('B2 no FAQ answer renders a literal * or backtick', dirty.length === 0, dirty.slice(0, 4).join(' ;; '));
t('B3 every FAQ answer renders exactly its source text with markup consumed', mismatch.length === 0, mismatch.slice(0, 3).join('\n    '));
t('B4 only the two rewritten entries carry markup nodes', boldOn.length === 2, boldOn.join(' | '));
t('B5 those two render a real <strong>, i.e. bold Account', boldOn.every(s => /strong=1 em=0 code=0/.test(s)), boldOn.join(' | '));

// B6: the rendered word really is "Account" and it is bold
await rows.filter({ hasText: /How do I switch or add a profile/ }).first().click();
await page.waitForTimeout(220);
const strongTxt = await page.locator('main strong').allInnerTexts();
t('B6 the bold node reads "Account"', strongTxt.includes('Account'), JSON.stringify(strongTxt));
await page.screenshot({ path: 'outputs/pm-v55-02-faq-bold-account-' + W + '.png', fullPage: true });
await rows.filter({ hasText: /How do I switch or add a profile/ }).first().click();
await page.waitForTimeout(150);

// ---- B7: FAQ search still matches text inside and around the markup ----
await page.getByRole('button', { name: 'All help topics' }).first().click();
await page.waitForTimeout(250);
const searchHits = async (q) => {
  await page.locator('#help-search').fill(q);
  await page.waitForTimeout(600);
  return await page.evaluate(() => document.querySelector('main').innerText);
};
let r = await searchHits('switch or add a profile');
t('B7a FAQ found by its question text', /How do I switch or add a profile/.test(r));
r = await searchHits('account separate');
t('B7b FAQ found by a word that is INSIDE the ** markup ("account")', /How do I switch or add a profile/i.test(r), r.split('\n').slice(0, 8).join(' | '));
r = await searchHits('more than one person');
t('B7c the second rewritten FAQ is findable', /caring for more than one/i.test(r), r.split('\n').slice(0, 8).join(' | '));
// opening a FAQ hit from search must still land on the accordion, expanded.
// NB the results list also contains a HELP topic with a near-identical title, so target the
// FAQ row by its exact question text, not by a substring.
await page.getByRole('button', { name: /caring for more than one person .* can I track them all/i }).first().click();
await page.waitForTimeout(500);
const afterHit = await page.evaluate(() => document.querySelector('main').innerText);
t('B7d a FAQ search hit opens the Common-questions accordion, expanded, clean',
  /Common questions/.test(afterHit) && /Free plan includes 1 profile/.test(afterHit) && !/\*|`/.test(afterHit),
  (afterHit.match(/.{0,40}[*`].{0,20}/) || ['clean'])[0] + ' :: ' + afterHit.split('\n').slice(0, 4).join(' | '));

// ---- B8: full 133-row regression sweep for markup leakage ----
await page.waitForTimeout(200);
if (await page.locator('#help-search').count()) { await page.locator('#help-search').fill(''); await page.waitForTimeout(400); }
await page.getByRole('button', { name: 'All help topics' }).first().click().catch(() => {});
await page.waitForTimeout(300);
const cats = (await page.locator('main button').filter({ hasText: /\d+ topics?$/ }).allInnerTexts()).map(s => s.split('\n')[0]);
let seen = 0, leak = [], maxOvf = 0, callouts = [];
for (const cn of cats) {
  await page.getByRole('button', { name: new RegExp('^' + cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
  await page.waitForTimeout(260);
  if (cn === 'Common questions') {
    const q = page.locator('main section:last-child button[aria-expanded]');
    const c = await q.count();
    for (let i = 0; i < c; i++) { await q.nth(i).click(); await page.waitForTimeout(120); const b = await page.evaluate(() => document.querySelector('main').innerText); if (/\*|`/.test(b)) leak.push('FAQ#' + i); seen++; await q.nth(i).click(); await page.waitForTimeout(70); }
  } else {
    const c = await page.locator('main section:last-child > div > div > button').count();
    for (let i = 0; i < c; i++) {
      await page.locator('main section:last-child > div > div > button').nth(i).click();
      await page.waitForTimeout(140); seen++;
      const b = await page.evaluate(() => document.querySelector('main').innerText);
      if (/\*|`/.test(b)) leak.push(cn + '#' + i + ' :: ' + (b.match(/.{0,40}[*`].{0,20}/) || [''])[0]);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > maxOvf) maxOvf = o;
      const hd = await page.evaluate(() => { const x = [...document.querySelectorAll('main div')].find(d => /^(Contact your care team|Not medical advice)$/.test(d.textContent.trim())); return x ? x.textContent.trim() : null; });
      if (hd) callouts.push(hd);
      await page.locator('main > div:first-child > button').first().click(); await page.waitForTimeout(130);
    }
  }
  await page.getByRole('button', { name: 'All help topics' }).first().click();
  await page.waitForTimeout(200);
}
t('B8 all 133 rows opened', seen === 133, seen + '');
t('B9 no * or backtick anywhere in the whole Help centre', leak.length === 0, leak.slice(0, 5).join(' ;; '));
t('B10 no horizontal overflow @' + W, maxOvf <= 0, 'max=' + maxOvf + 'px');
t('B11 medical callout split unchanged: 4 urgent / 5 calm',
  callouts.filter(x => x === 'Contact your care team').length === 4 && callouts.filter(x => x === 'Not medical advice').length === 5,
  JSON.stringify(callouts));
t('BZ zero console errors', errs.length === 0, errs.slice(0, 4).join(' ; '));
console.log('\n' + pass + ' pass, ' + fail + ' fail @' + W + 'px');
await browser.close();
process.exit(fail ? 1 : 0);
