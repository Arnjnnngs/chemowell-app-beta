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
  const start = s.search(/Why is this medication prescribed\?/i);
  if (start < 0) return '';
  const rest = s.slice(start);
  const end = rest.search(/How should this medicine be used\?|Other uses for this medicine/i);
  const block = end > 0 ? rest.slice(0, end) : rest.slice(0, 4000);
  return block
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/gi, ' ')
    .replace(/Why is this medication prescribed\?/i, '')
    .replace(/\s+/g, ' ')
    .trim();
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
async function resolveUrls(entries) {
  const need = entries.filter(e => !e.url);
  if (!need.length) return { resolved: 0, unresolved: [] };
  let html = '';
  try {
    const res = await fetch(INDEX_URL, { headers: { 'User-Agent': UA } });
    if (res.ok) html = await res.text();
  } catch (e) { /* handled by the zero-resolved path below */ }
  const map = new Map();
  for (const m of html.matchAll(/<a[^>]+href="([^"]*\/druginfo\/meds\/[^"]+\.html)"[^>]*>([^<]+)<\/a>/gi)) {
    const href = m[1].startsWith('http') ? m[1] : 'https://medlineplus.gov' + (m[1].startsWith('/') ? '' : '/') + m[1];
    const label = m[2].replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (label && !map.has(label)) map.set(label, href);
  }
  let resolved = 0;
  const unresolved = [];
  for (const e of need) {
    const key = String(e.name || '').trim().toLowerCase();
    const hit = map.get(key);                    // EXACT match only. See the note above.
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
  if (!/^https:\/\/medlineplus\.gov\//i.test(url)) { failures.push({ name: entry.name, why: 'not a MedlinePlus url' }); continue; }
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
