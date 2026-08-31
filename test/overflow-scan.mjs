// LAYOUT AUDIT — does any text escape its box, at real phone widths, on EVERY screen?
//
// Ported from care-tracker's harness/overflow-scan.mjs, which was written after Aaron said
// (2026-08-29): "how is auditing being done if nothing can be seen to make sure everything looks
// right? ... on an iPhone, some wording spills outside the text box." Both the Zero Day Auditor and
// the PM said the same about this app independently: every gate here is data-layer, and app-v68
// changed two render functions with no render verification of any kind.
//
// THE TRAPS THE care-tracker VERSION PAID FOR, carried over rather than re-learned:
//   - A first version scanned only an empty Home and reported "clean". Overflow needs LONG CONTENT,
//     so this seeds real medication names and a long symptom note.
//   - A first version called navigateTo() inside page.evaluate. This app is a <script type="module">,
//     so navigateTo is not on window: every call threw, a try/catch ate it, and the scan never left
//     Home while reporting five screens walked. This clicks the real nav buttons by data-tour hook.
//   - An unreachable screen is NOT a clean screen. It fails the run.
//
// WHAT IT CANNOT DO, plainly: this is CHROMIUM at iPhone viewport sizes, not Safari. It catches a
// box too small for its content, which is most "text spills out" bugs. It does NOT catch
// WebKit-specific font metrics. A clean run narrows the search; it does not clear Safari.
//
// Run: env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/overflow-scan.mjs
//      --shots <dir>   write a screenshot per width per screen
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const _p = require('node:path');
  const tries = ['playwright',
    _p.join(_p.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright'];
  for (const c of tries) { try { return require(c); } catch (e) {} }
  throw new Error('playwright not found');
})();
for (const v of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy'])
  if (process.env[v]) { console.error('REFUSING: ' + v + ' is set — the suite cannot reach its own local server through a proxy.'); process.exit(3); }

const argv = process.argv.slice(2);
const arg = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i+1] : null; };
const APP_FILE = arg('--file') || new URL('../index.html', import.meta.url).pathname;
const SHOTS = arg('--shots');
const errs = [], escaped = [], warns = [];
const rawHtml = fs.readFileSync(APP_FILE, 'utf-8');

// Both platforms. Aaron, 2026-08-29: "this is being viewed on both iPhone and Android. so both
// matters." Chromium IS Android's engine, so the Android rows are close to what a Galaxy or Pixel
// really renders; the iPhone rows are Chromium at Apple's viewport SIZES — right about boxes too
// small for their content, silent about WebKit font metrics.
// 320 is the iPhone SE/mini floor; 360 is the most common Android width in the world.
const DEVICES = [
  { name: 'iPhone SE (1st gen)',      w: 320, h: 568, os: 'iOS' },
  // BETWEEN THE BREAKPOINTS. This list used to jump 320 -> 360, so a CSS rule with a boundary
  // anywhere in between was never tested on either side of it. That is not hypothetical: the
  // nav-label two-step added in this very release spilled text from 321px to 345px and the scan
  // passed it, because it never looked there. Any release that adds a media query adds a width
  // that must be sampled — and Android's "Display size" setting puts real users right in this band.
  { name: 'Android small (display size)', w: 330, h: 720, os: 'Android' },
  { name: 'Android small (display size)', w: 345, h: 760, os: 'Android' },
  { name: 'Galaxy S/A (most common)', w: 360, h: 800, os: 'Android' },
  { name: 'iPhone SE 2/3, 8',         w: 375, h: 667, os: 'iOS' },
  { name: 'Galaxy S22/S23',           w: 384, h: 854, os: 'Android' },
  { name: 'iPhone 13/14',             w: 390, h: 844, os: 'iOS' },
  { name: 'Pixel 7/8',                w: 393, h: 873, os: 'Android' },
  { name: 'Pixel Pro, Galaxy S+',     w: 412, h: 915, os: 'Android' },
  { name: 'iPhone 14/15 Plus',        w: 428, h: 926, os: 'iOS' }
];

// This app keeps everything on the device, so the fixture is localStorage, written before the page
// script runs. A long medication name, a long dose string and a long free-text symptom are the
// three things that actually stress these layouts — an empty app looks fine at every width.
const P = 'chemowell-app-p-p1-';
const now = Date.now();
const NOON_3D_AGO = (() => { const d = new Date(now - 3 * 86400000); d.setHours(12, 0, 0, 0); return d.getTime(); })();
const SEED_ENTRIES = [
  { id: 's1', medId: 'childrens-liquid-tylenol', dose: '2 tsp (650 mg)', mg: 650, ts: now - 3600000 },
  { id: 's2', medId: 'dexamethasone', dose: '2 tablets', mg: 8, ts: now - 7200000 },
  { id: 's3', medId: 'compazine', dose: '10 mg', mg: 10, ts: now - 14400000 },
  { id: 's4', medId: 'temp', dose: '100.9 F', mg: 0, ts: now - 5400000, temp: 100.9 },
  { id: 's5', medId: 'weight', dose: '182 lbs', mg: 0, ts: now - 9000000, weight: 182 },
  // ANCHORED TO LOCAL NOON, not to "now minus N days". Seeded at an exact multiple of 24h from the
  // moment the suite starts, the treatment date sat on a day boundary: a run that crossed midnight,
  // or a daylight-saving shift, moved it into the previous day and the seeded medication stopped
  // being offered — the suite then failed at all ten widths with "the seeded medication is missing"
  // and nothing wrong with the app. Noon is the furthest point from both edges of a local day.
  { id: 's6', medId: 'chemo_date', dose: 'Treatment scheduled', mg: 0, ts: NOON_3D_AGO, loggedAt: NOON_3D_AGO },
  { id: 's7', medId: 'symptom_nausea', dose: 'Sharp rib pain after the second dose, worse lying down', mg: 0, ts: now - 12600000 }
];
// A medication carrying the app-v68 treatment-window fields, because the med editor and the med
// list chips are exactly what that release changed.
const SEED_MEDS = { version: 1, archivedMeds: [], meds: [
  { id: 'dexamethasone', name: 'Dexamethasone', type: 'win', quickLog: true,
    treatmentMode: 'only', treatmentOnly: true, treatmentDaysBefore: 3, treatmentDaysAfter: 3,
    windows: [{ start: 6, end: 12, name: 'Morning' }, { start: 17, end: 22, name: 'Evening' }] },
  { id: 'childrens-liquid-tylenol', name: "Children's Liquid Tylenol", type: 'prn', quickLog: true,
    doses: ['1 tsp (325 mg)', '2 tsp (650 mg)'] }
]};
// tourDone matters: without it the 10-step welcome guide overlays every screen, and the scan
// measures the tour instead of the app while reporting five screens clean.
const SEED_PREFS = { patientName: 'Test Patient', sex: 'female', treatmentType: 'chemo',
  tourDone: true, ceilingMg: 2500, tempUnit: 'Fahrenheit', weightUnit: 'lbs' };

const SCREENS = ['home', 'meds', 'reports', 'inpatient', 'symptoms'];

// ONE scanner body, shared by the tab loop and the overlay loop. In the original these were two
// copies and they drifted within minutes — the overlay copy silently scanned nothing.
const scanFn = function (vw) {
  // WHAT "SPILLS ITS BOX" ACTUALLY MEANS, rewritten after the Zero Day Auditor deleted the nav-label
  // fix and this scan still said CLEAN. The old test was scrollWidth > clientWidth, which is ALWAYS 0
  // for an inline element -- i.e. for nearly every piece of text in this app -- plus "is it off the
  // viewport", which text overflowing a grid cell in the middle of the screen never is. It also
  // skipped every <select>, because a select has child <option>s and the "leaves only" filter threw
  // it out. It was blind to both defects it had been written to catch.
  //
  // The real question is whether an element sticks out of THE BOX IT IS IN. So: measure each element
  // against its parent's padding box. That catches a 65px label in a 58px grid cell, a select wider
  // than its column, and anything pushed past the edge of the screen, all with one rule.
  const out = [], seen = new Set();
  const isScrollable = cs => cs.overflowX === 'auto' || cs.overflowX === 'scroll';
  const consider = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const text = (el.textContent || '').trim();
    if (!text) return null;
    // Leaves, plus <select> — a select's options are children with text, which is exactly how the
    // previous version excused itself from looking at the control that broke the layout.
    const tag = el.tagName.toLowerCase();
    if (tag !== 'select' && [...el.children].some(c => (c.textContent || '').trim())) return null;
    return { cs, r, text, tag };
  };
  document.querySelectorAll('*').forEach(el => {
    const info = consider(el);
    if (!info) return;
    const { cs, r, text, tag } = info;
    // DELIBERATE TRUNCATION NEEDS BOTH PROPERTIES. text-overflow alone does nothing without an
    // overflow that clips — so treating ellipsis on its own as "intended" switched this check off
    // permanently for any element carrying a text-overflow that never actually truncates anything.
    const clipped = cs.textOverflow === 'ellipsis' &&
      (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflow === 'hidden' || cs.overflow === 'clip');
    let kind = null, overBy = 0;

    // A0. A <select> is measured as a CONTROL, not as text. A closed select renders none of its
    // options, so a Range over its contents measures nothing and the previous version silently
    // covered no dropdown at all while its comment claimed otherwise — the same shape of false
    // claim this scan exists to catch. A dropdown that does not fit its column is the defect that
    // forced this whole app to 379px, so it gets its own rule.
    if (tag === 'select') {
      // NO ELLIPSIS EXEMPTION. This is the third release in which this rule has been claimed and
      // been unable to fire, and the last version disabled itself: the same commit that "fixed" the
      // Days taken dropdown gave it `text-overflow: ellipsis`, and the rule skipped any dropdown
      // that had one. Both medication-editor dropdowns had one, so neither could ever be measured
      // again — and the auditor proved it by putting the long labels back and watching the scan
      // report 60 combinations CLEAN at the very commit that claimed to have caught them.
      //
      // The reasoning was wrong, not just the code. An ellipsis makes truncation VISIBLE; it does
      // not make it ACCEPTABLE. A dropdown whose option reads "As needed — don't flag missed…" has
      // hidden the words that carry the meaning, on a setting that turns missed-dose alerts off.
      // So every dropdown is measured, always, and the ellipsis only changes what the finding is
      // CALLED — a graceful cut is still a cut, and the fix is shorter labels, not a quieter gate.
      //
      // Chromium reports overflow:visible on a <select> whatever the stylesheet says (verified
      // independently by the Zero Day Auditor with hidden/clip/auto and a screenshot) — the control
      // clips natively. That is why the general `clipped` rule cannot be applied here at all.
      const padSelL = parseFloat(cs.paddingLeft) || 0, padSelR = parseFloat(cs.paddingRight) || 0;
      const room = el.clientWidth - padSelL - padSelR;
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;visibility:hidden;';
      probe.style.font = cs.font || (cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily);
      probe.style.letterSpacing = cs.letterSpacing;
      document.body.appendChild(probe);
      let worstOpt = null, worstBy = 0;
      [...el.options].forEach(o => {
        probe.textContent = o.text;
        const need = probe.getBoundingClientRect().width;
        if (room > 0 && need - room > 1.5 && need - room > worstBy) { worstBy = need - room; worstOpt = o.text; }
      });
      probe.remove();
      if (worstOpt) {
        const graceful = cs.textOverflow === 'ellipsis';
        kind = (graceful ? 'the dropdown truncates its own text with an ellipsis ("'
                         : 'the dropdown cuts off its own text ("') + worstOpt.slice(0, 40) + '")';
        overBy = Math.round(worstBy);
      }
      const parentSel = el.parentElement;
      if (!kind && parentSel && !clipped) {
        const pcs = getComputedStyle(parentSel);
        const pr = parentSel.getBoundingClientRect();
        const padL = parseFloat(pcs.paddingLeft) || 0, padR = parseFloat(pcs.paddingRight) || 0;
        const innerW = pr.width - padL - padR;
        if (innerW > 0 && r.width - innerW > 1.5) {
          kind = 'the dropdown is wider than the column it sits in';
          overBy = Math.round(r.width - innerW);
        }
      }
      if (!kind && r.right > vw + 1) { kind = 'the dropdown runs off the right edge'; overBy = Math.round(r.right - vw); }
      if (kind) {
        const labelS = text.slice(0, 64).replace(/\s+/g, ' ');
        const keyS = labelS + '|' + Math.round(r.top) + '|' + kind;
        if (!seen.has(keyS)) { seen.add(keyS);
          out.push({ text: labelS, tag, kind, overBy, box: Math.round(r.width) + 'x' + Math.round(r.height), ws: cs.whiteSpace }); }
      }
      return;
    }
    // A. THE TEXT is wider than the box it has to live in. Aaron's words are "some wording spills
    // outside the text box", so measure the wording, not the element. Comparing the element's RECT to
    // its parent flagged every oversized tap target in the app -- a 44x44 close button overhanging a
    // 39px header slot is deliberate iOS touch sizing, not a defect, and a gate that cries about those
    // is a gate nobody keeps. So: measure the rendered text with a Range and ask whether THAT fits.
    const parent = el.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement && !clipped) {
      const pcs = getComputedStyle(parent);
      const parentClips = isScrollable(pcs) || pcs.overflow === 'auto' || pcs.overflow === 'scroll';
      if (!parentClips && cs.whiteSpace !== 'normal' || !parentClips) {
        const pr = parent.getBoundingClientRect();
        const padL = parseFloat(pcs.paddingLeft) || 0, padR = parseFloat(pcs.paddingRight) || 0;
        const innerW = (pr.width - padL - padR);
        let textW = 0;
        try {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = [...range.getClientRects()];
          textW = rects.length ? Math.max(...rects.map(q => q.width)) : 0;
        } catch (e) { textW = 0; }
        // Also account for the element's own horizontal padding/border: the text has to fit inside
        // the parent along with them.
        const own = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const need = textW + own;
        // 1.5px, not 1: sub-pixel layout rounding produces sub-pixel "overflow" that is not real.
        if (textW > 0 && innerW > 0 && need - innerW > 1.5) {
          kind = 'the wording is wider than the box it sits in';
          overBy = Math.round(need - innerW);
        }
      }
    }
    // B. Its own content does not fit (block elements, scrollable content).
    if (!kind && !isScrollable(cs) && !clipped && el.scrollWidth - el.clientWidth > 1) {
      kind = 'content wider than its box'; overBy = el.scrollWidth - el.clientWidth;
    }
    // C. Past the edge of the screen.
    if (!kind && r.right > vw + 1) { kind = 'off the right edge'; overBy = Math.round(r.right - vw); }
    if (!kind && r.left < -1) { kind = 'off the left edge'; overBy = Math.round(-r.left); }
    if (!kind) return;

    const label = text.slice(0, 64).replace(/\s+/g, ' ');
    const key = label + '|' + Math.round(r.top) + '|' + kind;
    if (seen.has(key)) return; seen.add(key);
    out.push({ text: label, tag, kind, overBy,
      box: Math.round(r.width) + 'x' + Math.round(r.height), ws: cs.whiteSpace });
  });
  return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let problems = 0, unreachable = 0, scanned = 0;
// Set from the EXTRA list below, so the totals line cannot drift from the passes that exist.
let EXTRA_COUNT = 0;
const report = [];

for (const dev of DEVICES) {
  const server = http.createServer((rq, rs) => {
    if (rq.url.startsWith('/index.html')) { rs.writeHead(200, {'Content-Type':'text/html'}); rs.end(rawHtml); return; }
    // 204, not 404. A 404 makes the browser log "Failed to load resource" for every favicon and
    // manifest probe, which would drown the console gate below in noise the app is not responsible
    // for -- and a gate nobody can read is a gate nobody keeps.
    rs.writeHead(204); rs.end();
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const PORT = server.address().port;
  const ctx = await browser.newContext({
    viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, serviceWorkers: 'block'
  });
  // Nothing leaves the machine. The Capacitor plugin scripts are CDN <script> tags that would
  // otherwise be fetched; they are stubbed to nothing, and anything else asking for the network is
  // recorded and aborted so a silent external dependency shows up as a finding rather than a hang.
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1:' + PORT)) return route.continue();
    if (u.includes('cdn.jsdelivr.net')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed for the render scan */' });
    if (u.startsWith('https://fonts.')) return route.abort();
    escaped.push(u); return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e)));
  // THE CONSOLE IS PART OF THE GATE, not colour commentary. This scan's first run printed
  // "Medication configuration could not be loaded: ReferenceError: Cannot access
  // 'TREATMENT_DAYS_MAX' before initialization" -- a const in the temporal dead zone during module
  // init, caught by a try/catch that returned the empty fallback, which silently wiped every saved
  // medication from the app. It reached the console and nowhere else: no crash, no visible error,
  // and all four unit suites green because they lift functions into a VM and never run module init.
  // I saw it only because I happened to be printing warnings while debugging something else. That
  // is not a gate, so it is one now.
  page.on('console', m => {
    if (m.type() !== 'warning' && m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('Service Worker registration blocked by Playwright')) return; // ours, expected
    warns.push(t.slice(0, 300));
  });
  // Seeded BEFORE the module runs — the app reads localStorage on first render, so seeding after
  // load would scan a first-run setup screen and call it Home.
  await page.addInitScript(([p, entries, meds, prefs]) => {
    localStorage.setItem(p + 'entries-v1', JSON.stringify(entries));
    localStorage.setItem(p + 'med-v1', JSON.stringify(meds));
    localStorage.setItem(p + 'prefs-v1', JSON.stringify(prefs));
  }, [P, SEED_ENTRIES, SEED_MEDS, SEED_PREFS]);
  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Proof the fixture took. Without this the scan happily measures a first-run setup screen at all
  // eight widths and reports it clean — the empty-Home trap, one layer down.
  // Two things must be true, and the second is the one that bites: the app is past first-run setup,
  // AND the seeded medication actually reached the screen. Checking only the first would have called
  // a run clean while every medication had been silently dropped on load.
  const seeded = await page.evaluate(async seedName => {
    if (!document.querySelector('[data-tour="nav-home"]')) return 'setup';
    const meds = document.querySelector('[data-tour="nav-meds"]');
    if (!meds) return 'setup';
    meds.click();
    await new Promise(r => setTimeout(r, 700));
    // READ THE FIXTURE. The previous version took seedName as a parameter and never looked at it,
    // while its comment claimed it proved the medication had reached the screen. The Zero Day Auditor
    // made the app throw away every saved medication on load -- the exact end-state of the start-up
    // bug this scan was built to catch -- and it reported "every screen clean at all 8 device widths"
    // and exited 0. A fixture check that does not read the fixture is decoration.
    return document.body.innerText.includes(seedName) ? 'ok' : 'nomeds';
  }, SEED_MEDS.meds[0].name);
  if (seeded !== 'ok') {
    console.log('  FIXTURE DID NOT TAKE at ' + dev.w + 'px — ' +
      (seeded === 'setup' ? 'the app is not past first-run setup' :
       'the seeded medication "' + SEED_MEDS.meds[0].name + '" never reached the screen') +
      ', nothing scanned');
    unreachable += SCREENS.length;
    await ctx.close(); server.close();
    continue;
  }

  // The med editor is a screen too, and it is where the treatment window gets typed — the exact
  // thing app-v68 changed. Walking only the five tabs would have passed a render gate that never
  // rendered the page under change.
  // THE OTHER SIX SCREENS. This scan walked five of the app's eleven, so the one measured, open
  // layout defect on record — the Help search screen at 320px, sitting in BACKLOG.md — is on a
  // screen it never opened. Six more live behind the menu drawer: Account, Calendar, Notes,
  // Help & FAQ, Report a problem, Settings. A render gate that skips half the app is half a gate.
  const DRAWER = ['Account', 'Calendar', 'Notes', 'Help & FAQ', 'Report a problem', 'Settings'];
  const drawerPass = label => ({
    name: 'drawer:' + label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''),
    open: async page => {
      // Back to Home first: the drawer button lives in the header, and a screen left open from the
      // previous pass can sit over it.
      await page.evaluate(() => { const b = document.querySelector('[data-tour="nav-home"]'); if (b) b.click(); });
      await page.waitForTimeout(500);
      const opened = await page.evaluate(() => {
        const b = document.querySelector('[data-tour="menu-btn"]');
        if (!b) return false; b.click(); return true;
      });
      if (!opened) return false;
      await page.waitForTimeout(600);
      const picked = await page.evaluate(want => {
        const row = [...document.querySelectorAll('#app-drawer button')]
          .find(x => (x.innerText || '').trim().split('\n')[0].trim() === want);
        if (!row) return false; row.click(); return true;
      }, label);
      if (!picked) return false;
      await page.waitForTimeout(900);
      // Prove the drawer closed AND something rendered — a click that opened nothing must not count
      // as a scanned screen, which is the trap this file has fallen into twice.
      return page.evaluate(() => {
        if (document.querySelector('#app-drawer')) return false;
        const m = document.querySelector('main');
        return !!(m && m.innerText.trim().length > 60);
      });
    }
  });
  // HELP SEARCH IS ITS OWN SCREEN. Opening Help lands on the category menu; typing lands on the
  // results list, which is a different layout entirely. Same lesson as the schedule-mode dropdown:
  // a screen with states is more than one screen, and the states nobody types into never get looked at.
  //
  // WHAT THIS STILL DOES NOT CATCH, stated plainly rather than implied: BACKLOG.md records a
  // measured defect on exactly this screen — a 235px header strip at 320px leaving the first result
  // 21px visible above the bottom nav. That is a VERTICAL space problem. Every rule in this file
  // measures HORIZONTAL overflow, so a clean run here is not evidence that defect is gone. It is
  // still open, and it needs a check that measures what is reachable above the fold.
  const helpSearchPass = {
    name: 'help-search',
    open: async page => {
      await page.evaluate(() => { const b = document.querySelector('[data-tour="nav-home"]'); if (b) b.click(); });
      await page.waitForTimeout(400);
      const opened = await page.evaluate(() => {
        const b = document.querySelector('[data-tour="menu-btn"]');
        if (!b) return false; b.click(); return true;
      });
      if (!opened) return false;
      await page.waitForTimeout(500);
      const picked = await page.evaluate(() => {
        const row = [...document.querySelectorAll('#app-drawer button')]
          .find(x => (x.innerText || '').trim().split('\n')[0].trim() === 'Help & FAQ');
        if (!row) return false; row.click(); return true;
      });
      if (!picked) return false;
      await page.waitForTimeout(700);
      const box = await page.$('main input[type="search"], main input[type="text"], main input:not([type])');
      if (!box) return false;
      // A word that matches several topics, so the results list is long enough to lay out badly.
      await box.fill('dose');
      await page.waitForTimeout(900);
      // Prove results actually rendered, not just that a box was typed into.
      return page.evaluate(() => {
        const m = document.querySelector('main');
        return !!(m && m.innerText.trim().length > 60 && /result|answer|dose/i.test(m.innerText));
      });
    }
  };
  const EXTRA = [...DRAWER.map(drawerPass), helpSearchPass, { name: 'med-editor', open: async page => {
    const onMeds = await page.evaluate(() => {
      const b = document.querySelector('[data-tour="nav-meds"]');
      if (!b) return false; b.click(); return true;
    });
    if (!onMeds) return false;
    await page.waitForTimeout(900);
    const opened = await page.evaluate(() => {
      // Edit controls are icon buttons labelled by aria-label ("Edit <name>"), not by text --
      // matching innerText finds nothing and the editor never opens. Falling back to Add keeps this
      // screen reachable even when the medication fixture is empty, because an editor that is only
      // scanned when a med happens to exist is an editor that quietly stops being scanned.
      const btns = [...document.querySelectorAll('button')];
      const edit = btns.find(x => /^edit /i.test((x.getAttribute('aria-label') || '').trim()));
      if (edit) { edit.click(); return true; }
      const add = document.querySelector('[data-tour="meds-add"]');
      if (add) { add.click(); return true; }
      return false;
    });
    if (!opened) return false;
    await page.waitForTimeout(700);
    // Same rule as the tabs: a click is not a screen. The editor renders with data-tour="med-editor".
    const reallyOpen = await page.evaluate(() => !!document.querySelector('[data-tour="med-editor"]'));
    if (!reallyOpen) return false;
    // The treatment-window fields are behind the mode picker, and they are precisely what app-v68
    // changed. Scanning the editor without opening that panel scans everything except the change.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')]
        .find(x => /only around|treatment day/i.test((x.innerText || '').trim()));
      if (b) b.click();
    });
    return true;
  } },
  // THE SAME EDITOR, IN THE OTHER SCHEDULE MODE. Some option labels CHANGE with the mode: the
  // "Days taken" dropdown reads "No set days" for an as-needed medication and something longer for
  // a scheduled one. Scanning only the default mode meant the longer text was never rendered, so
  // the scan reported CLEAN while a real truncation sat one dropdown-change away — found by the
  // Zero Day Auditor by hand, not by this scan. A screen with modes is more than one screen.
  { name: 'med-editor-scheduled', open: async page => {
    const onMeds = await page.evaluate(() => {
      const b = document.querySelector('[data-tour="nav-meds"]');
      if (!b) return false; b.click(); return true;
    });
    if (!onMeds) return false;
    await page.waitForTimeout(800);
    const opened = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const edit = btns.find(x => /^edit /i.test((x.getAttribute('aria-label') || '').trim()));
      if (edit) { edit.click(); return true; }
      const add = document.querySelector('[data-tour="meds-add"]');
      if (add) { add.click(); return true; }
      return false;
    });
    if (!opened) return false;
    await page.waitForTimeout(700);
    if (!await page.evaluate(() => !!document.querySelector('[data-tour="med-editor"]'))) return false;
    // Switch Schedule type to "Scheduled" so the mode-dependent option labels actually render.
    const switched = await page.evaluate(() => {
      const sel = [...document.querySelectorAll('select')]
        .find(s => [...s.options].some(o => o.value === 'win'));
      if (!sel) return false;
      sel.value = 'win';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });
    if (!switched) return false;
    await page.waitForTimeout(800);
    // Prove the mode really changed, rather than trusting the dispatch. Read it back off the control
    // itself: an earlier version of this check asked whether the Days-taken select sat inside a
    // <label>, which it does not, so the screen was reported unreachable at every width. The scan
    // refusing to call it clean was the right behaviour — the check was simply wrong.
    return page.evaluate(() => {
      const sel = [...document.querySelectorAll('select')]
        .find(s => [...s.options].some(o => o.value === 'win'));
      return !!(sel && sel.value === 'win');
    });
  } }];

  for (const screen of SCREENS) {
    // PROVE THE VIEW CHANGED, do not just prove a button exists. The previous version clicked and
    // returned true unconditionally; the Zero Day Auditor made three of the five tabs completely
    // dead -- tapping them did nothing at all -- and this reported "48 combinations, 0 problems,
    // CLEAN". That is the same false-clean trap this file's own header describes, moved one level
    // down. The app marks the live tab with aria-current="page", so that is the receipt to demand.
    const navigated = await page.evaluate(async ([key, seedName]) => {
      const btn = document.querySelector('[data-tour="nav-' + key + '"]');
      if (!btn) return 'no nav button for this tab';
      btn.click();
      await new Promise(r => setTimeout(r, 600));
      const live = document.querySelector('[data-tour="nav-' + key + '"]');
      if (!(live && live.getAttribute('aria-current') === 'page')) return 'the tab never became active';
      // AND THE SCREEN MUST HAVE SOMETHING ON IT. A view that renders completely blank still set
      // aria-current and still counted as scanned and clean — 48 combinations, 0 problems, exit 0.
      // "I navigated there" and "there was anything there" are two different claims.
      // MEASURE THE CONTENT REGION, NOT THE PAGE. The bar was on body text minus the nav — but the
      // app header renders on every screen no matter what, so roughly 77 of the 150 characters were
      // furniture and the effective bar was about 74. Two of five screens were unguarded.
      // <main> is the content region; header and nav are outside it.
      const main = document.querySelector('main');
      if (!main) return 'no <main> element rendered';
      const content = main.innerText.trim().length;
      // 60, and deliberately LOW, because a character count cannot do the job people want from it.
      // Measured on this app: the thinnest HONEST screen is 118 characters, and the Meds screen with
      // no medications saved is 154 — while a BROKEN Meds screen that lost every card but kept its
      // title is also about 154. Those two are genuinely indistinguishable by length, so no bar can
      // separate them and a higher one only buys false confidence. This catches what it can honestly
      // catch: a blank or near-blank render. The real check for "the content vanished" is below.
      if (content <= 60) return 'the screen is blank (' + content + ' characters of content)';
      // THE FIXTURE MUST STILL BE ON SCREEN. This is the check that actually catches a screen which
      // lost its content while keeping its heading — the case a length bar cannot see. The scan
      // seeds a medication precisely so there is something specific to look for, and Home and Meds
      // are the two screens that must show it.
      // EVERY SCREEN NEEDS SOMETHING SPECIFIC TO LOOK FOR, not just the two that were easy. I deleted
      // all eight report tiles and every symptom row and this suite said "every screen clean, CLEAN,
      // exit 0" — because only Home and Meds were checked, while the comment implied otherwise.
      // Each screen names a string that exists only when that screen has really rendered its content.
      const must = {
        home:      [seedName],
        meds:      [seedName],
        // The Reports menu is a fixed set of tiles; two of them prove the list rendered, not just
        // the heading above it.
        reports:   ['Report', 'History'],
        // These two have no seeded rows in the fixture, so assert the controls that define the
        // screen — a heading alone is what a broken screen also shows.
        inpatient: ['In-Patient'],
        symptoms:  ['Symptom']
      }[key] || [];
      for (const needle of must) {
        // Name the thing that was missing. "blank, or the seeded medication is missing" was printed
        // for a Reports screen stripped of its tiles, which is neither — a gate that misreports why
        // it failed sends the next person looking in the wrong place.
        if (main.innerText.indexOf(needle) < 0) return 'missing: "' + needle + '"';
      }
      return true;
    }, [screen, SEED_MEDS.meds[0].name]);
    if (navigated !== true) {
      console.log('  COULD NOT REACH ' + screen.toUpperCase() + ' at ' + dev.w + 'px — not scanned (' +
        (typeof navigated === 'string' ? navigated : 'unknown reason') + ')');
      unreachable++;
      continue;
    }
    await page.waitForTimeout(900);
    // THE WHOLE-PAGE WIDTH, checked before the per-element scan — because under mobile emulation the
    // per-element scan CANNOT see this class. If content refuses to fit, Chromium widens the layout
    // viewport instead of overflowing, every element then "fits" its now-wider page, and the scan
    // reports clean while the real phone side-scrolls. That is precisely what happened: a <select>
    // sized to its longest option forced a 379px minimum, and eight widths came back clean.
    const layout = await page.evaluate(() => ({ inner: window.innerWidth, doc: document.documentElement.scrollWidth }));
    if (layout.inner > dev.w + 1 || layout.doc > layout.inner + 1) {
      problems++;
      report.push({ dev: dev.name, os: dev.os, w: dev.w, screen, found: [{
        text: 'THE PAGE ITSELF IS WIDER THAN THE PHONE', tag: 'document',
        kind: 'app needs ' + Math.max(layout.inner, layout.doc) + 'px on a ' + dev.w + 'px screen — it will scroll sideways',
        overBy: Math.max(layout.inner, layout.doc) - dev.w, box: layout.doc + 'x-', ws: 'n/a' }] });
    }
    scanned++;
    const found = await page.evaluate(scanFn, Math.max(dev.w, layout.inner));
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, dev.w + '-' + screen + '.png'), fullPage: true });
    }
    if (found.length) { problems += found.length; report.push({ dev: dev.name, os: dev.os, w: dev.w, screen, found }); }
  }

  EXTRA_COUNT = EXTRA.length;
  for (const extra of EXTRA) {
    const opened = await extra.open(page);
    if (!opened) {
      console.log('  COULD NOT OPEN ' + extra.name + ' at ' + dev.w + 'px — not scanned');
      unreachable++;
      continue;
    }
    await page.waitForTimeout(800);
    const layoutX = await page.evaluate(() => ({ inner: window.innerWidth, doc: document.documentElement.scrollWidth }));
    if (layoutX.inner > dev.w + 1 || layoutX.doc > layoutX.inner + 1) {
      problems++;
      report.push({ dev: dev.name, os: dev.os, w: dev.w, screen: extra.name, found: [{
        text: 'THE PAGE ITSELF IS WIDER THAN THE PHONE', tag: 'document',
        kind: 'app needs ' + Math.max(layoutX.inner, layoutX.doc) + 'px on a ' + dev.w + 'px screen — it will scroll sideways',
        overBy: Math.max(layoutX.inner, layoutX.doc) - dev.w, box: layoutX.doc + 'x-', ws: 'n/a' }] });
    }
    scanned++;
    const found = await page.evaluate(scanFn, Math.max(dev.w, layoutX.inner));
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, dev.w + '-' + extra.name + '.png') });
    }
    if (found.length) { problems += found.length; report.push({ dev: dev.name, os: dev.os, w: dev.w, screen: extra.name, found }); }
  }

  await ctx.close();
  server.close();
}
await browser.close();

if (report.length) {
  report.forEach(r => {
    console.log('\n  ' + r.os + '  ' + r.dev + ' (' + r.w + 'px) — ' + r.screen.toUpperCase() + ' — ' + r.found.length + ' problem(s)');
    r.found.slice(0, 10).forEach(f => {
      console.log('      "' + f.text + '"');
      console.log('        <' + f.tag + '> ' + f.kind + ' by ' + f.overBy + 'px · box ' + f.box + ' · white-space:' + f.ws);
    });
    if (r.found.length > 10) console.log('      ... and ' + (r.found.length - 10) + ' more');
  });
} else {
  console.log('  every screen clean at all ' + DEVICES.length + ' device widths (iOS and Android)');
}
if (errs.length) console.log('\n  PAGE ERRORS: ' + errs.length + '\n    ' + errs.slice(0,3).join('\n    '));
if (warns.length) console.log('\n  CONSOLE WARNINGS/ERRORS: ' + warns.length + '\n    ' + [...new Set(warns)].slice(0,5).join('\n    '));
if (escaped.length) console.log('\n  BLOCKED OUTBOUND REQUESTS: ' + escaped.length + '\n    ' + [...new Set(escaped)].slice(0,5).join('\n    '));
// COUNTED, NOT ASSUMED. This said DEVICES x (SCREENS + 1) — a hardcoded "+1" for the one overlay
// screen. A second overlay pass was added and the counter was not, so a clean run printed
// "60 screen/width combinations" while walking 70, and printed the IDENTICAL sentence as the
// release where the check had been switched off entirely. A gate's own report of what it covered
// has to come from what it actually did.
console.log('\n' + scanned + ' of ' + (DEVICES.length * (SCREENS.length + EXTRA_COUNT)) +
  ' screen/width combinations scanned, ' + problems + ' overflowing element(s).');
if (errs.length || warns.length) {
  console.log('NOT CLEAN — the app logged ' + errs.length + ' page error(s) and ' + warns.length +
    ' console warning(s)/error(s). A caught-and-logged failure is still a failure: this is the exact');
  console.log('  signal that caught a silent wipe of every saved medication while all unit suites were green.');
  process.exit(1);
}
if (unreachable) {
  // A screen the scan could not reach is NOT a clean screen. Reporting it as one is how a render
  // gate ends up blessing a page nobody ever rendered.
  console.log(unreachable + ' screen/width combination(s) COULD NOT BE REACHED and were not scanned.');
  console.log('NOT CLEAN — an unreachable screen is an unchecked screen.');
  process.exit(1);
}
console.log(problems ? 'NOT CLEAN' : 'CLEAN — Android rows are high fidelity (Chromium is Android\'s engine); iOS rows are Chromium at Apple viewport sizes, not Safari.');
process.exit(problems ? 1 : 0);
