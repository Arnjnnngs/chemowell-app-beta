// Lead Developer self-verification for app-v52's three High-severity fixes.
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)
//       env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v52-fixes.mjs
//
// Two environment facts that cost time to rediscover, recorded so the next person doesn't:
//  1. index.html is a single <script type="module">, so NOTHING it declares is reachable from
//     page.evaluate(). Every check here must go through the rendered UI, exactly as a user would.
//  2. This sandbox injects HTTPS_PROXY, which Chromium picks up and then fails on for 127.0.0.1.
//     Clear the proxy vars for the node process, and use 127.0.0.1 rather than localhost.
//     The CDN <script> tags (Capacitor) cannot load here and fail with ERR_CERT_AUTHORITY_INVALID;
//     that is a sandbox artifact, not an app defect, and is filtered out below rather than ignored
//     silently.
//
// This is self-verification per TEAM.md stage 2. It is real, required work and it is NOT a
// substitute for the independent Zero Day Auditor gate.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

const BASE = 'http://127.0.0.1:8899/index.html';
let fail = 0;
const t = (name, cond, detail) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : '')); if (!cond) fail++; };
const isSandboxNoise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr\.net|Failed to load resource/i.test(s);

const browser = await chromium.launch();

for (const vp of [{ name: 'mobile 390px', width: 390, height: 844 }, { name: 'mobile 360px', width: 360, height: 800 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !isSandboxNoise(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => { if (!isSandboxNoise(e.message)) errs.push('pageerror: ' + e.message); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const body = await page.evaluate(() => document.body.innerText || '');
  t(`[${vp.name}] app rendered something`, body.length > 50, body.length + ' chars');
  t(`[${vp.name}] no app console errors (CDN/proxy noise excluded)`, errs.length === 0, errs.slice(0, 3).join(' | '));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  t(`[${vp.name}] no horizontal overflow on first screen`, overflow <= 0, 'overflow=' + overflow + 'px');

  await page.close();
}

// Version is asserted from the file itself; release_check.sh is the mechanical gate that keeps
// index.html and sw.js in step, so this is a belt-and-braces read rather than the real safeguard.
const fs = require('fs');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const v = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const c = (sw.match(/const CACHE = '([^']+)'/) || [])[1];
t('APP_VERSION is app-v52', v === 'app-v52', 'got ' + v);
t('sw.js CACHE matches the version', !!c && c.includes('v52'), 'got ' + c);

// Source-level assertions on the three fixes. These prove the change is present; the Auditor proves
// the behaviour is correct by driving the UI.
t('H-1 renderHistory walks the same day range as pastMissedCount',
  /for \(let d = dayStart\(MISSED_TRACK_SINCE\); d < d0; d = nextDay\(d\)\)[\s\S]{0,200}missedDosesFor\(d, now\)\.length/.test(html));
t('H-2 hasTreatmentDate\\(\\) helper exists', /function hasTreatmentDate\(\)\s*\{\s*return nextChemoTs\(\) !== null;/.test(html));
// Every treatment-window gate must route through the single predicate. The first attempt guarded
// one call site out of seven, so this asserts the ABSENCE of the raw pattern anywhere as well as
// the presence of the helper — a spot-check on one site is what let V52-1 through.
t('H-2 treatmentOnlyBlocks() predicate exists and guards no-date + Other',
  /function treatmentOnlyBlocks\(med, dayTs\)[\s\S]{0,400}isOtherTreatmentType\(\)[\s\S]{0,200}hasTreatmentDate\(\)/.test(html));
t('H-2 no raw "treatmentOnly && !treatmentActiveOn" gate survives anywhere',
  !/treatmentOnly && !treatmentActiveOn\(/.test(html),
  (html.match(/.{0,60}treatmentOnly && !treatmentActiveOn\(.{0,40}/g) || []).join(' || '));
t('H-2 every gate routes through the predicate (>=6 call sites)',
  (html.match(/treatmentOnlyBlocks\(/g) || []).length >= 6,
  (html.match(/treatmentOnlyBlocks\(/g) || []).length + ' call sites');
t('Other profiles: treatment-mode control removed from the editor entirely',
  /isOtherTreatmentType\(\) \? null : h\('div', \{ style: \{ marginTop: '10px' \} \}/.test(html));
t('Other profiles: treatmentExcludedNow is inert',
  /function treatmentExcludedNow\(med, dayTs\) \{\s*\n\s*if \(isOtherTreatmentType\(\)\) return false;/.test(html));
t('Other profiles: Meds-list treatment chips hidden',
  /med\.treatmentMode === 'only' && !isOtherTreatmentType\(\)/.test(html)
  && /med\.treatmentMode === 'excluded' && !isOtherTreatmentType\(\)/.test(html));
t('H-2 Treatment schedule card is no longer hard-blocked for radiation-only',
  !/!isRadiationOnly\(\) && homePref\('showChemoSchedule'\)/.test(html) && /showChemoSchedule' && isRadiationOnly\(\)\) return false/.test(html));
t('H-2 Settings toggle for the schedule card is available to every profile',
  !/!isRadiationOnly\(\) \? toggle\('showChemoSchedule'/.test(html));
t('H-3 export no longer appends a hardcoded pill count',
  !/detail \+= \(detail \? ', ' : ''\) \+ e\.pills \+ ' pill'/.test(html) && /if \(!detail && e\.pills\)/.test(html));

await browser.close();
console.log(fail === 0 ? '\nALL GREEN' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
