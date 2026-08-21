// Lead Developer self-verification for app-v55 — the offline Help centre (Owner's "chatbot").
//
// Run:  python3 -m http.server 8899 --directory <repo>   (then)
//       env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v55-help.mjs
//
// Environment facts, recorded so nobody rediscovers them:
//  1. index.html is a single <script type="module">, so NOTHING it declares is reachable from
//     page.evaluate(). Every check here drives the real UI, exactly as a user would.
//  2. This sandbox injects HTTPS_PROXY, which Chromium picks up and then fails on for 127.0.0.1.
//     Clear the proxy vars for the node process and use 127.0.0.1, not localhost. The CDN
//     <script> tags (Capacitor) cannot load here and fail with ERR_CERT_AUTHORITY_INVALID — a
//     sandbox artifact, not an app defect, filtered explicitly below rather than ignored silently.
//  3. A fresh install lands on the welcome screen: name + sex + treatment type + "Get started",
//     then the guided tour has to be dismissed with "Skip guide" before the drawer is usable.
//
// This is self-verification per TEAM.md stage 2. It is real, required work and it is NOT a
// substitute for the independent Zero Day Auditor gate.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8899/index.html';
// v57: EXPECTED_TOPICS was pinned at 117 (outputs/HELPBOT_CONTENT_v1.md, §2 "Total"). Adding one
// help page broke SIX assertions here, none of which was checking anything that had gone wrong --
// which is the same failure mode this file already called out twice, in the tick-guard and cache-key
// comments below. A guard you hand-edit on every release has stopped guarding. The count is now
// READ FROM THE SOURCE, and what is asserted is the INVARIANT: the number the landing copy shows
// the user, and the numbers on the category tiles, must agree with how many topics actually exist.
// That is the real defect class -- copy claiming 117 walkthroughs when 118 shipped -- and it still
// fails. Adding a topic no longer does.
const EXPECTED_FAQ = 15;

let fail = 0;
const t = (name, cond, detail) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  |  ' + detail : ''));
  if (!cond) fail++;
};
const isSandboxNoise = (s) => /ERR_CERT_AUTHORITY_INVALID|ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|cdn\.jsdelivr\.net|Failed to load resource/i.test(s);

// ---------- Source-level assertions (the count in code, and the tick guard) ----------
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const topicsBlock = html.slice(html.indexOf('const HELP_TOPICS = ['), html.indexOf('\n];', html.indexOf('const HELP_TOPICS = [')));
const idMatches = topicsBlock.match(/\{ id: "/g) || [];
const EXPECTED_TOPICS = idMatches.length;
// V57-3 (Auditor, Medium): deriving the count fixed the hand-edit treadmill but opened a hole --
// DELETING a topic became invisible, because every downstream assertion re-derived from the smaller
// number and agreed with itself. The floor is therefore ratcheted to what actually shipped (it goes
// up on the release that adds a page, never down), and the dangling-reference check below is what
// catches a deletion regardless of the count: a removed topic almost always leaves its id behind in
// some other topic's `related` list, and that is a real defect on its own -- a Related chip that
// resolves to nothing renders as a dead end.
t('HELP_TOPICS is at or above the count that shipped in app-v57', EXPECTED_TOPICS >= 118, EXPECTED_TOPICS + ' entries');
{
  const faqIdsAll = (html.slice(html.indexOf('const FAQ_ITEMS = ['), html.indexOf('\n];', html.indexOf('const FAQ_ITEMS = ['))).match(/\{ id: '([^']+)'/g) || []).map(x => x.slice(7, -1));
  const topicIds = new Set((topicsBlock.match(/\{ id: "([^"]+)"/g) || []).map(x => x.slice(7, -1)).concat(faqIdsAll.map(x => 'faq:' + x)).concat(faqIdsAll));
  const dangling = [];
  (topicsBlock.match(/\{ id: "([^"]+)"[\s\S]*?related: \[([^\]]*)\]/g) || []).forEach(chunk => {
    const owner = (chunk.match(/id: "([^"]+)"/) || [])[1];
    const rel = (chunk.match(/related: \[([^\]]*)\]$/) || ['', ''])[1];
    (rel.match(/"([^"]+)"/g) || []).map(x => x.slice(1, -1)).forEach(id => { if (!topicIds.has(id)) dangling.push(owner + ' -> ' + id); });
  });
  t('no topic\'s `related` list points at an id that does not exist', dangling.length === 0, dangling.join(', '));
}
// v57 (Designer S8): careTone splits "this is a question for a person" from "this is red, call now".
// It must never appear on a page that is not already routed to the care team, or a page would carry
// the softer heading without the routing that earns it.
// R2-C (Auditor, round 2): the first version of this matched `\{ id: "..."[\s\S]*?careTone:` lazily
// from the FIRST topic in the block, so every captured chunk spanned intervening topics and picked up
// somebody else's `careLead: true` before the filter ran. He added careTone to sym-log, which is not
// careLead, and it stayed ALL GREEN. Every topic in this corpus is one line, so match per line --
// which is how the other per-topic checks in this file already work.
{
  const lines = topicsBlock.split('\n');
  const strayTone = lines.filter(l => /careTone: "/.test(l) && l.indexOf('careLead: true') < 0)
    .map(l => (l.match(/id: "([^"]+)"/) || [])[1] || l.trim().slice(0, 40));
  t('careTone is only ever set on a topic that is also careLead', strayTone.length === 0, strayTone.join(', '));
  // R2-D: dropping careLead from any ONE of the five left the coverage floor green, so each is pinned
  // by id here. These five are the pages whose answer routes a person to a human; a page silently
  // losing that flag loses its callout, its heading, and its place in the coverage metric at once.
  const CARE_LEAD_PAGES = ['sym-severe', 'sym-medical-question', 'vit-temp-high', 'vit-weight-change', 'miss-real-missed'];
  const lost = CARE_LEAD_PAGES.filter(id => !lines.some(l => l.indexOf('id: "' + id + '"') >= 0 && l.indexOf('careLead: true') >= 0));
  t('all five care-team pages still carry careLead', lost.length === 0, 'lost: ' + lost.join(', '));
}
t('FAQ_ITEMS still has its original ' + EXPECTED_FAQ + ' entries',
  (html.slice(html.indexOf('const FAQ_ITEMS = ['), html.indexOf('\n];', html.indexOf('const FAQ_ITEMS = ['))).match(/\{ id: '/g) || []).length === EXPECTED_FAQ);
t('no step string relies on a newline (the answer div has no white-space:pre-line)',
  !/\\n/.test(topicsBlock));
// v57: was `=== 9`. A topic ADDED with medical: true is not a defect, so an equality check here only
// ever fires on the safe direction. The floor catches the defect (a medical flag silently dropped),
// and the invariant below catches the one that actually matters: a page whose first line routes the
// person to their care team must also be flagged medical, or it escapes every medical-copy review.
t('at least 9 topics carry medical: true (floor rises, never falls)',
  (topicsBlock.match(/medical: true/g) || []).length >= 9,
  (topicsBlock.match(/medical: true/g) || []).length + '');
{
  const careLeadNotMedical = (topicsBlock.match(/\{ id: "[^"]+",[\s\S]*?careLead: true \}/g) || [])
    .filter(chunk => chunk.indexOf('medical: true') < 0)
    .map(chunk => (chunk.match(/id: "([^"]+)"/) || [])[1]);
  t('every careLead topic is also flagged medical', careLeadNotMedical.length === 0, careLeadNotMedical.join(', '));
}
t('2 safety-only topics are flagged (5 safety: true total, 3 of them also medical)',
  (topicsBlock.match(/safety: true/g) || []).length === 5, (topicsBlock.match(/safety: true/g) || []).length + '');
// v56: this was pinned to the exact spelling of the guard line, so adding the help bubble to the
// same guard broke it on a build where the property it checks is MORE protected, not less. Assert
// the invariant -- the Help view is excluded from the tick -- not the punctuation around it. This
// is the second time in two releases an assertion here had to be hand-edited to keep passing;
// that is the signature of a guard that has stopped guarding.
const tickGuard = (html.match(/\n\s*if \(state\.view !== 'help'[\s\S]{0,900}?\) render\(\);/) || [''])[0];
t('the Help view is excluded from the 1s tick guard', /state\.view !== 'help'/.test(tickGuard), tickGuard.slice(0, 60));
t('the tick guard still lists every modal it listed before',
  ['timeModal', 'upgradeOpen', 'drawerOpen', 'apptModal', 'noteModal', 'checkinModal', 'medEditor',
   'infoModal', 'eraseAllModalOpen', 'confirmDeleteMed', 'confirmDeleteAppt', 'confirmDeleteNote',
   'confirmDeleteProfile', 'confirmRemove', 'isEditing'].every(k => tickGuard.indexOf(k) >= 0));
// v57 (Aaron): the row is now "Help & FAQ" -- the FAQ was folded into this centre in v55 and the
// row still said only "Help", so nobody looking for the FAQ knew where it had gone.
t('the drawer row is Help & FAQ, and there is no second FAQ row',
  /\{ key: 'help', label: 'Help & FAQ', icon: 'help'/.test(html) && !/label: 'FAQ'/.test(html));
// v56: pinned literals here would have to be weakened by hand on every release, which is exactly
// how the v52 suite quietly stopped guarding. Assert the invariant instead: whatever version
// index.html declares, sw.js's cache key must name the same one.
const vNow = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const cNow = (sw.match(/const CACHE = '([^']+)'/) || [])[1];
t('APP_VERSION is present and well-formed', /^app-v\d+$/.test(vNow || ''), 'got ' + vNow);
t('sw.js CACHE names the same version index.html declares',
  !!cNow && !!vNow && cNow.indexOf(vNow.replace('app-', '') + '-') >= 0, 'APP_VERSION=' + vNow + '  CACHE=' + cNow);

// ---------- Auditor findings V55-1 … V55-4, asserted at source level ----------
// V55-1: app-v54 made the drawer's identity header non-interactive at Aaron's explicit request.
// Five Help/FAQ entries were still telling people to tap it. The failure mode this guards against
// is the one that has now bitten four times — fixing the control and leaving the copy that
// describes it — so this asserts the ABSENCE of the phrasing anywhere in the file, not the
// presence of a fix at one site.
t('V55-1 no help copy tells the user to tap the name at the top of the menu',
  !/tap (the|your) name at the top/i.test(html),
  (html.match(/.{0,70}tap (the|your) name at the top.{0,40}/gi) || []).join(' || '));

// V55-2: helpRich() rendered **bold** and *italics* and passed `backticks` through as literal
// characters, so the copy's "type exactly this" examples showed their own markup.
t('V55-2 helpRich() has a backtick arm in its tokenizer',
  /const re = \/\\\*\\\*\(\[\^\*\]\+\)\\\*\\\*\|\\\*\(\[\^\*\]\+\)\\\*\|`\(\[\^`\]\+\)`\/g;/.test(html));
t('V55-2 the backtick arm emits a real <code> node',
  /out\.push\(h\('code',/.test(html));
t('V55-2 every backtick in HELP_TOPICS is balanced (an odd one would render literally)',
  (topicsBlock.match(/`/g) || []).length % 2 === 0,
  (topicsBlock.match(/`/g) || []).length + ' backticks');

// PM-1 (PM gate): the V55-1 fix wrote **Account** into two FAQ_ITEMS answers, but FAQ answers were
// handed to the DOM raw -- a second data structure, a different renderer, the same markup
// convention. Both rendered literal asterisks. The scope of the assertion above (HELP_TOPICS only)
// is exactly why it passed green, so the guard now covers BOTH structures and the shared renderer.
const faqBlock = html.slice(html.indexOf('const FAQ_ITEMS = ['), html.indexOf('\n];', html.indexOf('const FAQ_ITEMS = [')));
t('PM-1 FAQ answers are rendered through helpRich(), like every other help string',
  /open \? h\('div', \{[^}]*\}[^)]*\}, \.\.\.helpRich\(item\.a\)\)/.test(html));
t('PM-1 FAQ markup is balanced too (** and ` both)',
  (faqBlock.match(/\*/g) || []).length % 2 === 0 && (faqBlock.match(/`/g) || []).length % 2 === 0,
  (faqBlock.match(/\*/g) || []).length + ' asterisks, ' + (faqBlock.match(/`/g) || []).length + ' backticks');

// V55-3: the calm variant of the medical callout kept the heading "Contact your care team" over
// the standing not-medical-advice disclaimer, on pages about UI mechanics.
// v57 (Designer S8): careLead now decides the ROUTE and careTone decides the WEIGHT, so this pins
// both halves -- the heading still follows the flag rather than being hardcoded, AND the calm
// variant exists so a "what should I expect" page cannot wear the red call-now treatment.
t('V55-3 the callout heading follows the tone rather than being hardcoded',
  /const careHeading = topic\.careLead \? \(calmCare \? 'Ask your care team' : 'Contact your care team'\) : 'Not medical advice';/.test(html)
  && !/\}, 'Contact your care team'\)/.test(html));
t('v57 the urgent red tone is reserved for careLead pages that are NOT careTone calm',
  /const tone = \(topic\.careLead && !calmCare\) \? NOTICE_TONES\.urgent : NOTICE_TONES\.attention;/.test(html));

// V55-4: a dead `state.view === 'faq'` router arm whose comment claimed it caught a persisted
// value. VALID_VIEWS has never contained 'faq', so restoreView() could never return it.
t('V55-4 the dead faq router arm is gone', !/state\.view === 'faq'/.test(html));
t('V55-4 the tick guard no longer references faq either', !/state\.view !== 'faq'/.test(html));
t('V55-4 VALID_VIEWS still does not contain faq (the reason the arm was dead)',
  /const VALID_VIEWS = \[[^\]]*\];/.test(html) && !/const VALID_VIEWS = \[[^\]]*'faq'/.test(html));
t('V55-4 faqOpenId is untouched — that is a live accordion state, not the dead view',
  /faqOpenId: null/.test(html) && (html.match(/faqOpenId/g) || []).length >= 4);

// ---------- Drive the real UI ----------
const browser = await chromium.launch();

async function firstRun(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.fill('input[placeholder="Enter patient name"]', 'Test Patient');
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: 'Chemo', exact: true }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.waitForTimeout(900);
  const skip = page.getByRole('button', { name: 'Skip guide' });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); }
}

const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Retype the search box from empty. Select-all + Backspace goes through the real input event, the
// same way a user clearing the field would, rather than setting .value behind the app's back.
async function setQuery(page, text) {
  await page.locator('#help-search').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
  await page.locator('#help-search').click();
  if (text) await page.keyboard.type(text, { delay: 25 });
  await page.waitForTimeout(450);
}

for (const vp of [{ name: '360px', width: 360, height: 800 }, { name: '390px', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !isSandboxNoise(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => { if (!isSandboxNoise(e.message)) errs.push('pageerror: ' + e.message); });
  const L = (s) => `[${vp.name}] ` + s;

  await firstRun(page);

  // --- drawer -> Help
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(400);
  t(L('drawer has a Help row'), await page.getByRole('button', { name: /^Help/ }).count() > 0);
  await page.getByRole('button', { name: /^Help/ }).first().click();
  await page.waitForTimeout(500);

  let body = await page.evaluate(() => document.body.innerText);
  t(L('Help landing screen renders'), /Find and fix a problem/.test(body));
  t(L('landing states the walkthrough count (' + EXPECTED_TOPICS + ')'),
    body.includes(EXPECTED_TOPICS + ' step-by-step walkthroughs'),
    (body.match(/\d+ step-by-step walkthroughs[^.]*/) || ['(not found)'])[0]);
  t(L('all 17 categories are listed'),
    (await page.locator('main button').filter({ hasText: /\d+ topics?$/ }).count()) === 17,
    (await page.locator('main button').filter({ hasText: /\d+ topics?$/ }).count()) + ' tiles');
  t(L('no horizontal overflow on the Help landing'), (await overflowOf(page)) <= 0, 'overflow=' + (await overflowOf(page)) + 'px');

  // The counts on the tiles must add up to 117 topics + 15 FAQ + 1 pointer row.
  const tileCounts = await page.locator('main button').filter({ hasText: /\d+ topics?$/ }).allInnerTexts();
  const sum = tileCounts.map(s => parseInt((s.match(/(\d+) topics?$/m) || [0, 0])[1], 10)).reduce((a, b) => a + b, 0);
  t(L('category tile counts sum to ' + (EXPECTED_TOPICS + EXPECTED_FAQ + 1)), sum === EXPECTED_TOPICS + EXPECTED_FAQ + 1, 'sum=' + sum);

  // --- browse a category
  await page.getByRole('button', { name: /Reminders & notifications/ }).first().click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  t(L('category screen opens'), /Reminders & notifications/.test(body) && /All help topics/.test(body));
  t(L('category lists its problems'), body.includes('I’m not getting any reminders at all') || body.includes("I'm not getting any reminders at all"));
  t(L('no horizontal overflow in a category'), (await overflowOf(page)) <= 0, 'overflow=' + (await overflowOf(page)) + 'px');

  // --- open a walkthrough (a medical-adjacent one, so the care-team callout is covered)
  await page.getByRole('button', { name: /not getting any reminders at all/ }).first().click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  // Section labels use TYPE.label, which is text-transform:uppercase — innerText reflects that,
  // so these are matched case-insensitively rather than against the literal source string.
  t(L('walkthrough opens with the step list'), /step by step/i.test(body));
  t(L('steps render as separate list items, not one run-on line'),
    (await page.locator('main ol li').count()) >= 6, (await page.locator('main ol li').count()) + ' <li>');
  t(L('branches render'), /There is no Allow background activity button/.test(body));
  t(L('the note renders'), /worth knowing/i.test(body));
  t(L('related topics render as chips'), /^related$/im.test(body));
  // V55-3 live: rem-none is medical-adjacent but is NOT a call-now situation. It must carry the
  // disclaimer under the calm heading — not an instruction to phone the oncologist because a
  // notification didn't arrive.
  t(L('medical-adjacent topic leads with the callout'), /Not medical advice/.test(body));
  t(L('the calm callout carries the standing disclaimer'), /record-keeping tool, not medical advice/.test(body));
  t(L('a non-urgent topic does NOT say "Contact your care team"'), !/Contact your care team/.test(body));
  t(L('no horizontal overflow in a walkthrough'), (await overflowOf(page)) <= 0, 'overflow=' + (await overflowOf(page)) + 'px');

  // --- back out of the walkthrough, into its category
  await page.locator('main > div:first-child > button').first().click();
  await page.waitForTimeout(350);
  body = await page.evaluate(() => document.body.innerText);
  t(L('back from a walkthrough returns to its category'), /Reminders & notifications/.test(body) && /All help topics/.test(body));

  // --- search: typing must not drop characters (the tick-guard bug, shipped four times before)
  const typed = 'greyed out daily limit';
  await page.locator('#help-search').click();
  await page.keyboard.type(typed, { delay: 45 });   // slower than the 1s tick, on purpose
  await page.waitForTimeout(1600);                   // let at least one tick fire mid-typing
  const val = await page.locator('#help-search').inputValue();
  t(L('search box keeps every character typed'), val === typed, 'expected "' + typed + '", got "' + val + '"');

  body = await page.evaluate(() => document.body.innerText);
  t(L('multi-word search finds the right topic'), /Daily limit box is greyed out/.test(body));
  t(L('search results are labelled with their category'), /Adding & editing medications/.test(body));
  t(L('no horizontal overflow on search results'), (await overflowOf(page)) <= 0, 'overflow=' + (await overflowOf(page)) + 'px');

  // --- V55-2 live: the most-reported sticking point is also the entry with the most literal
  // examples in it. Open it and prove the backticks are gone from what the user actually reads.
  await page.getByRole('button', { name: /Daily limit box is greyed out/ }).first().click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  t(L('V55-2 no literal backtick survives into the rendered text'), !body.includes('`'),
    (body.match(/.{0,40}`.{0,40}/) || ['(none)'])[0]);
  t(L('V55-2 the literal examples render as <code> chips'), (await page.locator('main code').count()) >= 4,
    (await page.locator('main code').count()) + ' <code> nodes');
  t(L('V55-2 the example still reads as the user must type it'), /500 mg/.test(body) && /2 sprays/.test(body));
  // whiteSpace:nowrap on the chip is the one thing here that could push the layout wide.
  t(L('V55-2 code chips do not cause horizontal overflow'), (await overflowOf(page)) <= 0,
    'overflow=' + (await overflowOf(page)) + 'px');
  t(L('V55-2 a code chip never renders wider than its column'), await page.evaluate(() => {
    const main = document.querySelector('main');
    const w = main ? main.clientWidth : 9999;
    return Array.from(document.querySelectorAll('main code')).every(c => c.getBoundingClientRect().width <= w);
  }));
  await page.locator('main > div:first-child > button').first().click();   // back to search results
  await page.waitForTimeout(350);

  // --- a "call now" walkthrough, reached from search, keeps the brief's wording verbatim
  await setQuery(page, 'temperature is high');
  await page.getByRole('button', { name: /The temperature is high/ }).first().click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  t(L('vit-temp-high keeps the brief’s "Contact the care team now" wording'),
    body.includes('Contact the care team now.') && body.includes('a fever can be an emergency'));
  t(L('vit-temp-high states no threshold'), !/100\.4|38\s?°|37\.5/.test(body));
  // V55-3 live, the other direction: the four call-now topics must KEEP the urgent heading.
  t(L('a call-now topic still leads with "Contact your care team"'), /Contact your care team/.test(body));
  t(L('back from a search hit says it returns to the results'), /Search results/.test(body));
  await page.locator('main > div:first-child > button').first().click();
  await page.waitForTimeout(350);
  body = await page.evaluate(() => document.body.innerText);
  t(L('back from a search hit returns to the results'), /Search help/i.test(body) && /The temperature is high/.test(body));

  // A term that only appears in `keywords` (not in q or a) must still match.
  //
  // app-v59: this used to search 'paracentesis' and expect the WEIGHT topic, because paracentesis
  // was logged as a reason on the weight card and carried that keyword. It is now its own procedure
  // with its own topic, so 'paracentesis' appears in that topic's question text -- which makes it no
  // longer a keyword-ONLY term and would quietly hollow out the property this check exists to guard.
  // Switched to 'ascites', which appears in proc-para's keywords and nowhere in any question or
  // answer text, so the check still proves exactly what it was written to prove.
  await setQuery(page, 'ascites');
  body = await page.evaluate(() => document.body.innerText);
  t(L('keyword-only search term matches'), /How do I record a paracentesis/.test(body));

  // --- back out, all the way
  await page.getByRole('button', { name: 'Clear' }).first().click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  t(L('Clear returns to the category the search started from'), /Reminders & notifications/.test(body));
  await page.getByRole('button', { name: 'All help topics' }).first().click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  t(L('back reaches the Help landing again'), /Find and fix a problem/.test(body));

  // --- the FAQ is still in here, still an accordion
  await page.getByRole('button', { name: /Common questions/ }).first().click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  t(L('Common questions category holds the original FAQ'), /Who is ChemoWell for\?/.test(body));
  await page.getByRole('button', { name: /Who is ChemoWell for/ }).first().click();
  await page.waitForTimeout(300);
  body = await page.evaluate(() => document.body.innerText);
  t(L('FAQ accordion still expands in place'), /ChemoWell is for patients and their personal or family caregivers/.test(body));

  // --- the pointer cross-link
  await page.getByRole('button', { name: 'All help topics' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Settings & the Home screen/ }).first().click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  t(L('the brief’s pointer entry renders as a cross-link'),
    /Change temperature or weight units/.test(body) && /See “I want pounds instead of kilograms/.test(body));

  // --- V55-3, all nine medical topics (PM-5: the first pass spot-checked 1 urgent and 2 calm,
  // which is the same "verified one of N" shape as the defect it was verifying the fix for).
  // Every medical: true topic is opened and its callout heading read off the rendered page.
  const MEDICAL = [
    { q: 'not getting any reminders at all', find: 'reminders at all', calm: true },
    { q: 'How do I add a medication', find: 'add a medication', calm: true },
    { q: 'Daily limit box is greyed out', find: 'greyed out daily limit', calm: true },
    { q: 'log something the app is blocking', find: 'log something blocking', calm: true },
    { q: 'A dose was genuinely missed', find: 'genuinely missed', calm: false },
    { q: 'The temperature is high', find: 'temperature is high', calm: false },
    { q: 'weight has changed a lot', find: 'weight changed a lot', calm: false },
    { q: 'symptom is severe', find: 'symptom severe frightening', calm: false },
    { q: 'medications say .Restricted', find: 'restricted log them', calm: true }
  ];
  for (const m of MEDICAL) {
    await setQuery(page, m.find);
    const row = page.getByRole('button', { name: new RegExp(m.q) }).first();
    if (!(await row.count())) { t(L('V55-3 could reach "' + m.q + '"'), false, 'search "' + m.find + '" found no row'); continue; }
    await row.click();
    await page.waitForTimeout(320);
    body = await page.evaluate(() => document.body.innerText);
    const wantCalm = m.calm;
    t(L('V55-3 "' + m.q + '" heading is ' + (wantCalm ? 'Not medical advice' : 'Contact your care team')),
      wantCalm ? (/Not medical advice/.test(body) && !/Contact your care team/.test(body))
               : (/Contact your care team/.test(body) && !/Not medical advice/.test(body)));
    // PM-1 live, on every medical page: no markup character may reach the reader.
    t(L('V55-2/PM-1 no raw markup on "' + m.q + '"'), !body.includes('`') && !body.includes('**'),
      (body.match(/.{0,30}(\*\*|`).{0,30}/) || ['(none)'])[0]);
    await page.locator('main > div:first-child > button').first().click();
    await page.waitForTimeout(250);
  }

  // --- PM-1 live: every FAQ answer, expanded, must be free of literal ** as well.
  await page.getByRole('button', { name: 'Clear' }).first().click();
  await page.waitForTimeout(300);
  if (!/Find and fix a problem/.test(await page.evaluate(() => document.body.innerText))) {
    await page.getByRole('button', { name: 'All help topics' }).first().click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: /Common questions/ }).first().click();
  await page.waitForTimeout(350);
  const faqRows = await page.locator('main section:last-of-type button[aria-expanded]').count();
  t(L('PM-1 all 15 FAQ rows are expandable'), faqRows === EXPECTED_FAQ, faqRows + ' rows');
  let faqMarkup = [];
  for (let i = 0; i < faqRows; i++) {
    const btn = page.locator('main section:last-of-type button[aria-expanded]').nth(i);
    const label = (await btn.innerText()).split('\n')[0];
    await btn.click();
    await page.waitForTimeout(120);
    const txt = await page.evaluate(() => document.body.innerText);
    if (txt.includes('**') || txt.includes('`')) faqMarkup.push(label);
    await btn.click();
    await page.waitForTimeout(80);
  }
  t(L('PM-1 no FAQ answer renders literal ** or backticks'), faqMarkup.length === 0, faqMarkup.join(' | '));
  await page.getByRole('button', { name: 'All help topics' }).first().click();
  await page.waitForTimeout(300);

  // --- nothing-matched state
  await page.getByRole('button', { name: /Reminders & notifications/ }).first().click();
  await page.waitForTimeout(300);
  await page.locator('#help-search').click();
  await page.keyboard.type('zzzqqq', { delay: 20 });
  await page.waitForTimeout(500);
  body = await page.evaluate(() => document.body.innerText);
  t(L('empty search state is handled'), /Nothing matched that/.test(body));

  // --- every one of the 117 walkthroughs opens without an error
  await page.getByRole('button', { name: 'Clear' }).first().click();
  await page.waitForTimeout(300);
  if (!/Find and fix a problem/.test(await page.evaluate(() => document.body.innerText))) {
    await page.getByRole('button', { name: 'All help topics' }).first().click();
    await page.waitForTimeout(300);
  }
  let opened = 0, missingSteps = [];
  const catTiles = await page.locator('main button').filter({ hasText: /\d+ topics?$/ }).count();
  for (let ci = 0; ci < catTiles; ci++) {
    const tile = page.locator('main button').filter({ hasText: /\d+ topics?$/ }).nth(ci);
    const tileText = (await tile.innerText()).split('\n')[0];
    await tile.click();
    await page.waitForTimeout(180);
    if (tileText === 'Common questions') { await page.getByRole('button', { name: 'All help topics' }).first().click(); await page.waitForTimeout(150); continue; }
    const rowCount = await page.locator('main section:last-of-type > div > div > button').count();
    for (let ri = 0; ri < rowCount; ri++) {
      await page.locator('main section:last-of-type > div > div > button').nth(ri).click();
      await page.waitForTimeout(90);
      if ((await page.locator('main ol li').count()) > 0) opened++; else missingSteps.push(tileText + ' #' + ri);
      await page.locator('main > div:first-child > button').first().click();  // back to the category
      await page.waitForTimeout(90);
    }
    await page.getByRole('button', { name: 'All help topics' }).first().click();
    await page.waitForTimeout(150);
  }
  t(L('every walkthrough opens with steps (' + EXPECTED_TOPICS + ' + 1 pointer row)'),
    opened === EXPECTED_TOPICS + 1, opened + ' opened, missing steps: ' + (missingSteps.join(', ') || 'none'));

  t(L('zero app console errors across the whole run'), errs.length === 0, errs.slice(0, 4).join(' | '));
  await ctx.close();
}

await browser.close();
console.log(fail === 0 ? '\nALL GREEN' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
