#!/usr/bin/env node
// build-med-table.mjs -- turn fetched MedlinePlus pages into a table this app can ship.
//
// WHY THIS EXISTS AND WHY IT RUNS HERE RATHER THAN ON A PHONE.
// Aaron asked for medication descriptions that come from a real source, with a link to the page the
// wording came from. The obvious way to build that -- look it up when a medication is saved -- was
// built, audited twice, and deleted: this app promises its users "no cloud, no accounts, no tracking,
// and the app never sends your information anywhere", and a lookup sends the medication name.
//
// So the fetching happens ONCE, on a build machine, and the result is baked into the app the way the
// hand-written table already is. A phone downloads an app that already knows the answers and asks
// nobody anything. That was Aaron's idea and it is strictly better than what I proposed.
//
// WHAT MAKES IT LEGAL: MedlinePlus is the US National Library of Medicine. Its text is a work of the
// US government and is public domain, so it can be copied into the app and quoted with a citation.
// WebMD and drugs.com are copyrighted and their terms forbid exactly this, which is why the source
// was chosen before a line of the first version was written.
//
// THE GUARDS RUN HERE, WHERE EVERY ENTRY CAN BE SEEN. The runtime version of this had to guard text
// arriving on a patient's phone, where no suite could ever look at it. Baked in, every candidate
// sentence is checked at build time and a test can read the whole table. That is the real prize.
//
// A sentence that fails ANY guard is REJECTED, not trimmed to fit -- fitting a rejected sentence into
// the rules by cutting words off it is how a dose ends up on a screen with its number removed and its
// meaning intact. The app keeps its own hand-written line for that drug instead.
//
// TRIMMING AND CLAMPING ARE NOT THE SAME THING, and app-v75 turns on the difference. Trimming edits
// the DATA: it cuts words off a sentence and then presents what is left as the whole sentence, which
// is how "not for fever" becomes "for fever". Clamping is a DISPLAY choice: the whole sentence is in
// the app, the card shows the first two lines of it with an ellipsis that says plainly there is more,
// and a tap shows all of it. Nothing here trims. The card clamps.
//
// Usage:
//   node tools/build-med-table.mjs --in pages.json --out med-source-table.json [--report report.md]
//
// `pages.json` is [{ name, generic, url, whyPrescribed }] as fetched by the workflow. Nothing in this
// file touches the network: it is a pure transform, so it can be tested exhaustively on fixtures.

import fs from 'node:fs';

// ---- THE GUARDS. Every one was paid for by an audit block on this project. ----------------------
// A SANITY CEILING, NOT A CARD WIDTH. This was 150 and it was the wrong rule in the wrong place.
// At 150 the table kept 20 of 46 medications; 14 of the 26 rejections were length alone, and the
// sentences being thrown away were good ones -- ibuprofen's real answer is 255 characters and says
// exactly what a caregiver wants to know. Dropping to 120 to make cards tidier would have kept 18.
//
// The mistake was letting a DISPLAY problem (a card is narrow) delete DATA. The card now shows two
// clamped lines and the whole sentence opens on tap, so length costs nothing on screen. What stays
// here is a ceiling high enough that a runaway extraction -- a whole page slurped into one "sentence"
// because a page's markup changed -- is still caught and reported rather than baked in.
export const MAX_LEN = 700;
export const GUARDS = [
  // NO NUMBERS AT ALL, in any script. \p{Nd} rather than a hand-kept list of ranges -- an earlier
  // version listed Arabic and Devanagari by hand and missed Thai and fullwidth.
  { name: 'a number, which could read as a dose', re: /\p{Nd}/u },
  // NO SPELLED-OUT NUMBERS either. "Take two" carries a dose with no digit in it.
  { name: 'a spelled-out number', re: /\b(one|two|three|four|five|six|seven|eight|nine|ten|twice|thrice|half|quarter)\b/i },
  // NO FEVER CLAIM, EVER. A fever during chemo is a thing to report, not to suppress, and this app
  // tracks Temperature. This is the guard that matters most and it is not negotiable.
  { name: 'a fever claim', re: /fever|febrile|pyrexia|antipyretic|temperature/i },
  // NO SCHEDULE. The app owns the schedule; a description that also states one can contradict it.
  // "chemotherapy" is deliberately NOT in this list. It was, and it rejected MedlinePlus's real
  // sentence for ondansetron -- "used to prevent nausea and vomiting caused by cancer chemotherapy" --
  // the single most relevant line in a chemotherapy app. The schedule phrasings ("on chemo days",
  // "with chemo") are still caught; the noun is not a schedule and banning it banned the subject.
  { name: 'a schedule or a dose unit', re: /\b(daily|hourly|nightly|weekly|every \w+|twice|once a|per day|a day|as needed|when needed|at bedtime|before bed|before meals|after meals|with food|on an empty stomach|in the morning|in the evening|on chemo days|around chemo|with chemo|after chemo|before chemo|dose|doses|mg|ml|mcg)\b/i },
  // NO DOSAGE FORM OR ROUTE. The same name may be a rinse, a patch or an injection -- an audit
  // blocked "a numbing cream for soreness on the skin" for exactly this.
  // BARE ANATOMY IS DELIBERATELY NOT BANNED. That was tried on this project and was wrong: it
  // rejected "eases itching and swelling of the skin" while letting "settles the stomach" through.
  // Needles, syringes, catheters and insertion ARE here -- they name how a drug gets in, not where it
  // works, and they are what gives away the lidocaine sentence that got through the first draft.
  { name: 'a dosage form or route', re: /\b(pills?|tablets?|capsules?|caplets?|troches?|lozenges?|liquids?|syrups?|elixirs?|powders?|sachets?|patches|patch|creams?|ointments?|gels?|lotions?|rinses?|mouthwash|gargle|suppositor(?:y|ies)|enemas?|sprays?|sprayed|inhalers?|inhaled|nebuli[sz](?:ed|er)|injections?|injected|inject|shots?|infusions?|infused|drips?|intravenous(?:ly)?|iv|subcutaneous(?:ly)?|intramuscular(?:ly)?|sublingual(?:ly)?|transdermal|intranasal|swallow(?:ed)?|chew(?:able)?|topical(?:ly)?|orally|by mouth|per os|p\.?o\.?|rub|rubs|rubbed|applied|apply|smear|dab|rectally|vaginally|buccal(?:ly)?|implants?|pessar(?:y|ies)|eye drops?|ear drops?|nose drops?|needles?|syringes?|inserted|insertion|catheters?|on the skin|onto the skin|into the skin|under the skin|under the tongue|under your tongue|into a vein|through a vein|into a muscle|in a drip|through a drip)\b/i },
  // NO INSTRUCTION TO THE READER. A description says what a medication is for; the moment it says
  // what to do it is advice, and this app does not give advice.
  { name: 'an instruction to the reader', re: /\b(you should|do not|don't|never take|always take|call your doctor|tell your doctor|ask your doctor|stop taking|keep taking)\b/i }
];

export function guardFailure(text) {
  const t = String(text || '').trim();
  if (!t) return 'empty';
  if (t.length > MAX_LEN) return 'longer than ' + MAX_LEN + ' characters';
  // A RUN-ON FROM A BULLETED PAGE. Some MedlinePlus answers are written as a list, and when the list
  // items lose their separators the result is a sentence-shaped string that is not a sentence:
  //   "sneezing runny nose red, itchy, watery eyes itching of the nose or throat Diphenhydramine..."
  // The extractor now punctuates the items, so this should never fire -- which is exactly why it is
  // here. The extractor's fix depends on markup that MedlinePlus can change at any time, and the
  // failure is silent: the text still passes every other guard and still reads like English at a
  // glance. This catches the shape instead: a lower-case word running straight into a capitalised
  // one with no punctuation between them is a joint where a block boundary was lost.
  if (/[a-z,)\]]\s+[A-Z][a-z]+\s+(?:is|are|was|were|can|may|also)\b/.test(t)) {
    return 'a run-on from a bulleted page';
  }
  for (const g of GUARDS) if (g.re.test(t)) return g.name;
  return null;
}

// ---- pulling the section out of a page ----------------------------------------------------------
// MOVED HERE FROM fetch-medlineplus.mjs (app-v75). This is pure string work with no network in it,
// and it was living in the one file a suite can never import -- the fetcher self-executes on load.
// So the bug below (list items run together into nonsense) shipped unnoticed through a full run.
// The rule this file was built on is that everything testable lives on the testable side; the
// extractor was the one piece that had quietly been left on the wrong side of that line.
// Everything is taken from THAT section only: the rest of the page is dosing and storage, which the
// guards would reject anyway and which has no business on a medication card.
export function whySection(html) {
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
      // PUNCTUATE THE BLOCKS BEFORE STRIPPING THE TAGS. MedlinePlus writes the answer for several
      // drugs as a bulleted list, and <li> carries no punctuation of its own -- so stripping tags
      // first ran the items together into one unreadable run-on. Real output from the first run:
      //   "allergy and cold symptoms: sneezing runny nose red, itchy, watery eyes itching of the
      //    nose or throat Diphenhydramine is also used to treat insomnia"
      // Two separate harms in one line: it reads as nonsense, and because no item ends in a full
      // stop the "first sentence" ran past the end of the list and swallowed the paragraph after
      // it. Those sentences then failed the length ceiling and the drug was dropped -- so a
      // formatting bug was being reported as "MedlinePlus has no short answer for this drug".
      // Items are joined with '; ' and the list closed with '.', which is how the same content
      // reads when a person writes it as prose.
      .replace(/<\/li>\s*<li[^>]*>/gi, '; ')
      .replace(/<\/li>/gi, '. ')
      .replace(/<\/(?:p|ul|ol|h[1-6])>/gi, '. ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
      .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/gi, ' ')
      .replace(/Why is this medication prescribed\?/i, '')
      .replace(/\s+/g, ' ')
      // Tidy the punctuation the step above introduces: a block that already ended in '.', ':' or
      // ';' must not gain a second one, and an empty block must not leave a bare '.' behind.
      .replace(/\s+([.;:,])/g, '$1')
      .replace(/([.;:])[.;]+/g, '$1')
      .replace(/([:;])\s*\./g, '$1')
      .replace(/^[.;:\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > best.length) best = text;
  }
  return best;
}

// ---- turning a page into one sentence -----------------------------------------------------------
// MedlinePlus's "Why is this medication prescribed?" opens with a sentence naming what the drug
// treats. That first sentence is what we want; everything after it drifts into schedules and forms.
export function firstSentence(prose) {
  const t = String(prose || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  // Split on a full stop followed by a space and a capital, so "U.S." and "e.g." do not end it.
  const m = t.match(/^(.*?[.!?])(?:\s+[A-Z]|$)/);
  return (m ? m[1] : t).trim();
}

// MedlinePlus writes "Ondansetron is used to prevent nausea and vomiting..." -- the drug's own name
// at the front is noise on a card that already shows the name above it.
export function tidy(sentence, name, generic) {
  let t = String(sentence || '').trim();
  for (const n of [generic, name]) {
    if (!n) continue;
    const esc = String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp('^' + esc + '\\s+(is|are)\\s+used\\s+to\\s+', 'i'), 'Used to ');
    t = t.replace(new RegExp('^' + esc + '\\s+(is|are)\\s+', 'i'), '');
  }
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.trim();
}

export function buildTable(pages) {
  const table = {};
  const rejected = [];
  const seen = new Set();
  for (const page of Array.isArray(pages) ? pages : []) {
    const name = String(page && page.name || '').trim();
    const url = String(page && page.url || '').trim();
    // www OR NOT. MedlinePlus redirects to www.medlineplus.gov, so every URL the resolver produces
    // carries it -- and the first version of this check demanded the bare host and threw away all 46
    // pages the resolver had just found. The run went green, committed an empty table, and looked
    // like "MedlinePlus knows none of these medications". A guard that rejects its own pipeline's
    // output is worse than no guard, because it fails quietly and plausibly.
    if (!name || !/^https:\/\/(www\.)?medlineplus\.gov\//i.test(url)) {
      rejected.push({ name: name || '(no name)', why: 'no name, or a url that is not a MedlinePlus page' });
      continue;
    }
    const key = name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) { rejected.push({ name, why: 'duplicate key' }); continue; }
    const candidate = tidy(firstSentence(page.whyPrescribed), name, page.generic);
    const failure = guardFailure(candidate);
    if (failure) {
      // REJECTED, NOT TRIMMED. Cutting words until a sentence passes leaves its meaning intact and
      // its warning label off.
      rejected.push({ name, why: failure, candidate: candidate.slice(0, 120) });
      continue;
    }
    seen.add(key);
    table[key] = { t: candidate, u: url };
  }
  return { table, rejected };
}

// ---- CLI ----------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
if (arg('--in')) {
  const pages = JSON.parse(fs.readFileSync(arg('--in'), 'utf8'));
  const { table, rejected } = buildTable(pages);
  const outPath = arg('--out') || 'med-source-table.json';
  fs.writeFileSync(outPath, JSON.stringify(table, null, 2) + '\n');
  const lines = [
    '# Medication table build',
    '',
    'Pages in: **' + (Array.isArray(pages) ? pages.length : 0) + '** · kept: **' + Object.keys(table).length +
      '** · rejected: **' + rejected.length + '**',
    '',
    'A rejected sentence is NOT trimmed to fit. The app keeps its own hand-written line for that drug.',
    '',
    '| Medication | Why it was rejected | The sentence |',
    '|---|---|---|'
  ];
  for (const r of rejected) lines.push('| ' + r.name + ' | ' + r.why + ' | ' + (r.candidate || '') + ' |');
  if (arg('--report')) fs.writeFileSync(arg('--report'), lines.join('\n') + '\n');
  console.log('kept ' + Object.keys(table).length + ', rejected ' + rejected.length + ' -> ' + outPath);
}
