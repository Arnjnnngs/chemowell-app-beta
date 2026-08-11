# DEV BRIEF — app-v56: the on-screen help bubble ("helpbot")

**Stage:** Developer (Quality Chain stage 1). **Author:** Developer agent, 2026-08-11.
**Baseline:** live `app-v55` (`sw.js` CACHE `chemowell-app-v55-2`, `APP_VERSION` `app-v55` at `index.html:5674`).
**Audience:** the Lead Developer implements from this. The Zero Day Auditor tests against §9–§11.
**This brief contains no code changes.** `index.html` was not edited.

> Note for whoever picks this up: the sandbox checkout was at `app-v51` and has been fast-forwarded
> to `origin/main` (`app-v55`, commit `864aeaf`). Every line number below is against that tree.

---

## 0. What Aaron asked for, and what actually changes

> *"I wanted the bot to be like and on screen help like most apps have them down in the bottom
> corner. they can click on it and start typing and the bot will look up their question and reply.
> like AI, but its not AI, its just things that has already been written to the app"*

app-v55 shipped the **corpus** (117 `HELP_TOPICS` at `index.html:2132`, 17 `HELP_CATEGORIES` at
`:2100`, 1 `HELP_POINTERS` at `:2124`, 15 `FAQ_ITEMS` at `:2061`) behind a **browse-and-search
screen** (`renderHelpView`, `:5839`) reached from the drawer's Help row (`:2675`). The v55 code
comment at `:2087` says outright *"Deliberately NOT a chat box."* Aaron has now overridden that.

**The corpus does not change. The interaction model does.** Nothing in `HELP_TOPICS` /
`FAQ_ITEMS` / `HELP_CATEGORIES` / `HELP_POINTERS` gets edited, re-worded, added or removed in
v56. If the bot cannot answer something, the answer is a **content** task for a later release, not
a copy edit smuggled into this one.

Three things ship:

1. **`helpMatch()`** — a scoring matcher that takes a typed sentence and ranks the 132 documents.
   It replaces `helpSearch()` (`:5785`) **for both surfaces** — the new bubble *and* the existing
   Help view's search box. One matcher, two surfaces.
2. **A floating bubble** bottom-right, above the bottom nav.
3. **A chat-shaped panel** that shows the reply and links through to the full walkthrough in the
   existing Help view.

---

## 1. The matcher

### 1.1 Why `helpSearch()` cannot be reused

```js
// index.html:5785
function helpSearch(query) {
  const terms = (query || '').trim().toLowerCase().split(/\s+/).filter(t => t.length > 1);
  if (!terms.length) return [];
  return helpAllTopics().filter(t => {
    const hay = (t.q + ' ' + (t.a || '') + ' ' + ((t.keywords || []).join(' '))).toLowerCase();
    return terms.every(term => hay.indexOf(term) >= 0);
  });
}
```

Four properties make it wrong for a chat box:

- **AND over every term.** `"why cant i type in the daily limit box"` requires *why*, *cant*, *type*,
  *the*, *daily*, *limit*, *box* to all appear in one document. Run against the live v55 corpus,
  `helpSearch()` returns **0 results** for each of these:

  | query | v55 `helpSearch()` |
  |---|---|
  | why cant i type in the daily limit box | **0** |
  | i'm not getting any notifications | **0** (corpus has `notification`, singular) |
  | export to excel | **0** |
  | red banner wont go away | **0** |
  | daily limit locked | 1 |
  | how do i add a med | 3 — incl. `faq:switch-profile` |
- **Substring, not token.** `terms.every(term => hay.indexOf(term) >= 0)` — which is why
  `"how do i add a med"` drags in `faq:switch-profile` above: `med` is a substring of
  `medications`. Likewise `"pill"` matches `"pillow"`, `"log"` matches `"biological"`. Noise, but
  also false confidence.
- **No ranking.** The output is filter order, i.e. `HELP_TOPICS` array order. A chat reply has to
  pick *one*, so "first in the array" becomes the answer.
- **Three fields only** (`q`, `a`, `keywords`). `steps`, `branches`, `note` and the category label
  are invisible to it, and `HELP_POINTERS` is not in `helpAllTopics()` at all (`:5774`) — the
  gap `BACKLOG.md:42` already logs.

A search box that returns nothing is a dead end the user can back out of. A *bot* that says
"nothing matched" to a well-formed question reads as broken, and after two of those the user
never opens it again.

### 1.2 Normalisation

```js
function helpNorm(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[‘’ʼ´]/g, "'")  // curly/typographic apostrophes -> straight
    .replace(/'/g, '')                            // can't -> cant, won't -> wont, I'm -> im
    .replace(/[^a-z0-9]+/g, ' ')                  // everything else is a separator
    .trim();
}
```

- Apostrophes are **deleted, not spaced**, so `can't` → `cant` and the corpus's own `"can't type"`
  (`med-daily-limit-locked` keywords, `:2150`) normalises to the same token. This matters: the
  corpus is full of contractions.
- Everything non-alphanumeric becomes a separator, applied **identically to index and query**, so
  `100.4` (in `vit-temp-high`'s keywords, `:2185`) becomes `["100","4"]` on both sides and still
  matches. Consistency beats cleverness here — do not add decimal-preserving special cases.
- Tokens are `helpNorm(s).split(' ').filter(Boolean)`.
- **Do not** strip accents/diacritics, and do not normalise British/American spelling: the corpus
  already carries both variants where it matters (`optimisation`/`optimization` in `rem-none`;
  `diarrhea`/`diarrhoea` in `sym-bowel-confusion`).

### 1.3 Stopwords — the actual list

Exactly these 139 words, and no others. Written as one whitespace-split string, built once at
module scope into a `Set`:

```
a an the and or but if of to in into onto is am are was were be been being it its
this that these those my mine me i we our us you your he she they them their his her
do does did doing done have has had having can could should would will shall may might must
about at as by for from with without so than then there here just even also very really
please thanks thank hi hello hey ok okay yeah
put puts putting get gets getting got make makes made want wants wanted need needs needed
know knows thing things stuff tell tells telling like help
what whats why how when where which who whom whose
ive im id ill isnt arent wasnt werent dont doesnt didnt hasnt havent thats theres lets
```

Three groups, and each is there for a reason:

- **Function words + question words.** `how`, `what`, `where`, `why` appear in ~60 of the 117 topic
  titles (*"How do I…"*), so keeping them would give every how-to topic the same free point and
  flatten the ranking exactly where it needs to be sharpest.
- **Filler verbs** (`put`, `get`, `want`, `need`, `know`, `make`, `tell`, `like`, `thing`). These
  are rare in the corpus, so IDF weights them *high*, and a rare filler word is the single most
  effective way to drag a query to the wrong topic. Measured: before adding these, *"how do i put
  in his weight"* ranked `med-notes-field` (*"Where do I put instructions like 'take with food'?"*)
  above `vit-weight-log`. After: `vit-weight-log`, `vit-weight-change`, `rep-weight` tie at the top,
  which is the correct disambiguation set.
- **Greeting/meta words** (`hi`, `hello`, `thanks`, `ok`, `help`). `help` in particular: it is a
  keyword on both `sym-severe` (*"The symptom is severe, or something new and frightening is
  happening"*) and `tour-replay`. Without it in this list, a user who types the single word
  **"help"** gets the emergency-symptom walkthrough at score 0.90. That is the worst possible
  answer to the most likely single word a frightened person types. With it stopworded, "help"
  produces zero content terms and the panel shows the greeting + starter chips instead.

**Deliberately NOT stopwords — do not add them:**
`no  not  never  nothing  none  all  on  off  over  out  up  down  back  before  after  again
same  one  two  still  work  working  go  see  find  missing  wont  cant  wrong  only  early  late`

Each of those is load-bearing somewhere in the corpus: *"Take all"*, *"Clear all"*, *"turn **on**
notifications"*, *"log **anyway** / **over** limit"*, *"get data **out**"*, *"1 hour **before**"*,
*"days **after**"*, *"replay it **again**"*, *"**still** active"*, *"**won't** turn on"*,
*"**can't** type"*, *"120 **over** 80"*.

Known wart, accept it: `id` and `ill` are in the list as contraction forms (*I'd*, *I'll*), so a
user writing "he is ill" loses `ill`. `ill` carries no weight in this corpus, so the cost is nil.

Tokens shorter than 2 characters are dropped **unless** they are a single digit — `4` has to
survive for *"every 4 hours"* to form a bigram against `faq:gap-timer`'s *"(e.g. every 4 hours)"*.

### 1.4 Stemming — exactly this, and nothing more

**No external library.** No Porter, no Snowball, no npm. This app has no build step
(`APP_CLAUDE.md`, Architecture notes) and adding a stemmer dependency would be the first one.
The rules below are ~12 lines and are applied **identically to index tokens and query tokens** —
that identity is the whole point; a stemmer that is merely *good* but applied asymmetrically is
worse than none.

```js
function helpStem(w) {
  let x = w;
  if (x.length >= 4) {
    if (/ies$/.test(x) && x.length >= 5) x = x.slice(0, -3) + 'i';
    else if (/ing$/.test(x) && x.length >= 6) x = x.slice(0, -3);
    else if (/ed$/.test(x)  && x.length >= 5) x = x.slice(0, -2);
    else if (/es$/.test(x)  && x.length >= 5) x = x.slice(0, -1);
    else if (/s$/.test(x)   && !/(ss|us|is)$/.test(x)) x = x.slice(0, -1);
    if (/y$/.test(x) && x.length >= 4) x = x.slice(0, -1) + 'i';
  }
  if (x.length >= 4 && /([bcdfglmnprst])\1$/.test(x)) x = x.slice(0, -1); // logg -> log
  if (x.length >= 4 && /e$/.test(x)) x = x.slice(0, -1);                  // take/taking -> tak
  return x;
}
```

Worked examples that must hold (put these in the unit fixture):
`doses → dos`, `dose → dos`, `logged → log`, `logging → log`, `taking → tak`, `take → tak`,
`missed → mis`, `missing → mis`, `miss → mis`, `medications → medication`, `battery → batteri`,
`batteries → batteri`, `reminders → reminder`.

Note that the trailing-`e` and doubled-consonant rules are what make `take`/`taking` and
`log`/`logged`/`logging` collapse together. Removing either one silently breaks a third of the
verb matches.

**Both forms are indexed.** For every field, put *both* the raw token and its stem into that
field's `Set`. Query terms resolve raw-first, then stem (see §1.7). Do not index only stems —
`"120 over 80"` and `"one ui"` need their raw forms intact.

### 1.5 Synonyms — a small, hand-audited map, query-side only

The corpus is written in one register ("medication", "reminder") and users type another ("meds",
"pills", "notifications"). This map is applied **to the query only**, never to the index, and is
deliberately tiny — every entry below was added because a fixture case failed without it:

```js
const HELP_SYNONYMS = {
  med:'medication', meds:'medication', medicine:'medication', medicines:'medication',
  pill:'medication', pills:'medication', tablet:'medication', tablets:'medication',
  drug:'medication', drugs:'medication', rx:'medication',
  notification:'reminder', notifications:'reminder', notif:'reminder',
  alert:'reminder', alerts:'reminder',
  temp:'temperature', bp:'blood pressure', dr:'doctor'
};
```

`bp` expands to two tokens. Expansion happens **before** stopword removal so a synonym target is
never accidentally stopworded.

### 1.6 Typo tolerance

Caregivers type on phones at 2am. `"notifcations"`, `"temprature"`, `"wat version"` all appear in
the fixture and all fail every exact/stem path.

Bounded Damerau–Levenshtein against the index vocabulary, run **only** for query tokens that
matched nothing exactly or by stem:

- budget 0 for tokens < 5 chars (too many false friends: `dose`/`does`, `log`/`long`)
- budget 1 for 5–7 chars
- budget 2 for ≥ 8 chars
- vocabulary is restricted to index tokens of length ≥ 4
- early-abandon the DP row when the running minimum exceeds the budget, and skip candidates whose
  length differs by more than the budget — with those two guards the whole scan is ~1 ms
- a fuzzy hit is scored at **quality 0.65** (see §1.7), never 1.0
- if the fuzzy result is itself a synonym key, run it through `HELP_SYNONYMS` (this is what turns
  `notifcations` → `notification` → `reminder`)

**Do not** apply fuzzy matching to index tokens, and do not lower the budget floor to 4 characters.
Both were tried; both introduce more wrong answers than they fix.

### 1.7 Field weighting

Seven fields per document. `steps` is `topic.steps.join(' ')`; `branches` is every
`when + steps.join(' ')` concatenated; `cat` is the category's `label + ' ' + blurb` from
`HELP_CATEGORIES` (`:2100`).

| field | weight | why |
|---|---|---|
| `q` (title) | **1.00** | The title *is* the question the user is asking. |
| `kw` (keywords) | **0.90** | Hand-written for exactly this purpose; the author already did the synonym work. |
| `a` (short answer) | **0.55** | Real signal, but written to explain rather than to be found. |
| `cat` (category label + blurb) | **0.45** | Coarse topical signal; keeps *"reminders"* pulling the whole reminders category up. |
| `steps` | **0.35** | High volume, low specificity — a word in step 4 of 6 is weak evidence. |
| `branches` | **0.30** | Same, one level further from the point. |
| `note` (*"Worth knowing"*) | **0.25** | Almost always a caveat, rarely what was asked. |

For a query term *t* and document *d*:

```
fieldScore(t, d) = max{ W[f] : t present in field f }  +  min(0.45, 0.15 × (fieldsMatched − 1))
```

**`max`, not `sum`.** Summing lets a long walkthrough win on repetition alone. The
`fieldsMatched` bonus (capped at +0.45) is what separates a term that is genuinely *central* to a
topic — present in title *and* keywords *and* answer *and* steps — from one that appears once in
a note. That bonus is what promotes `vit-weight-log` over `med-notes-field` for *"put in his
weight"*, and it is the single most load-bearing tuning constant in this design.

### 1.8 Term weighting (IDF) and the score

```
N  = number of documents (117 topics + 15 FAQ = 132)
df(t) = number of documents containing t (raw or stemmed form)
idf(t) = df(t) ? Math.log(1 + N / df(t)) : UNKNOWN_IDF        // UNKNOWN_IDF = 1.2
```

`UNKNOWN_IDF = 1.2` is roughly the IDF of a very common corpus word. It is deliberately *low*:
an unknown word (`hair`, `dinner`, a patient's name) still costs the query, because it lands in
the denominator and contributes nothing to the numerator — but one unknown word does not by itself
destroy an otherwise good question ("my **mom's** medication isn't on the home screen").

```
raw(d)  = Σ_t  idf(t) × quality(t) × fieldScore(t, d)
den     = Σ_t  idf(t)                       // every term, matched or not
score(d) = raw(d) / den   + bigramBonus(d)  + phraseBonus(d)
```

`quality(t)` is `1.0` exact / `0.9` stem / `0.65` fuzzy / `0` unmatched.

Dividing by the full denominator is how unmatched terms are punished — no separate "coverage
multiplier" is needed in the score itself (coverage reappears as a *gate* in §1.10).

**Normalisation sanity check:** a query whose every term hits the title of one document scores
≈ 1.0–1.45. Bonuses can push a very good match to ≈ 1.9. Real measured range on the fixture:
0.19 (worst noise) to 1.84 (`set-erase-all` for *"how do i start over and erase everything"*).

### 1.9 Phrases

Two separate bonuses, both additive after normalisation:

**Adjacent-bigram bonus.** For each adjacent pair of surviving query terms, if the same stemmed
pair appears adjacently in a field: `+0.15` if that field is `q` or `kw`, `+0.07` otherwise.
Counted **once per bigram** (best field wins — do not add it per field), and the total is capped
at **+0.30**. Without the cap, a 6-word query that happens to echo a long walkthrough runs away.

**Keyword-phrase bonus, +0.18, once per document.** `HELP_TOPICS` keywords include real
multi-word phrases: `"alarms and reminders"`, `"won't turn on"`, `"hours between doses"`,
`"120 over 80"`, `"no reminders"`, `"greyed out"`, `"get data out"`. If every stemmed token of one
such phrase appears in the query **in order** (not necessarily adjacent), the document gets +0.18.
This is what makes *"alarms and reminders switch is missing on my samsung"* land on
`rem-exact-toggle-missing` (1.46) rather than `rem-none` (0.82).

Multi-word phrases therefore beat single tokens by construction — a phrase hit is worth roughly
one extra title-level term.

### 1.10 Thresholds, and how they were chosen

Three constants:

```js
const HELPBOT_ANSWER = 0.55;   // answer directly
const HELPBOT_SHOW   = 0.40;   // offer a disambiguation list
const HELPBOT_MARGIN = 1.15;   // top must beat runner-up by 15% to answer directly
```

Three **gates** on top of the score, all of which must hold to answer directly:

1. **Score gate:** `top.score ≥ 0.55`.
2. **Anchor gate:** at least one query term matched the top document in `q` or `kw`
   (`fieldScore` best-field ≥ 0.90). A document that matched only in `steps`/`note`/`cat` is never
   a direct answer. This is what stops *"what is chemotherapy"* answering `vit-temp-high` (which
   matched only inside its answer prose, at 0.55 — exactly on the score threshold).
3. **Coverage gate:** if the query has ≤ 2 content terms, **all** must have matched; with 3+ terms,
   ≥ 60% must have matched. This is what stops *"will she lose her hair"* (0.78, `lose` matched,
   `hair` unknown) answering **"What happens if I lose my phone?"** with confidence.
4. **Margin gate:** `!second || top.score ≥ second.score × 1.15`.

**How the numbers were picked — measured, not guessed.** The prototype in §12 was run against the
60-case fixture in §10 plus 18 out-of-scope probes:

- Lowest score of a *correct* top-1 answer across the fixture: **0.50**
  (`miss-real-missed` for *"he missed his chemo pill last night what do i do"*).
- Highest score reached by an *out-of-scope* probe that should be refused: **0.33**
  (*"how long does chemo last"*, *"how many mg of tylenol is safe"*).
- `HELPBOT_SHOW = 0.40` sits in that gap with ~0.07 headroom on both sides. `0.34` was tried
  first and let *"is anyone there"* (0.35) through as a suggestion list; `0.45` would start
  refusing legitimate two-word questions.
- `HELPBOT_ANSWER = 0.55` is the point below which, on this fixture, the top hit was never
  unambiguously right — everything scoring 0.40–0.55 was a genuine near-tie that deserves a list.
- A **relative** margin (×1.15) rather than an absolute one, because scores span 0.4–1.9 and a flat
  0.10 gap means something very different at each end.

**Below `HELPBOT_SHOW`, the bot must say it does not know.** Not "no results found" — see §3.6.

### 1.11 How many results, and answer vs list

- `top.score < 0.40` → **"I don't have an answer for that"** state (§3.6). No list, no near-misses.
- `top.score ≥ 0.40` but any gate in §1.10 fails → **disambiguation**: *"I'm not certain which one
  you mean — do any of these match?"* plus **up to 4** rows (`score ≥ 0.40` only), each row being
  the topic title + its category label, tapping straight through to the walkthrough.
- All gates pass → **direct answer** (§3.5). Underneath it, if the runner-up scores ≥ **0.5 ×** the
  top, show up to **3** *"Not what you meant?"* chips. This is the safety valve for the whole
  NEAR class in §10 — e.g. *"the temprature wont save"* answers `med-save-blocked` confidently but
  offers `vit-temp-rejected` right underneath.

Four is the cap because five rows plus a question plus the input does not fit a 360×640 panel
without scrolling past the thing the user just typed.

### 1.12 `FAQ_ITEMS` — different shape, same index

`FAQ_ITEMS` (`:2061`) carry only `{ id, q, a }` — no `keywords`, no `steps`, no `cat`. They are
already lifted into the index by `helpFaqTopics()` (`:5769`) as `{ id: 'faq:' + f.id, faqId, cat:
'common', q, a }`, and `helpAllTopics()` (`:5774`) concatenates them. **Keep that exactly.**

Because `fieldScore` uses `max` rather than `sum`, an FAQ matching in its title scores the same as
a topic matching in its title — they are not structurally handicapped. Two adjustments:

1. `cat` for an FAQ is the `common` category's label + blurb (*"Common questions / The short answers
   most people start with"*), which is correct and useful.
2. **FAQ score × 0.95.** Several FAQ entries are near-duplicates of a `HELP_TOPICS` walkthrough
   (`faq:add-med` vs `med-add-first`; `faq:daily-limit` vs `med-daily-limit-locked`; `faq:privacy`
   vs `priv-server`; `faq:reset` vs `set-erase-all`). When the two are genuinely tied, the
   walkthrough is the better reply because it has ordered steps; a 5% nudge breaks the tie in its
   favour without suppressing an FAQ that is clearly the better match on its own merits.
   Measured: *"how do i add a med"* → `med-add-first` 1.52, `med-not-on-home` 1.22,
   `faq:add-med` 1.03. Correct order.

**Rendering an FAQ reply:** no `steps` exist, so the reply is `topic.a` rendered through
`helpRich()` (`:5805`) plus one button. That button must route through the existing
`helpOpenTopic()` branch at `:5825` — `if (topic.faqId) { helpQuery = ''; setState({ help: { cat:
'common', topic: null }, faqOpenId: topic.faqId }); … }` — which opens the Common-questions
accordion with that row expanded. Do not invent a second FAQ detail page.

### 1.13 `HELP_POINTERS` — fold in as aliases, do not create a 118th document

`HELP_POINTERS` (`:2124`) currently holds one row:
`{ id:'set-units-quick', cat:'settings', q:'Change temperature or weight units', to:'vit-units' }`.
It is browsable (`renderHelpView` renders it as a cross-link row at `:5993`) but invisible to
search, because `helpAllTopics()` (`:5774`) does not include it — logged at `BACKLOG.md:42`.

**Fix it here, as an alias, not as a document.** When building the index, append each pointer's
`q` string to its **target's `kw` field** (`p.to === 'vit-units'` → `vit-units`'s keyword text gains
*"Change temperature or weight units"*). Consequences, all of them wanted:

- searching "change units" now finds `vit-units`, which is what the pointer opens anyway;
- there is still exactly one copy of the copy, so the two can never drift;
- `helpCategoryCount()` (`:5779`) and the browse rendering at `:5993` are untouched, so the Help
  view keeps looking identical;
- the design generalises for free when someone adds pointer #2.

Delete the `BACKLOG.md:42` line as part of this release, since it is genuinely fixed.

### 1.14 The Help view's search box uses the same function

`renderHelpView`'s `searchCard()` (`:5857`) currently calls `helpSearch(helpQuery)` at `:5843`.
Point it at the new matcher, keeping the same result-row rendering (`topicRow`, `:5871`) and the
same "Nothing matched that" empty state (`:5959`). Two surfaces, one matcher — this is also what
makes the fallback in §7 cheap.

The Help view's list is **unfiltered by threshold** (a search box may show weak matches; a bot may
not). Sort by score descending and show everything scoring > 0.

---

## 2. Where the bubble lives

### 2.1 Measured geometry of what is already there

| element | line | `z-index` | vertical extent from the bottom edge |
|---|---|---|---|
| bottom nav | `:2640` | **35** | `0 → 69px + safe-area-inset-bottom` (1px border + 6px pad + 56px item + 6px pad) |
| "Back to reports" pill | `:3303` | **36** | `88 → 130px + inset`, horizontally centred, ~110px wide |
| toast | `:3287` | **50** | `96 → ~140px + inset`, centred, `max-width: min(90vw, 340px)`, `pointer-events: none` |
| page bottom padding | `:3274` | — | `calc(90px + inset)` |
| modals / drawer / tour / loader | `:1858 :2678 :2950 :3013 :3160 :3431 :5364 :5576 :6458 :3307` | 60–100 | full-screen |

### 2.2 The bubble

```
position: fixed
right:    14px
bottom:   calc(84px + env(safe-area-inset-bottom))
width/height: 56px   (border-radius 50%)
z-index:  37
```

- **56px** is comfortably over the project's **44px** touch-target floor and matches the app's own
  44px circular controls scaled up to FAB size.
- **`bottom: 84px`** gives **15px** of clearance above the nav's top edge (69px + inset). This is
  deliberate and it is the app-v28 lesson, verbatim from `index.html:3296`:

  > *"raised above the bottom nav's z-index (35) … this button previously sat at z-index 34 with
  > only ~10px of clearance from the nav bar below it, close enough that on a device with a larger
  > safe-area inset than assumed here, the nav bar's rounded top edge could plausibly overlap the
  > bottom of this button and win the tap since it painted on top."*

  So: **more than 10px of clearance, and a higher z-index than the nav.** 84px gives both. Do not
  reduce it to make the bubble look tighter to the nav.
- **z-index 37** sits above the nav (35) and above the "Back to reports" pill (36), and below the
  toast (50) and every modal. Even in a rendering where the bubble and the nav overlapped, the
  bubble would win the tap.
- **`env(safe-area-inset-bottom)`**, not `var(--safe-top)` and not a hard-coded number. The nav
  (`:2640`), the toast (`:3287`) and the pill (`:3303`) all use `env(safe-area-inset-bottom)`
  directly; only the *top* inset has the WebView probe/fallback (`:94–104`). Match the existing
  bottom convention exactly.

**Collision check at 360px** (the narrowest supported width): bubble occupies x 290–346.
The Back pill is centred at ~110px wide → x 125–235. **No horizontal overlap.** At 390px:
bubble x 320–376, pill x 140–250. Clear. At 320px (below spec but the project has screenshots at
it): bubble x 250–306, pill x 105–215. Clear.

**Collision with the toast is real and must be fixed.** Toast occupies y 96–140 and, at 360px,
x 18–342 — it overlaps the bubble's 84–140 band. The toast is `pointer-events: none` so the bubble
stays tappable, but the toast paints on top (z50 > z37) and visually clips it for ~4.5s.

**Fix: raise `render()`'s toast from `calc(96px + env(safe-area-inset-bottom))` to
`calc(150px + env(safe-area-inset-bottom))`** (`index.html:3287`, one value). Unconditional — not
conditioned on whether the bubble is showing, because a toast that moves depending on hidden state
is a worse bug than a toast that sits 54px higher. 150px clears the bubble (top edge 140) *and*
the Back pill (top edge 130). `renderSetup()`'s own toast at `:2929` (`bottom: calc(40px + inset)`)
is a different screen with no bubble and no nav — **leave it alone**.

### 2.3 States where the bubble must be hidden

Getting this list wrong is the most likely way this ships broken. Implement it as one predicate
and use it for both the bubble and the panel:

```js
function helpBotVisible() {
  return state.loaded
    && state.view !== 'help'
    && state.tourStep == null
    && !state.drawerOpen
    && !state.timeModal && !state.upgradeOpen && !state.apptModal && !state.noteModal
    && !state.checkinModal && !state.medEditor && !state.infoModal && !state.eraseAllModalOpen;
}
```

| state | why it must hide |
|---|---|
| **First-run setup / welcome** | `render()` early-returns to `renderSetup()` at `:3267` before the bubble is ever constructed, so this is free — **but the Auditor must confirm it from a wiped install**, because "structurally impossible" is exactly the kind of claim that stops being true when someone refactors `render()`. There is nothing to help with before a patient name exists. |
| **`!state.loaded`** | The loading overlay is `z-index: 100` (`:3307`). The bubble would flash under it on every cold start. |
| **Guided tour (`state.tourStep != null`)** | Direct precedent: `openDrawer()` no-ops during the tour (`:2467–2472`) for exactly this reason — *"opening it mid-tour buries the tour with no way back"*. The tour layer is `z80` with `pointer-events: none` on the layer itself (`:3160`, `:3189`), so a `z37` bubble stays **tappable through the tour**, i.e. a user can open a chat panel underneath the tour card and strand themselves. Hide it. |
| **Drawer open** | Drawer is `z90` with a scrim (`:2678`). The bubble sits behind a 32%-opacity scrim: visible, dimmed, and untappable-but-looking-tappable. |
| **Any modal** (`timeModal` `:3431`, `upgradeOpen` `:3013`, `apptModal` `:5364`, `noteModal` `:5576`, `checkinModal` `:1858`, `infoModal` `:2950`, `eraseAllModalOpen` `:6458`) | All are `z60`–`z80` full-screen scrims. Same problem as the drawer, ×7. |
| **`state.medEditor`** | Not an overlay — an inline form — but it has a bottom action row, and `:3283` already records that the toast landed *"right on top of"* the editor's Discard/Add buttons at keyboard-open heights. The bubble would do the same, permanently. |
| **`state.view === 'help'`** | The Help centre *is* the help. A bubble offering to find help, on the help screen, is a loop. Also: `renderHelpView` is the one view excluded from the 1-second tick (`:7834`), and keeping the bubble out of it keeps that exclusion meaning one simple thing. |

**Deliberately NOT hidden** (state this so the Auditor tests it rather than assumes it):
`state.reportsView` (the Back pill and the bubble do not collide — see §2.2); every
`confirmDelete*` / `confirmRemove` armed-delete state (inline, not overlays); `TEST_MODE`'s Beta
date-controls box (top of screen).

**When the panel is open, the bubble is not rendered** — the panel carries its own close control.

---

## 3. The panel

### 3.1 Geometry

```
id:       helpbot-panel
position: fixed
bottom:   calc(84px + env(safe-area-inset-bottom))     // flush with where the bubble was
z-index:  38
left:  8px ; right: 8px                                 // viewport < 520px
   (>= 520px:  left: auto ; right: 14px ; width: 380px)
max-height: min(72vh, 560px)
border-radius: 20px
background: #FFFFFF
border: 1px solid #E9D8D1
box-shadow: 0 -12px 48px rgba(60,21,4,0.30)             // same as the app's sheets, :3014
display: flex ; flex-direction: column
```

Three regions, in order: **header** (fixed), **transcript** (`flex: 1; overflow-y: auto`),
**composer** (fixed). Only the transcript scrolls; the composer never leaves the screen.

### 3.2 Open / close animation

Reuse the existing `sheetUp` keyframe (`index.html:59`) — `animation: 'sheetUp .26s
cubic-bezier(0.32,0.72,0,1)'`. **No new `@keyframes`.** No exit animation (nothing in this app has
one; the sheets all disappear instantly).

**The animation must not replay on re-render.** Copy the plans-sheet pattern exactly
(`:2942`, `:2972–2974`):

```js
let helpBotAnimated = false;
// in the render function:
if (!state.helpBotOpen) { helpBotAnimated = false; return null; }
const animateIn = !helpBotAnimated;
helpBotAnimated = true;
… ...(animateIn ? { animation: 'sheetUp .26s cubic-bezier(0.32,0.72,0,1)' } : {})
```

This exists because of a real Aaron-reported bug — *"the flickering, adjusting popup"* (`:2810`) —
where the 1-second tick replayed the plans sheet's entry animation once a second.

### 3.3 On-screen keyboard

The viewport meta at `index.html:5` is
`width=device-width, initial-scale=1, viewport-fit=cover` — **no `interactive-widget`**, so Android
Chrome uses its default `resizes-visual`: the keyboard shrinks the *visual* viewport but not the
layout viewport. A `position: fixed; bottom: …` panel therefore ends up **behind the keyboard**.

**Do not add `interactive-widget=resizes-content` to the meta tag.** That would change layout
behaviour for every existing form in the app (medication editor, notes, appointments, setup) and
turn a scoped feature into an app-wide regression risk.

Instead, one `visualViewport` listener registered **once at module scope** — same discipline as
the drawer's `keydown` (`:2488`) and the `focusin` handler (`:2510`), whose comments both say
*"registered once at module scope … so it never double-attaches on re-render"*:

```js
const HELPBOT_BASE_BOTTOM = 84;
function helpBotSyncViewport() {
  const p = document.getElementById('helpbot-panel');
  if (!p || !window.visualViewport) return;
  const vv = window.visualViewport;
  const kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  p.style.bottom = 'calc(' + (HELPBOT_BASE_BOTTOM + kb) + 'px + env(safe-area-inset-bottom))';
  p.style.maxHeight = Math.max(240, vv.height - HELPBOT_BASE_BOTTOM - 24) + 'px';
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', helpBotSyncViewport);
  window.visualViewport.addEventListener('scroll', helpBotSyncViewport);
}
```

- It **mutates styles directly and never calls `render()`**. Calling `render()` from a viewport
  event would destroy the focused input mid-keystroke — the exact caret bug this file has shipped
  five times.
- Call `helpBotSyncViewport()` once at the end of `render()` when the panel exists (next to the
  existing `positionTour()` call at `:3346`), so a re-render with the keyboard already up
  re-applies the offset.
- `window.visualViewport` is guarded — older WebViews without it fall back to the static 84px,
  which is degraded but not broken.
- 240px is the floor: below that the panel is useless and it is better to let it be clipped than to
  collapse to nothing.

### 3.4 Greeting and starter chips

Shown once, as the first bot message, whenever the transcript is empty:

> **Hi — type what's going wrong in your own words.**
> I'll look through ChemoWell's help pages and show you the one that matches. I'm not a person and
> I'm not AI — these are pages written into the app before it shipped, and nothing you type here
> leaves this device. I can't answer medical questions.

Then four **starter chips**, which are *direct topic links* (not queries) so they can never miss:

| chip label | opens |
|---|---|
| I'm not getting reminders | `rem-none` |
| The Daily limit box is locked | `med-daily-limit-locked` |
| Clear a missed dose | `miss-resolve` |
| Get my records out of the app | `exp-csv` |

Plus a fifth, full-width: **Browse all 117 help topics** → closes the panel and navigates to the
Help view at its top level.

Chips are picked from the project's own most-reported problems: exact alarms (`BACKLOG.md:139`,
*"the single most-reported problem in the project's history"*), the Daily limit lock
(`med-daily-limit-locked`'s own answer calls itself *"the single most-reported sticking point in
this screen"*), missed doses, and export.

### 3.5 A direct answer

In order, inside one bot message:

1. **`careCallout`** when `topic.medical` — see §4. This is first, always, before anything else.
2. **Title:** `topic.q`, 15px/700.
3. **`topic.a`** through `helpRich()` (`:5805`), so `**bold**` / `*italics*` / `` `backticks` ``
   render as real nodes. Skip it when `topic.careLead`, because for those the callout already *is*
   `topic.a` — mirroring `renderHelpView`'s logic at `:5911` and `:5926`.
4. **First 3 steps**, numbered, using the same numbered-circle treatment as `stepList()`
   (`:5887–5892`). If there are more: a muted line *"+ N more steps"*.
5. **One primary button: "Open the full walkthrough"** — full width, 44px min height.
6. Optionally, *"Not what you meant?"* chips per §1.11.

**Never show `branches` or `note` in the panel.** Those are the long tail; they belong on the
walkthrough page. The panel's job is to identify the right page and get the user onto it.

**"Open the full walkthrough" must be one state transition, not two.** `navigateTo('help')`
(`:2448`) resets help state at `:2454` (`if (view === 'help') { helpQuery = ''; next.help = { cat:
null, topic: null }; }`), so calling `navigateTo('help')` and *then* `helpGo({topic})` renders
twice and lands on the top level for a frame. Write one helper:

```js
function helpBotOpenTopic(topic) {
  state.helpBotOpen = false;
  if (topic.faqId) {            // FAQ: the accordion, per :5825
    helpQuery = '';
    setState({ view: 'help', help: { cat: 'common', topic: null }, faqOpenId: topic.faqId });
  } else {
    helpQuery = '';
    setState({ view: 'help', help: { cat: topic.cat, topic: topic.id } });
  }
  persistView('help');          // :789 — keep sessionStorage in step with state.view
  scrollToTop();                // :2443
  tourEvent('view:help');       // parity with navigateTo(), :2459
}
```

Setting `help.cat` to the topic's own category (rather than `null`) matters: `renderHelpView`'s
back button reads `st.cat` at `:5920` to label where Back goes, and a `null` cat renders
*"All help topics"* — fine, but naming the real category is better and costs nothing.

### 3.6 The "I don't have an answer" state

Verbatim copy:

> **I don't have an answer for that one.**
> I can only look through the help pages written into ChemoWell, so anything outside the app isn't
> something I can find. If it's about the treatment itself, a dose, or how someone is feeling,
> that's a question for the care team — not for this app.

Then two controls: **Browse all 117 help topics** (→ Help view) and **Try different words**
(clears the input and refocuses it).

**No "0 results".** No error styling. No red. This is a normal, expected outcome and it must look
like one.

### 3.7 "Are you a real person?"

Fires before the matcher on `/\b(are you (a )?(real|actual)?\s*(person|human|bot|robot|ai|real))\b/`
and on `/\b(is (this|there) (a )?(real )?(person|human|someone|anyone))\b/` and
`/\b(can i (speak|talk|chat) (to|with))\b/`:

> **No — I'm not a person, and I'm not AI either.**
> I look through help pages that were written into ChemoWell before it shipped, and show you the one
> that best matches what you typed. Nothing you type here leaves this device, and nobody reads it.

Without this guard, *"are you a real person"* scores 0.72 against `pro-add` (*"I'm caring for more
than one person"*) and *"can i speak to someone"* scores 0.68 against `app-report`. Both are
answers; neither is honest.

### 3.8 Accessibility contract

| element | contract |
|---|---|
| **Bubble** | `<button id="helpbot-fab" aria-label="Ask for help" aria-expanded="true\|false" aria-controls="helpbot-panel">`. 56×56. Icon `appIcon('help', 24)` (`:2423`; `help` exists in the icon set). |
| **Panel** | `<div id="helpbot-panel" role="dialog" aria-label="Ask for help" tabindex="-1">` — **`aria-modal` is deliberately absent, and there is no focus trap.** See below. |
| **Header** | Title text is the accessible name; close button `aria-label="Close help"`, 44×44. |
| **Transcript** | `<div id="helpbot-log" role="log" aria-live="polite" aria-relevant="additions">` so each new reply is announced without stealing focus. |
| **Input** | `<input id="helpbot-input" type="text" aria-label="Type your question" placeholder="e.g. why is the daily limit locked" maxlength="200" autocomplete="off" enterkeyhint="send">`, `font-size: 16px` (prevents iOS zoom — same as the Help search box at `:5864`). |
| **Send** | `<button aria-label="Send question">`, ≥44×44. **Always enabled** — see §5.2. |
| **Focus on open** | The input, via `setTimeout(…, 50)` re-querying by id — the same shape as `openDrawer()` at `:2475`. |
| **Focus on close** | The bubble, **after the re-render** — see below. |
| **Escape** | Closes the panel from anywhere. Registered once at module scope, guarded with `if (!state.helpBotOpen) return;` — the same shape as the drawer handler at `:2488–2490`, which must keep working unchanged. |

**On the pre-existing drawer focus-trap defect** (`BACKLOG.md:9–21`, found by the app-v54 Auditor,
present since app-v22). Two bugs there:

1. `closeDrawer()` (`:2477–2480`) calls `setState` first; `render()` then does `root.innerHTML = ''`
   (`:3334`), so the cached `drawerTriggerEl` is a **detached node** by the time `.focus()` runs —
   observed `activeElement = BODY`.
2. The `Tab` handler (`:2491–2500`) only acts when focus is *exactly* the first or last focusable,
   so once focus lands on `<body>` (tap any non-focusable part of the drawer), Tab escapes behind
   the scrim.

**This panel must not repeat either, and the way it avoids them is structural, not by writing a
better trap:**

- **No trap at all.** The panel is not modal — there is no scrim, the app behind it stays visible
  and usable, and tapping a bottom-nav tab is a legitimate way to leave. So it does not claim
  `aria-modal="true"`, does not claim to trap Tab, and cannot have a trap-that-isn't. This removes
  bug (2) by removing the feature. A non-modal dialog with a label, Escape, and correct focus
  return is a complete and correct pattern.
- **Focus return happens after the rebuild**, never before, and re-queries by id:

  ```js
  function closeHelpBot() {
    setState({ helpBotOpen: false });                          // render() runs, DOM is replaced
    requestAnimationFrame(() => {
      const fab = document.getElementById('helpbot-fab');      // fresh node, never a cached ref
      if (fab) fab.focus();
    });
  }
  ```

  This is the fix `closeDrawer()` needs. **Do not fix `closeDrawer()` in this release** —
  `BACKLOG.md:18` says that belongs in its own small release with its own gates, and mixing it in
  here widens the blast radius of a UI feature into keyboard navigation across the whole app.
  Leave the backlog entry in place.

### 3.9 Honesty rules — non-negotiable

- **No typing indicator, no delay, no animated dots, no `setTimeout` before the reply.** The reply
  is computed synchronously and appears in the same frame as the user's message. If it *looks* like
  it is thinking, it is claiming to be something it is not.
- **No name, no avatar, no face.** The reply author line reads **"ChemoWell help"** with
  `appIcon('help')`. Not "Ava", not "Assistant", not a person-shaped glyph.
- **Never "I think", "it sounds like", "I'd recommend", "you should".** The bot reports what page it
  found. It does not have opinions.
- **Never claim to have read the user's data.** It has not; it does not look at `state.entries`,
  `state.meds`, or anything else. Say "the help pages", never "your medications".

---

## 4. Medical safety

A chat reply is shorter and reads more confidently than a walkthrough page. That makes it more
dangerous, and it is why this section is stricter than what `renderHelpView` already does.

### 4.1 The flags, and exactly what a reply must show

Nine topics carry `medical: true`:
`rem-none`, `med-add-first`, `med-daily-limit-locked`, `log-anyway-override`, `miss-real-missed`,
`vit-temp-high`, `vit-weight-change`, `sym-severe`, `ip-meds-restricted`.

Four of those also carry `careLead: true`:
`miss-real-missed` (`:2178`), `vit-temp-high` (`:2185`), `vit-weight-change` (`:2189`),
`sym-severe` (`:2198`).

Five carry `safety: true` (`rem-none`, `med-daily-limit-locked`, `log-button-locked`,
`log-anyway-override`, `miss-what-counts`). **`safety` changes nothing in the reply** — it is an
authoring marker, and `renderHelpView` does not read it either. Do not invent behaviour for it.

| flag | the reply must open with | tone | heading |
|---|---|---|---|
| `careLead: true` | **the topic's own `topic.a`, verbatim, through `helpRich()`** — each of the four already opens with *"**Contact your care team**"* or equivalent | `NOTICE_TONES.urgent` (`:1905`, accent `#C0453B`) | **"Contact your care team"** |
| `medical: true`, not `careLead` | **`HELP_CARE_TEAM_LINE` verbatim** (`:2131`) | `NOTICE_TONES.attention` (`:1904`, accent `#B5761E`) | **"Not medical advice"** |
| neither | nothing | — | — |

This mirrors `renderHelpView:5904–5911` exactly, including the app-v55 Auditor finding V55-3 that
the *heading* has to move with the tone:

> *"'Contact your care team' over the standing not-medical-advice disclaimer, on a page about why a
> text box is greyed out, reads as an instruction to phone the oncologist about a UI control — and
> an audience that is already frightened does not need a false alarm on a mechanics page."*
> — `index.html:5899–5903`

`HELP_CARE_TEAM_LINE`, quoted so the Lead Developer does not retype it:

> ChemoWell is a record-keeping tool, not medical advice. Always follow the care team's
> instructions, confirm doses with a doctor or pharmacist, and never delay care because of anything
> shown in this app.

**The callout renders above the answer, above the steps, and is never collapsed, truncated,
scrolled-past-by-default, or behind a "read more".** If the panel is too short to show the callout
and the first step together, the callout wins and the steps scroll.

**Write no new medical copy in v56.** Every medical sentence the bot emits is either
`HELP_CARE_TEAM_LINE` or a `careLead` topic's own `a`, both already in the file and both already
through the v55 gates.

### 4.2 The clinical-question guard

**This is a guard, not a threshold.** Score thresholds are tuned against a fixture; safety must not
depend on tuning. It runs **before** the matcher, and if it fires the matcher's answer is
suppressed entirely.

Fire on any of:

**(A) Advice-seeking frames**
```
/\b(should|shall|ought)\s+(i|we|he|she|they|you|it)\b/
/\bis\s+(it|that|this|he|she|they)\s+(safe|ok|okay|alright|dangerous|normal|serious|bad|too\s+(much|high|low|many))\b/
/\bwhat\s+(dose|dosage|amount|strength)\b/
/\bhow\s+(much|many)\s+.*\b(mg|ml|mcg|pill|pills|tablet|tablets|dose|doses|drops?)\b/
/\b(double|extra|another|second)\s+dose\b/  ,  /\bdouble\s+up\b/  ,  /\boverdose\b/
/\bcan\s+(i|we|he|she|they)\s+(take|give|have|mix|combine)\b/
/\bis\s+it\s+ok(ay)?\s+to\b/
```

**(B) A number next to a clinical measure**
```
/\b\d{2,3}(\s\d)?\b/  co-occurring with  (fever|temp|temperature|degrees|bp|blood pressure|pressure|pulse|heart rate|sugar|oxygen|sats?)
```
This is what catches **"is 101 a fever"** and **"is 99.8 too high"** (which normalise to
`["101"]` / `["99","8"]` alongside `fever`/`high`).

**(C) Judgement about how someone is**
```
/\b(is|are|does|do)\s+.*\b(normal|serious|dangerous|worrying|an emergency|urgent)\b/
/\bshould\s+(i|we)\s+(go|call|worry|be worried)\b/
```

**The reply when the guard fires** — never an app answer, never a number, never a threshold, never
"that's probably fine":

- If a `careLead` topic is a plausible match (score ≥ 0.40), render **that topic's** urgent
  callout — its own `a`, verbatim — and its "Open the full walkthrough" button. E.g. anything
  temperature-shaped routes to `vit-temp-high`, whose own answer is:
  > **Contact the care team now.** For someone on chemotherapy, a fever can be an emergency, and it
  > is not something to look up in an app. Call the number the care team gave you, or the on-call
  > line, straight away.
- If nothing `careLead` matches, render the urgent-tone callout with this copy, and *no* topic
  answer beneath it:

  > **That's a question for the care team.**
  > I can't answer anything about doses, symptoms, or whether something is safe — this app only
  > keeps a record of what you tell it, and it has no way to judge how serious something is. Please
  > call the care team, the on-call number, or your local emergency number if it's urgent.
  >
  > *[HELP_CARE_TEAM_LINE, verbatim]*

  Then one link: **"How do I record this in the app?"** → `sym-log` / `vit-temp-log` /
  `vit-weight-log` depending on which measure the guard matched, or `rep-where` if none.

**Warm, not robotic.** The refusal must acknowledge that the question is reasonable and point
somewhere real. "I cannot answer that." on its own is a door slammed on someone who is frightened.

**Known gap, log it rather than paper over it:** the guard is pattern-based, so *"will she lose her
hair"* and *"my husband is very tired all the time"* do **not** fire it. Both fall through to the
matcher and, with the §1.10 gates, land in the *"I'm not sure — do any of these match?"* state
rather than a confident wrong answer. That is acceptable for this release; a symptom-noun list is a
content decision that needs the oncology-nurse read `BACKLOG.md:22` already asks for on `sym-severe`.
Add a `BACKLOG.md` entry saying so.

**Do not weaken `sym-severe`.** `BACKLOG.md:22` flags it as the one entry in the corpus that
enumerates clinical signs and asks for a professional read before App Store submission. v56 must
not surface it more aggressively than v55 does, must not shorten it, and must not summarise it in
the panel — a `careLead` reply shows `topic.a` in full or it links out.

---

## 5. Landmines specific to this codebase

### 5.1 The 1-second `setInterval` — the caret bug that has shipped five times

`index.html:7806`, guard at `:7834–7835`. It sets `state.now` and calls `render()`, which does
`root.innerHTML = ''` (`:3334`) and rebuilds the entire tree. The exclusion list has grown once per
incident, and the file says so at `:7821`:

> *"v45: this exclusion list is a recurring bug class in this file (v11, v22, v27 all hit the same
> thing — a new modal/confirm state gets added somewhere below and nobody remembers to also list it
> here…)"*

and at `:7828`:

> *"v55: the Help view joins this list. It has a search box the user types into, and the 1s tick
> rebuilds the entire tree — which destroys the focused input and eats the keystroke. … the whole
> Help view is excluded outright … so there is no reason to leave a second way for this bug to come
> back a fifth time."*

**A new text input is exactly where it comes back a sixth time.** Four independent defences,
all four required:

1. **Add `!state.helpBotOpen` to the guard at `:7835`.** Not optional. Without it the panel's entry
   animation replays every second (the `:2810` "flickering popup" bug) and any focused input is
   destroyed mid-keystroke.
2. **The input's `onInput` must not call `render()`.** See §5.2.
3. **Give the input `id="helpbot-input"`.** `render()` already restores focus and selection range
   for any `INPUT`/`SELECT`/`TEXTAREA` carrying a stable id (`:3330–3345`), so an *interaction*
   re-render (tapping a chip, submitting) puts the caret back for free.
4. **Keep the draft at module scope**, not in `state` — the pattern the file already uses for
   `helpQuery` (`:5767`), `setupNameDraft` (`:2864`), `migrateSexDraft` (`:2869`). The comment at
   `:5764` states the reason: *"a module-level draft is the pattern this file already uses to
   survive that."*

Also note `BACKLOG.md:65`: at 365 days / 1,460 seeded misses this same tick renders History in
1.5s and the screen stops responding to taps. Nothing in v56 makes that worse, but **do not add
per-tick work** — the index build in §6 must be lazy-and-cached, never rebuilt in `render()`.

### 5.2 `h()`'s attribute handling — `disabled`

`h()` (`:2365`) has no special case for boolean attributes. Every unknown key goes through
`el.setAttribute(k, v)` at `:2382`, so **`disabled: false` renders `disabled="false"`, which
disables the element**. The file already knows this — `:5196`:

> *"never passed as `disabled: false`, or every arrow button would render permanently disabled."*

and the three call sites all spread conditionally instead (`:5041`, `:5200`, `:5689`):
`...(isDisabled ? { disabled: true } : {})`.

**The recommendation for the send button is stronger than "spread it conditionally": don't disable
it at all.** Render the send button always enabled; submitting empty or whitespace-only text is a
silent no-op. Rationale: the only reason to disable it is to reflect "is there text?", which
requires a re-render on every keystroke, which is defence #2 in §5.1 thrown away for a cosmetic
gain. One decision removes the entire class.

Two more `h()` behaviours to know:
- `value` (`:2378–2380`, `:2390`) is set as an attribute *and* re-applied as a property after
  children exist. So rendering the input with `value: helpBotDraft` genuinely restores typed text
  across a rebuild. Keep it.
- Event props are `addEventListener(k.slice(2).toLowerCase(), v)` (`:2372–2373`) — `onInput`,
  `onKeyDown`, `onClick` all work; there is no synthetic event system and no delegation.

### 5.3 `render()` tears down everything

`root.innerHTML = ''` at `:3334`. Consequences the panel must handle:

- **Cached DOM references go stale.** The comment at `:3318` is explicit: *"Re-query by id both
  times — never cache the node (stale-ref landmine)."* Applies to the focus-return in §3.8 and to
  `helpBotSyncViewport()`.
- **Scroll position is lost.** Only `#plans-sheet` is preserved today (`:3319–3320`, `:3336`).
  The transcript needs the same treatment: capture `document.getElementById('helpbot-log')
  .scrollTop` before the wipe, restore after. Additionally, when a new message was just appended,
  set a module-level `helpBotScrollToEnd = true` and, after restore, set
  `log.scrollTop = log.scrollHeight` instead. Otherwise the reply lands below the fold and the user
  sees an unchanged panel.
- **Event listeners are re-attached on every rebuild** for anything created inside `h()`. That is
  fine for the panel's own buttons. It is **not** fine for `keydown`/`visualViewport`/`focusin` —
  those must be at module scope, once, matching `:2488` and `:2510`.

### 5.4 The `focusin` auto-scroll handler

`index.html:2510–2514` — every focused `input`/`select`/`textarea` gets
`el.scrollIntoView({ block: 'center', behavior: 'smooth' })` 320ms later, added in v28 to fix a
keyboard-scroll problem in the medication editor.

For a `position: fixed` chat input this is actively harmful: the browser will scroll the nearest
scrollable ancestor and/or the page, so 320ms after tapping the chat box the page lurches under the
panel and the transcript can jump. **Exclude the panel:**

```js
if (el.closest && el.closest('#helpbot-panel')) return;
```

Placed at the top of the handler, next to the existing `matches` guard. Do not remove or change the
v28 behaviour for anything else.

### 5.5 Service worker `CACHE` — and `release_check.sh`

`sw.js:1` — `const CACHE = 'chemowell-app-v55-2'`. Must become `'chemowell-app-v56-1'` in the same
change as `index.html`, or **no installed copy of the app ever sees v56** — including the APK,
which loads the same live site. `release_check.sh` hard-fails the push otherwise, and per
`TEAM.md`'s release mechanics: *"If the script fails, fix what it says before doing anything else —
do not work around it or push anyway."*

Specifics that will bite:
- `read_cache()` (`release_check.sh:29`) rejects **more than one** uncommented `CACHE = '…'` in
  `sw.js`. Do not leave the old value in a comment on a non-comment line.
- It also hard-fails on a **reused** value (`:206–223`) — `chemowell-app-v56-1` must never have
  been published before.
- `APP_VERSION` at `index.html:5674` → `'app-v56'`. Warning-only, but it is what the drawer footer
  shows, so a screenshot stops being evidence if it drifts.
- Run `./mark_published.sh` as part of the push (`BACKLOG.md:47`, `release_check.sh:103–114`),
  otherwise the *next* release's baseline is wrong.
- `sw.js`'s `SHELL` list is unchanged — no new files ship.

### 5.6 `state` initialisation and persistence

`let state = { … }` at `index.html:790`, one object literal. `setState` (`:796`) is
`Object.assign` + `render()`.

- **Add exactly one key: `helpBotOpen: false`.** Nothing else goes in `state`.
- **The transcript and the input draft stay at module scope**, outside `state`:
  ```js
  let helpBotLog = [];        // [{ role: 'user'|'bot', text?, topicId?, kind? }]
  let helpBotDraft = '';
  let helpBotAnimated = false;
  let helpBotScrollToEnd = false;
  let helpBotIndex = null;    // built lazily, see §6
  ```
  Two reasons. **Privacy:** a typed question can contain a symptom, a drug name, a person's
  condition. `APP_CLAUDE.md` rule 1 is absolute about anything leaving the device, and the app's own
  copy promises *"nothing is sent anywhere"* — the cheapest way to keep that true, and to keep the
  transcript out of any future CSV/export/sync path, is for it never to enter `state` or storage at
  all. **Mechanics:** module scope survives the 1-second rebuild and is cleared automatically on
  reload, which is the behaviour we want anyway.
- **Nothing about the panel is persisted.** `restoreView()`/`persistView()` (`:785–789`) only
  handle `state.view`, whitelisted by `VALID_VIEWS` (`:784`) — do **not** add a helpbot value
  there, do not add a `sessionStorage` key, do not touch
  `chemowell-app-prefs-v1`/`-entries-v1`/`-medication-config-v1`.
- **`helpBotLog` must be cleared** on profile switch and on erase-all, wherever the existing code
  resets `state.entries` — otherwise one person's question is visible in another profile's panel.
- **Cap `helpBotLog` at 40 messages**, dropping from the front. Every message is re-rendered on
  every re-render; an unbounded transcript feeds directly into the `BACKLOG.md:65` render-cost
  problem.
- `navigateTo()` (`:2448`) must set `helpBotOpen: false` in its `next` object, so tapping a bottom-
  nav tab closes the panel in the same render.

---

## 6. Implementation shape (so the index is built once)

```js
let helpBotIndex = null;
function helpIndex() {
  if (helpBotIndex) return helpBotIndex;
  // 1. docs = HELP_TOPICS  ++  helpFaqTopics()          (:5769, :5774 — reuse, do not re-derive)
  // 2. for each doc: build 7 field token Sets (raw + stem), plus a stemmed sequence array per
  //    field for the bigram check, plus its multi-word keyword phrases
  // 3. fold HELP_POINTERS into their target's kw field (§1.13)
  // 4. compute df{} over the union of every doc's tokens, and the length>=4 vocabulary for fuzzy
  helpBotIndex = { docs, df, N: docs.length, vocab };
  return helpBotIndex;
}
```

Built on first query, not at module load — the app's cold start already does enough work, and a
user who never opens the panel should pay nothing. `HELP_TOPICS` is a frozen literal, so the index
never needs invalidating.

**Measured cost** (prototype, Node, same data): index build once ≈ 25ms; a query 1.5–4.0ms
including fuzzy fallback on a 3-token gibberish input. Well inside a single frame; no debounce, no
`requestIdleCallback`, no worker.

---

## 7. One alternative, argued honestly

### Alternative B — fix the matcher, skip the panel

Replace `helpSearch()` with the §1 matcher and make the "bubble" a plain shortcut button that
navigates to the existing Help view with the search box pre-focused. No panel, no transcript, no
new overlay, no keyboard maths, no focus-return, no `role="dialog"`.

**Genuinely in its favour:**

- **The real defect is the matcher, not the surface.** A user who types *"why cant i type in the
  daily limit box"* into the v55 search box gets zero results *today*. Alternative B fixes that for
  every user, in ~150 lines, with essentially no new UI risk.
- **It deletes the entire risk surface of §2, §3 and §5.** No z-index arithmetic against a nav that
  has already stolen taps once (v28), no `visualViewport`, no sixth appearance of the caret bug, no
  new focus-management code in an app whose existing focus management is already broken
  (`BACKLOG.md:9`).
- **The Help view already handles the hard parts** — 117 topics at three levels, back buttons that
  don't rely on the hardware Back button (`:5761`), the medical callouts, `helpRich()`.
- It is roughly a third of the work and a quarter of the test surface.

**Why I do not recommend it:**

- **It is the thing Aaron just told us was wrong.** He asked for a chatbot months ago; v55 gave him
  a browse-and-search screen; he has come back and described, in detail and unprompted, the exact
  Intercom/Zendesk pattern — bottom corner, tap, type, reply. Alternative B is v55 with a better
  search engine and a shortcut button. Shipping it would be answering a question he did not ask,
  for the second time.
- The behaviour he is describing is not decoration. *"They can click on it and start typing and the
  bot will look up their question and reply"* is a different mental model from a search screen: it
  is available from wherever the user is stuck, it accepts a sentence rather than keywords, and it
  answers rather than filters. A frightened caregiver stuck on the medication editor at 11pm does
  not go looking for a Help menu; they tap the thing in the corner.
- The pieces B avoids are the pieces that make it feel like an app rather than a document.

### Recommendation

**Build Alternative A (bubble + panel), but build the matcher as a standalone function that both
surfaces call** (§1.14). That is the actual recommendation: A's product outcome, with B's main
benefit — the Help view's search box gets fixed in the same release, for free, and if the panel
ever has to be pulled on a real device, pulling it leaves a strictly better v55 behind rather than
a hole.

---

## 8. Scope boundary

**In scope:** `helpMatch()` + index; the bubble; the panel; the clinical / person guards; wiring
`renderHelpView`'s search box to the new matcher; folding `HELP_POINTERS` into the index; raising
the toast to 150px; excluding the panel from the tick guard and from the `focusin` auto-scroll;
`APP_VERSION` + `sw.js` `CACHE` bump; deleting the now-fixed `BACKLOG.md:42` line.

**Out of scope, explicitly** — each of these is a separate release with its own gates:

- Fixing `closeDrawer()`'s focus return or the drawer Tab handler (`BACKLOG.md:9`).
- Any edit to `HELP_TOPICS` / `FAQ_ITEMS` copy, including the two known content gaps
  (`BACKLOG.md:30` treat-set-date, `BACKLOG.md:35` pro-switch paywall).
- The `sym-severe` oncology-nurse read (`BACKLOG.md:22`).
- History render performance (`BACKLOG.md:65`).
- `interactive-widget` on the viewport meta.
- Any persistence of the transcript, and any analytics of what people ask (**never** — rule 1).

---

## 9. Definition of done

### 9.1 Behaviours that must work

1. Bubble visible bottom-right on Home, Meds, Reports, In-Patient, Symptoms, Notes, Calendar,
   Settings, Account.
2. Tapping it opens the panel with the greeting, five starter chips, and the input focused.
3. Typing a sentence and pressing Enter (or Send) appends the user's message and a reply **in the
   same frame**.
4. Every question in §10 marked PASS returns its expected topic as the direct answer.
5. Every question marked LIST returns the disambiguation state with the expected topic among the
   rows shown.
6. Every question marked NONE returns the "I don't have an answer" state.
7. Every question marked CLINICAL returns the guard reply (§4.2) and **never** an app answer.
8. "Open the full walkthrough" lands on the correct topic in the Help view, in one transition, with
   a working Back button.
9. An FAQ hit opens the Common-questions accordion with that row expanded.
10. `medical` topics show the correct callout, tone and heading (§4.1).
11. Escape closes; focus returns to the bubble.
12. Tapping a bottom-nav tab closes the panel.
13. Searching in the *existing* Help view uses the new matcher and returns ranked results.
14. Searching "change units" in the Help view finds `vit-units` (the `HELP_POINTERS` fix).
15. Everything above works with the device offline / airplane mode — no network call exists.

### 9.2 Regressions that must not happen

1. **The caret bug does not return.** Type a long sentence slowly (>3s, crossing at least three
   tick boundaries) — no dropped characters, no caret jump, no panel flicker.
2. The Help view search box still works, still shows the FAQ accordion for Common questions, still
   shows the pointer cross-link row, and its counts (`117 topics`, `15 common questions`) are
   unchanged.
3. The plans sheet does not replay its animation; the medication editor does not flicker; the
   drawer does not flicker. (The tick guard was edited — re-verify every state already on it.)
4. The bottom nav is fully tappable across all five tabs at 360px and 390px, including the
   right-most (Symptoms) tab directly under the bubble.
5. The "Back to reports" pill is still tappable, with the bubble on screen.
6. The toast still appears, still wraps, still passes taps through, and no longer collides with the
   bubble.
7. The guided tour completes end-to-end with no bubble visible at any step.
8. First-run setup shows no bubble.
9. The drawer's Escape/Tab behaviour is exactly as it was (unchanged, including its known defect).
10. Zero console errors on every screen, mobile and desktop.
11. `localStorage` keys and their contents are byte-identical before and after a full panel session
    — nothing about the transcript is persisted anywhere.

---

## 10. Test fixture — 60 caregiver questions

Every row was run through the reference implementation in §12 against the live v55 corpus.
`Decision` is what the panel must do; `Top hit` is the measured winner and score.
**PASS** = expected topic ranked first; **NEAR** = expected topic in the top 3 but not first
(acceptable *only* because the disambiguation rows / "Not what you meant?" chips surface it);
**FAIL** = neither. **Current count: 50 PASS, 6 NEAR, 0 FAIL, plus 4 CLINICAL.**

| # | question (as typed) | expected | decision | measured top 3 |
|---|---|---|---|---|
| 1 | why cant i type in the daily limit box | `med-daily-limit-locked` | ANSWER | med-daily-limit-locked **1.67** / med-limit-unit 0.54 / faq:daily-limit 0.50 |
| 2 | daily limit is locked | `med-daily-limit-locked` | ANSWER | med-daily-limit-locked **1.78** / log-button-locked 0.91 |
| 3 | the limit box is greyed out | `med-daily-limit-locked` | ANSWER | med-daily-limit-locked **1.51** / log-button-locked 0.95 |
| 4 | im not getting any notifications | `rem-none` | ANSWER | rem-none **1.35** / rem-exact-toggle-missing 0.85 |
| 5 | no reminders coming through at all | `rem-none` | ANSWER | *NEAR* — rem-none-scheduled **0.72** / rem-none 0.38 |
| 6 | notifcations not working *(typo)* | `rem-none` | ANSWER | *NEAR* — rem-none-scheduled **0.56** / rem-paused-sim 0.44 / rem-none 0.41 |
| 7 | the reminder came 10 mins late | `rem-late` | ANSWER | rem-late **0.87** / rem-appointment 0.57 |
| 8 | alarms and reminders switch is missing on my samsung | `rem-exact-toggle-missing` | ANSWER | rem-exact-toggle-missing **1.46** / rem-none 0.82 |
| 9 | how do i add a new medicine | `med-add-first` | ANSWER | med-add-first **1.34** / med-not-on-home 0.65 |
| 10 | how do i add a med | `med-add-first` | ANSWER | med-add-first **1.52** / med-not-on-home 1.22 / faq:add-med 1.03 |
| 11 | my moms medication isnt on the home screen | `med-not-on-home` | LIST | *NEAR* — set-card-missing 1.18 / med-placement 1.14 / med-not-on-home 1.03 |
| 12 | all my meds vanished | `set-quicklog-collapsed` | ANSWER | set-quicklog-collapsed **1.30** |
| 13 | the app is broken | `app-report` | LIST | *NEAR* — app-old-version 0.93 / app-report 0.86 |
| 14 | the screen is blank | `app-blank` | ANSWER | app-blank **1.45** |
| 15 | screen keeps flickering | `set-something-flickering` | ANSWER | set-something-flickering **1.21** |
| 16 | i tap the button and nothing happens | `app-nothing-happens` | ANSWER | app-nothing-happens **1.54** |
| 17 | what dose should i give | **CLINICAL** | GUARD | *(would have been miss-real-missed 0.64 — must be suppressed)* |
| 18 | is 101 a fever | **CLINICAL** → `vit-temp-high` | GUARD | vit-temp-high 0.49 |
| 19 | should i take a double dose | **CLINICAL** | GUARD | *(would have been miss-real-missed 0.92 — must be suppressed)* |
| 20 | can he take two paracetamol together | **CLINICAL** | GUARD | *(0.37 — below threshold anyway; guard must still fire)* |
| 21 | he missed his chemo pill last night what do i do | `miss-real-missed` *(careLead)* | LIST | miss-real-missed **0.50** / miss-what-counts 0.41 |
| 22 | i think i logged the same dose twice | `log-double-tap` | ANSWER | log-double-tap **1.39** |
| 23 | how do i delete something i logged by mistake | `log-remove` | ANSWER | log-remove **1.07** / sym-edit-delete 0.53 |
| 24 | can i log a dose from yesterday | `log-wrong-time` \| `log-forgot-yesterday` | LIST | log-wrong-time 1.14 / log-forgot-yesterday 1.06 |
| 25 | export to excel | `exp-csv` | ANSWER | exp-csv **0.99** |
| 26 | where did my csv file go | `exp-where-file` | ANSWER | exp-where-file **1.18** / exp-csv 0.66 |
| 27 | print a report for the doctor | `exp-printable` | ANSWER | exp-printable **1.16** / exp-print-blocked 0.70 |
| 28 | how do i put in his weight | `vit-weight-log` | LIST | vit-weight-log 1.45 / vit-weight-change 1.45 / rep-weight 1.45 |
| 29 | the temprature wont save *(typo)* | `vit-temp-rejected` | ANSWER | *NEAR* — med-save-blocked **1.16** / vit-temp-rejected 0.64 |
| 30 | change it to celsius | `vit-units` | ANSWER | vit-units **1.07** |
| 31 | i look after two people | `pro-add` | LIST | pro-add 0.80 |
| 32 | how much does pro cost | `pro-plans` | ANSWER | pro-plans **0.96** |
| 33 | is my information private | `priv-server` \| `faq:privacy` | LIST | priv-server 0.57 / faq:privacy 0.47 / priv-who-sees 0.45 |
| 34 | what happens if i lose my phone | `priv-lost-phone` | ANSWER | priv-lost-phone **1.10** |
| 35 | his meds say restricted | `ip-meds-restricted` *(medical)* | ANSWER | ip-meds-restricted **1.44** |
| 36 | i forgot to end the hospital stay | `ip-forgot-end` | ANSWER | ip-forgot-end **1.58** / ip-start-end 0.97 |
| 37 | the back button closes the whole app | `app-back-button` | ANSWER | app-back-button **1.70** |
| 38 | how do i do the walkthrough again | `tour-replay` | ANSWER | tour-replay **1.55** |
| 39 | whats the difference between notes and the check in | `note-vs-checkin` | ANSWER | note-vs-checkin **1.52** |
| 40 | add an appointment reminder | `appt-add` \| `appt-reminder-choose` \| `rem-appointment` | LIST | rem-appointment 1.21 / appt-reminder-choose 1.11 / appt-add 0.92 |
| 41 | red banner wont go away | `miss-banner` | ANSWER | miss-banner **1.64** |
| 42 | clear all the missed doses at once | `miss-clear-all` | ANSWER | miss-clear-all **1.51** / miss-resolve 1.06 |
| 43 | history is really slow | `rep-history-slow` | ANSWER | rep-history-slow **1.15** |
| 44 | i cant find something i logged | `rep-entry-missing` | ANSWER | rep-entry-missing **1.35** |
| 45 | does it work with no internet | `app-offline` | ANSWER | app-offline **1.50** |
| 46 | wat version am i on *(typo)* | `app-version` | LIST | app-version 0.97 / app-old-version 0.87 |
| 47 | how do i start over and erase everything | `set-erase-all` | ANSWER | set-erase-all **1.84** / faq:reset 1.31 |
| 48 | diarrhoea where do i put it | `sym-bowel-confusion` | ANSWER | sym-bowel-confusion **1.30** |
| 49 | asdfgh | **NONE** | NONE | *(no terms resolve)* |
| 50 | thanks | **NONE** | NONE | *(all stopworded)* |
| 51 | hows the weather today | **NONE** | NONE | top 0.32, below 0.40 |
| 52 | pause a medication for a week | `med-pause-resume` | ANSWER | med-pause-resume **0.78** |
| 53 | it wont let me save the medication | `med-save-blocked` | ANSWER | med-save-blocked **1.49** |
| 54 | what does reminds at mean | `med-windows` | LIST | med-windows 1.09 / faq:schedule-windows 0.95 |
| 55 | i want a reminder every 4 hours | `med-gap-hours` \| `med-asneeded-vs-scheduled` | ANSWER | *NEAR* — faq:gap-timer **0.80** / rem-after-3-days 0.65 / med-gap-hours 0.45 |
| 56 | why is the log button greyed out | `log-button-locked` | ANSWER | log-button-locked **1.48** |
| 57 | when does a dose count as missed | `miss-what-counts` | ANSWER | miss-what-counts **1.52** |
| 58 | how do i set the treatment date | `treat-set-date` \| `faq:treatment-date` | ANSWER | treat-set-date **1.78** |
| 59 | radiation session counter | `treat-radiation` | ANSWER | treat-radiation **1.57** |
| 60 | i picked the wrong treatment type | `pro-wrong-treatment-type` | ANSWER | pro-wrong-treatment-type **1.68** / treat-other-profile 1.40 |

**On the six NEARs — these are the interesting ones and the Auditor should read them, not skim
them:**

- **#5 / #6** — `rem-none-scheduled` (*"It says 'No reminders are currently due…'"*) beats `rem-none`
  because its keywords literally contain `"no reminders"`. Defensible, and both are one tap apart
  in the shown rows, but if the Auditor judges it wrong the cheap fix is a **content** change
  (add `"none at all"`, `"not working"` to `rem-none`'s keywords) — which is out of scope for v56
  and belongs in `BACKLOG.md`.
- **#11** — `set-card-missing` vs `med-not-on-home`: genuinely ambiguous (a medication can be off
  Home for either reason). LIST is the right output.
- **#13** — `app-old-version` vs `app-report` at 0.93/0.86: "the app is broken" *is* ambiguous. LIST.
- **#29** — "the temprature wont save" answers `med-save-blocked` confidently because *"won't … save"*
  is that topic's exact title. The "Not what you meant?" chip carrying `vit-temp-rejected` is what
  saves this one; **verify that chip renders**.
- **#55** — `faq:gap-timer` is arguably the *correct* answer (its text is literally *"minimum time
  ChemoWell requires since the last dose … (e.g. every 4 hours)"*). Counted NEAR only because the
  fixture's expectation named the walkthrough.

### 10.1 Out-of-scope probes — must not produce a confident answer

| probe | must be | measured |
|---|---|---|
| whats for dinner | NONE | no terms resolve |
| ok / help / hello / thank you so much | NONE (greeting state) | all stopworded |
| how long does chemo last | NONE | 0.33 |
| how many mg of tylenol is safe | CLINICAL guard (and 0.33, below threshold) | 0.33 |
| can i give him ibuprofen | CLINICAL guard | 0.30 |
| is 99.8 too high | CLINICAL guard | 0.37 |
| my car wont start | LIST at most | 0.49 |
| i love this app | LIST at most | 0.79, coverage gate blocks ANSWER |
| will she lose her hair | LIST at most — **never** answers "What happens if I lose my phone?" | 0.78, coverage gate blocks ANSWER |
| my husband is very tired all the time | LIST at most | 0.44 |
| are you a real person / can i speak to someone / is anyone there | person guard (§3.7) | 0.72 / 0.68 / 0.35 |
| what time is it | LIST at most | 1.45 (`rem-checkin-time`) — acceptable, it is a time question |

---

## 11. Acceptance criteria for the Zero Day Auditor

Per `TEAM.md`, this is a genuine new feature that touches a safety-adjacent surface (medical
callouts, refusal behaviour), so it gets the **full minimum-20-case sweep**, mobile-first, with
real data the Auditor creates.

**A. Matcher — all 60 fixture cases + 12 out-of-scope probes**, driven through the panel in a real
browser (not by calling the function). Record decision + top hit for each; every deviation from
§10 is a finding.

**B. Medical (highest severity — any failure is a blocker).**
1. All four `careLead` topics reached through the panel show `NOTICE_TONES.urgent`, heading
   **"Contact your care team"**, and the topic's own `a` verbatim.
2. All five non-`careLead` `medical` topics show `NOTICE_TONES.attention`, heading **"Not medical
   advice"**, and `HELP_CARE_TEAM_LINE` verbatim — character-for-character against `index.html:2131`.
3. The callout is above the answer and above the steps in every case, at 360px, with the keyboard
   open and closed.
4. All four CLINICAL fixture rows plus the four clinical probes produce the guard reply and no app
   answer.
5. The bot never emits a number, a threshold, a range, or the words "fine"/"normal"/"safe" in any
   reply that was not already in the v55 corpus. `git diff` on the corpus constants must be empty.

**C. Layout — 360px and 390px, both explicitly.**
1. Bubble at 56×56, `bottom: calc(84px + inset)`, `right: 14px`, ≥15px clear of the nav.
2. All five bottom-nav tabs tappable, **including a real tap on the Symptoms tab directly beneath
   the bubble** — this is the app-v28 failure mode and a screenshot is not evidence; a click that
   actually navigates is.
3. "Back to reports" pill and bubble both tappable simultaneously on a report detail screen.
4. A toast raised while the bubble is on screen does not overlap it, still wraps, and taps still
   pass through it to whatever is underneath.
5. Panel at 360px: header + greeting + 5 chips + composer all reachable; nothing clipped; composer
   never scrolls off.
6. Panel at 390px, and at 320px as a stretch (the project has prior screenshots at 320).
7. Desktop ≥520px: panel is 380px wide, anchored right.

**D. Hide-state matrix — one case each, all must show *no bubble and no panel*:** first-run setup
from a wiped install; loading overlay; every guided-tour step for **all four treatment types**
(chemo, radiation, both, Other — per `TEAM.md`'s Auditor requirements); drawer open; each of the
seven modals; medication editor open; the Help view.
Plus the **must-still-show** cases: report detail with the Back pill; every armed `confirmDelete*`
state.

**E. The tick / caret suite.**
1. Type a 15-word sentence at ~1 word/second (crosses ≥10 ticks). Every character lands; caret never
   moves; the panel never flickers or replays its animation.
2. Open the panel, focus the input, then tap elsewhere in the panel so nothing is focused, and wait
   20 seconds. No flicker, no animation replay.
3. Re-verify every state already in the tick guard at `:7835`: plans sheet, drawer, appointment
   modal, note modal, check-in modal, medication editor, info modal, erase-all modal, and each
   delete-confirm.

**F. Keyboard / a11y.**
1. Android Chrome (or the emulator job) with the keyboard up: the composer stays visible above the
   keyboard and the transcript is still scrollable.
2. The page behind the panel does not lurch 320ms after focusing the input (§5.4).
3. Escape closes the panel and focus lands on the bubble — verified with
   `document.activeElement`, not by eye.
4. Tab order inside the panel is header → transcript controls → input → send, and Tab **does** leave
   the panel (it is non-modal by design — confirm this is not reported as a bug).
5. The drawer's own Escape/Tab behaviour is byte-identical to v55, including its documented defect.
6. A new reply is announced by the `role="log"` region.

**G. Persistence / privacy.**
1. Snapshot all `localStorage` and `sessionStorage` keys before and after a 10-message panel
   session — identical. No new key; no transcript anywhere.
2. Reload mid-conversation: the transcript is gone, the app is on the same view, nothing errors.
3. Switch profile with the panel open: the transcript is cleared.
4. Airplane mode / offline: the panel works identically. **Zero network requests** while it is open
   (DevTools Network tab, not inference).

**H. Release mechanics.** `./release_check.sh` exits 0; `sw.js` CACHE is `chemowell-app-v56-1` and
appears exactly once outside comments; `APP_VERSION` is `app-v56`; `./mark_published.sh` run as part
of the push; README version-history entry; `BACKLOG.md:42` deleted and the §4.2 symptom-guard gap
added.

---

## 12. Reference implementation of the matcher

Validated against the live v55 corpus; produced every number in §10. It is a scoring reference,
not shippable code — the Lead Developer adapts it to this file's conventions (module-scope
constants near the other `HELP_*` constants, no `export`, no `import`).

```js
// ---- normalise / stem -------------------------------------------------------
function helpNorm(s) {
  return (s || '').toLowerCase()
    .replace(/[‘’ʼ´]/g, "'").replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function helpStem(w) { /* exactly as printed in §1.4 */ }

// ---- index ------------------------------------------------------------------
const HELP_FIELDS = [['q',1.0],['kw',0.9],['a',0.55],['cat',0.45],['steps',0.35],['branch',0.30],['note',0.25]];

function helpIndex() {
  if (helpBotIndex) return helpBotIndex;
  const ptr = {};                                    // HELP_POINTERS -> target keyword aliases
  HELP_POINTERS.forEach(p => { (ptr[p.to] = ptr[p.to] || []).push(p.q); });
  const cats = {}; HELP_CATEGORIES.forEach(c => { cats[c.id] = c; });

  const docs = helpAllTopics().map(t => {            // :5774 — topics + FAQ, unchanged
    const c = cats[t.cat] || { label: '', blurb: '' };
    const kwList = (t.keywords || []).concat(ptr[t.id] || []);
    const fields = {
      q: t.q, kw: kwList.join(' '),
      a: t.a || '', cat: c.label + ' ' + (c.blurb || ''),
      steps: (t.steps || []).join(' '),
      branch: (t.branches || []).map(b => b.when + ' ' + b.steps.join(' ')).join(' '),
      note: t.note || ''
    };
    const tok = {}, seq = {};
    HELP_FIELDS.forEach(([f]) => {
      const ws = helpNorm(fields[f]).split(' ').filter(Boolean);
      seq[f] = ws.map(helpStem);
      tok[f] = new Set(); ws.forEach(w => { tok[f].add(w); tok[f].add(helpStem(w)); });
    });
    const all = new Set(); HELP_FIELDS.forEach(([f]) => tok[f].forEach(w => all.add(w)));
    return { t, tok, seq, all, kwPhrases: kwList, isFaq: !!t.faqId };
  });

  const df = {}; docs.forEach(d => d.all.forEach(w => { df[w] = (df[w] || 0) + 1; }));
  helpBotIndex = { docs, df, N: docs.length, vocab: Object.keys(df).filter(w => w.length >= 4) };
  return helpBotIndex;
}

// ---- query terms ------------------------------------------------------------
function helpTerms(query) {
  const ix = helpIndex(), raw = helpNorm(query).split(' ').filter(Boolean), out = [], seen = {};
  raw.forEach(w => {
    const expanded = HELP_SYNONYMS[w] ? HELP_SYNONYMS[w].split(' ') : [w];
    expanded.forEach(x => {
      if (!HELP_SYNONYMS[w] && HELP_STOP.has(x)) return;
      if (x.length < 2 && !/^[0-9]$/.test(x)) return;
      if (seen[x]) return; seen[x] = 1; out.push(x);
    });
  });
  return out.map(w => {
    if (ix.df[w]) return { key: w, quality: 1.0 };
    const s = helpStem(w);
    if (ix.df[s]) return { key: s, quality: 0.9 };
    let f = helpFuzzy(w) || helpFuzzy(s);            // bounded Damerau-Levenshtein, §1.6
    if (f && HELP_SYNONYMS[f]) f = helpStem(HELP_SYNONYMS[f].split(' ')[0]);
    if (f && ix.df[f] === undefined) f = helpFuzzy(f);
    return f ? { key: f, quality: 0.65 } : { key: w, quality: 0 };
  });
}

// ---- score ------------------------------------------------------------------
const HELP_UNKNOWN_IDF = 1.2;
function helpScore(d, terms, ix) {
  let num = 0, den = 0, matched = 0, anchor = false;
  terms.forEach(t => {
    const dfc = ix.df[t.key];
    const idf = dfc ? Math.log(1 + ix.N / dfc) : HELP_UNKNOWN_IDF;
    den += idf;
    if (!t.quality) return;
    let best = 0, hits = 0;
    HELP_FIELDS.forEach(([f, fw]) => { if (d.tok[f].has(t.key)) { hits++; if (fw > best) best = fw; } });
    if (best > 0) {
      matched++; if (best >= 0.9) anchor = true;
      num += idf * t.quality * (best + Math.min(0.45, 0.15 * (hits - 1)));
    }
  });
  if (!den) return { score: 0, matched: 0, cov: 0, anchor: false, nterms: 0 };
  let s = num / den;

  const keys = terms.map(t => helpStem(t.key));       // adjacent-bigram bonus, capped +0.30
  let bg = 0;
  for (let i = 0; i + 1 < keys.length; i++) {
    let b = 0;
    HELP_FIELDS.forEach(([f, fw]) => {
      const sq = d.seq[f];
      for (let j = 0; j + 1 < sq.length; j++) {
        if (sq[j] === keys[i] && sq[j + 1] === keys[i + 1]) { const v = fw >= 0.9 ? 0.15 : 0.07; if (v > b) b = v; break; }
      }
    });
    bg += b;
  }
  s += Math.min(0.30, bg);

  for (let i = 0; i < d.kwPhrases.length; i++) {      // keyword-phrase bonus, +0.18 once
    const pt = helpNorm(d.kwPhrases[i]).split(' ').filter(Boolean).map(helpStem);
    if (pt.length < 2) continue;
    let ok = true, idx = -1;
    for (let k = 0; k < pt.length; k++) { const at = keys.indexOf(pt[k], idx + 1); if (at < 0) { ok = false; break; } idx = at; }
    if (ok) { s += 0.18; break; }
  }
  if (d.isFaq) s *= 0.95;
  return { score: s, matched, cov: matched / terms.length, anchor, nterms: terms.length };
}

// ---- public -----------------------------------------------------------------
function helpMatch(query) {
  const ix = helpIndex(), terms = helpTerms(query);
  if (!terms.length) return [];
  return ix.docs.map(d => ({ topic: d.t, ...helpScore(d, terms, ix) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function helpBotDecide(query) {
  const hits = helpMatch(query);
  const top = hits[0], second = hits[1];
  if (!top || top.score < 0.40) return { mode: 'none', hits: [] };
  const covOK = top.nterms <= 2 ? top.cov >= 0.999 : top.cov >= 0.6;
  const clear = top.score >= 0.55 && top.anchor && covOK && (!second || top.score >= second.score * 1.15);
  if (clear) return { mode: 'answer', topic: top.topic, alts: hits.slice(1, 4).filter(h => h.score >= top.score * 0.5) };
  return { mode: 'list', hits: hits.filter(h => h.score >= 0.40).slice(0, 4) };
}
```

`helpBotDecide()` is called only **after** the person guard (§3.7) and the clinical guard (§4.2)
have both declined to fire. That ordering is load-bearing: a safety guard that runs after a
scoring function is a safety guard that can be tuned away.
