#!/usr/bin/env node
// fetch-medlineplus.mjs -- the ONLY thing in this project that touches the network, and it never
// runs on a phone.
//
// It runs on a build machine (GitHub's, via .github/workflows/refresh-med-table.yml), fetches the
// MedlinePlus drug pages named in tools/med-list.json, and writes the raw result for
// build-med-table.mjs to turn into a table. No patient device is involved at any point, which is the
// entire reason the feature is shaped this way -- see the header of build-med-table.mjs.
//
// It is deliberately separate from the transform so the transform can be tested exhaustively with no
// network at all, and so a change to MedlinePlus's HTML cannot quietly alter what the guards see.
//
// POLITE ON PURPOSE: one request at a time with a pause between, and a real User-Agent naming the
// project. This hits a public service that costs taxpayers money; hammering it would be rude and
// would deserve to be blocked.
//
// Usage:  node tools/fetch-medlineplus.mjs --list tools/med-list.json --out pages.json
import fs from 'node:fs';

const argv = process.argv.slice(2);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const UA = 'ChemoWell-table-builder (https://github.com/Arnjnnngs/chemowell-app-beta)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// "Why is this medication prescribed?" is the section written for patients rather than clinicians.
// Everything is taken from THAT section only: the rest of the page is dosing and storage, which the
// guards would reject anyway and which has no business on a medication card.
function whySection(html) {
  const s = String(html || '');
  // THE PHRASE APPEARS TWICE, and the first one is the wrong one. Every MedlinePlus drug page opens
  // with its own table of contents -- a list of links reading "Why is this medication prescribed?
  // How should this medicine be used? Other uses for this medicine ..." -- and the real section is
  // further down. Slicing from the FIRST occurrence caught a few words of navigation and stopped at
  // the next heading name, which is why 46 pages that downloaded perfectly reported "no section
  // found".
  // Rather than guess at markup that can change, take EVERY occurrence, cut each one at the next
  // section heading, and keep the longest. The navigation slice is a handful of characters; the real
  // one is a paragraph. This stays right if they restructure the page.
  const starts = [];
  const re = /Why is this medication prescribed\?/gi;
  let m;
  while ((m = re.exec(s)) !== null) starts.push(m.index);
  if (!starts.length) return '';
  let best = '';
  for (const start of starts) {
    const rest = s.slice(start);
    const end = rest.search(/How should this medicine be used\?|Other uses for this medicine|What special precautions/i);
    const block = end > 0 ? rest.slice(0, end) : rest.slice(0, 4000);
    const text = block
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
      .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/gi, ' ')
      .replace(/Why is this medication prescribed\?/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > best.length) best = text;
  }
  return best;
}


// ---- FINDING THE PAGES -------------------------------------------------------------------------
// The seed list names medications, not URLs, because the app's own table is a list of names. The A-Z
// drug index maps one to the other in a single request.
//
// THIS PARSE IS THE ONE THING IN THIS PROJECT I COULD NOT TEST. The sandbox it was written in blocks
// every external host, so the shape of that index page is an assumption, not an observation. It is
// written to FAIL LOUDLY rather than quietly: if it resolves nothing, the run reports zero and the
// workflow opens no pull request, which is visible. What it must never do is resolve a name to the
// WRONG page -- so a candidate is only accepted when the link text matches the medication name
// exactly, rather than merely containing it. "Ibuprofen" must not match "Ibuprofen and Famotidine".
const INDEX_URL = 'https://medlineplus.gov/druginformation.html';

// TWO HOPS, because the index is not a list of drugs. Measured on the real site by running a probe
// inside the workflow and reading the log -- this sandbox cannot reach MedlinePlus, so the job that
// CAN became the eyes.
// What druginformation.html actually contains is 26 LETTER pages -- druginfo/drug_Aa.html,
// drug_Ba.html and so on -- and the drug links live on those. The first version looked for drug
// links on the index itself and found none, which is why it resolved zero and said so loudly.
// Also measured: the site redirects to www.medlineplus.gov, and a relative href resolved against the
// wrong host simply fails. Every URL below is resolved against the FINAL url of the response that
// contained it, which is the only way that stays right if they change hosts again.
async function getHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) return null;
  return { html: await res.text(), finalUrl: res.url };
}
function absolute(href, base) {
  try { return new URL(href, base).href; } catch (e) { return ''; }
}

async function buildNameMap() {
  const map = new Map();
  const index = await getHtml(INDEX_URL);
  if (!index) return map;
  // the letter pages, from the index
  const letters = [];
  for (const m of index.html.matchAll(/<a[^>]+href="([^"]*druginfo\/drug_[A-Za-z]+\.html)"/gi)) {
    const abs = absolute(m[1], index.finalUrl);
    if (abs && !letters.includes(abs)) letters.push(abs);
  }
  console.log('  the index lists ' + letters.length + ' letter page(s)');
  for (const letterUrl of letters) {
    const page = await getHtml(letterUrl);
    await sleep(700);
    if (!page) { console.log('  could not read ' + letterUrl); continue; }
    let found = 0;
    for (const m of page.html.matchAll(/<a[^>]+href="([^"]*meds\/[a-z0-9]+\.html)"[^>]*>([^<]+)<\/a>/gi)) {
      const abs = absolute(m[1], page.finalUrl);
      // Spanish pages live under /spanish/ and end -es.html; this app is English only.
      if (!abs || /\/spanish\//i.test(abs) || /-es\.html$/i.test(abs)) continue;
      const label = m[2].replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!label) continue;
      if (!map.has(label)) { map.set(label, abs); found++; }
    }
    console.log('  ' + letterUrl.split('/').pop() + ': ' + found + ' medication(s)');
  }
  return map;
}

async function resolveUrls(entries) {
  const need = entries.filter(e => !e.url);
  if (!need.length) return { resolved: 0, unresolved: [] };
  let map = new Map();
  try { map = await buildNameMap(); } catch (e) { console.log('  index walk threw: ' + (e && e.message || e)); }
  console.log('  ' + map.size + ' medication name(s) known to MedlinePlus');
  let resolved = 0;
  const unresolved = [];
  for (const e of need) {
    const key = String(e.name || '').trim().toLowerCase();
    // EXACT match only: "Ibuprofen" must not resolve to "Ibuprofen and Famotidine".
    const hit = map.get(key);
    if (hit) { e.url = hit; resolved++; } else { unresolved.push(e.name); }
  }
  return { resolved, unresolved };
}

const list = JSON.parse(fs.readFileSync(arg('--list') || 'tools/med-list.json', 'utf8'));
const res0 = await resolveUrls(list);
console.log('resolved ' + res0.resolved + ' page address(es) from the A-Z index');
if (res0.unresolved.length) console.log('  no page found for: ' + res0.unresolved.join(', '));
if (!res0.resolved && list.every(e => !e.url)) {
  console.log('RESOLVED NOTHING. Either the index moved or its markup changed -- this is the one part');
  console.log('of the pipeline that could not be tested before it shipped. Nothing is written.');
  process.exit(1);
}
const out = [];
const failures = [];
for (const entry of list) {
  const url = String(entry.url || '');
  // Two different things were both reported as "not a MedlinePlus url": a name the A-Z index does
  // not carry, and a url that is genuinely wrong. They need different answers, so they say different
  // things.
  if (!url) { failures.push({ name: entry.name, why: 'no page on MedlinePlus under that exact name' }); continue; }
  if (!/^https:\/\/(www\.)?medlineplus\.gov\//i.test(url)) { failures.push({ name: entry.name, why: 'not a MedlinePlus url' }); continue; }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) { failures.push({ name: entry.name, why: 'HTTP ' + res.status }); await sleep(1000); continue; }
    const why = whySection(await res.text());
    if (!why) { failures.push({ name: entry.name, why: 'no "Why is this medication prescribed?" section found' }); await sleep(1000); continue; }
    out.push({ name: entry.name, generic: entry.generic || '', url, whyPrescribed: why });
  } catch (e) {
    failures.push({ name: entry.name, why: String(e && e.message || e).slice(0, 80) });
  }
  await sleep(1000);
}
fs.writeFileSync(arg('--out') || 'pages.json', JSON.stringify(out, null, 2) + '\n');
console.log('fetched ' + out.length + ' of ' + list.length + (failures.length ? ', failed ' + failures.length : ''));
for (const f of failures) console.log('  FAILED  ' + f.name + ' -- ' + f.why);
// A page that cannot be fetched is not a build failure: the app keeps its own line for that drug.
// The workflow surfaces the count in the pull request so a run that quietly fetched nothing is
// visible rather than looking like "no changes".
