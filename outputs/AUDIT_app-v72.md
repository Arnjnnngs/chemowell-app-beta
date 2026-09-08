VERDICT: BLOCK

**Headline: the only sentence in the table that describes a PRODUCT rather than a drug is wrong for
the form an oncology patient most likely has — `'lidocaine': 'A numbing cream for soreness in one
spot on the skin.'` is care-tracker's line about one patient's tube of cream, ported into an app
where every medication is one the user typed, and "Lidocaine" here is just as likely to be the
viscous rinse for chemo mouth sores or a patch. That is a wrong line on the right medication, which
this brief ranks as the worst outcome class, and it ships under a disclaimer that says it is general
information about the medication. Two smaller copy defects ride with it. Everything MECHANICAL in
this release is clean: both care-tracker v74 blocks are genuinely fixed and I could not reopen
either, the editor round-trip is field-for-field identical to app-v71 on four medication shapes,
nothing clips at 320px, and 24/24 reproduces.**

Audited 2026-09-08 against `index.html` (`APP_VERSION` read from the file under test: **app-v72**,
`sw.js` CACHE `chemowell-app-v72-1`), control `git show ff407a7^:index.html` (**app-v71**). No
network on any run (`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy`; the suite
refuses to start with a proxy set). Chromium at `/opt/pw-browsers/chromium`. **Nothing in the repo
was edited except this file, and nothing was committed.** Probes live in the scratchpad.

---

# BLOCK 1 — a statement about one person's tube of cream, shipped as a fact about a drug

```js
'lidocaine': 'A numbing cream for soreness in one spot on the skin.',
```

It is the **only** entry of the 41 that names a dosage form and a body site. Every other line names
an effect and stops — "Eases nerve pain", "Slows the gut down to control diarrhea", "Lowers uric
acid levels". That inconsistency is the tell, and its origin is visible in the sibling repo:
care-tracker has a fixed thirteen-medication list in which Lidocaine *is* Brandi's cream, so the
sentence was true there. **ChemoWell has no default medication list.** Every entry in the table is
keyed to text a stranger typed, and the two lidocaine products an oncology patient most often has
are neither a cream nor for the skin:

- **lidocaine viscous**, the swish-and-spit rinse for chemotherapy mouth sores — mucositis is one of
  the commonest reasons a chemo patient is given lidocaine at all;
- a **lidocaine patch**, for a painful area.

A patient given the rinse for mouth sores opens Meds, sees the app say her medication is a cream for
skin, and now has to decide whether the app is confused or she is. Rule 2.7 question 1 is *"Is it
true? Not roughly right — true."* It is not true, and it is untrue in the direction of route of
administration, which is the one detail on which being wrong about a numbing agent matters.

**Cheapest honest fix — one data line, no code:** describe the effect and drop the form.
`'lidocaine': 'A numbing medicine that dulls pain in the area where it is used.'` That is true of the
cream, the patch and the rinse. Then re-read the whole table for the same class: **no line may name a
dosage form, a route or a body site**, because the key is a drug name and the drug has many forms.
Worth adding to the suite as a guard (`/\b(cream|gel|patch|tablet|capsule|injection|rinse|skin)\b/i`
over the table) — it would have caught this one and costs nothing.

# BLOCK 2 — "used for sickness" is British idiom in an app that otherwise writes American

```js
'lorazepam': 'Eases anxiety, and is also used for sickness and sleep.',
'ativan':    'Eases anxiety, and is also used for sickness and sleep.',
```

"Sickness" for nausea is British/Irish. The app's own display copy is American throughout — it says
*liters*, and every other entry in this very table says **nausea** ("Prevents and settles nausea and
vomiting", "Settles nausea and vomiting", "A steroid that calms nausea"). To a US patient at 2am
"used for sickness" reads as *used for being ill*, which describes nothing and invites her to take a
benzodiazepine because she feels unwell. Rule 2.7 question 2, failed.

**Fix:** `'Eases anxiety, and is also used for nausea and for sleep.'`

Worth flagging that the gate suite has the same idiom baked into its fixture — it types
`'My oncologist prescribed this for sickness'` — so the wording will read as house style to whoever
edits the table next.

# BLOCK 3 — the disclaimer describes a line that is often not on the screen

Measured, in a browser, with one unrecognised medication seeded and nothing else:

```
{ "disc": 1, "lines": 0,
  "text": "The line under each medication is general information, not medical advice. ..." }
```

The disclaimer is rendered unconditionally, above the cards. **This app has no default medication
list and the table is 41 supportive-care drugs** — no capecitabine, no paclitaxel, no
letrozole, no trastuzumab, nothing a user is likely to type as their actual treatment. So a new user
whose medications are all unrecognised, and who has typed no purposes of her own, gets a sentence
telling her about "the line under each medication" when there is no line under any medication. It is
the same class as the four consecutive false What's New notes Rule 2.7 was created for: a sentence
that is not true of the screen it is printed on.

**Fix, one line:** render the disclaimer only when at least one card has a line —
`sortedMeds.some(purposeOf) ? h('div', {'data-med-disclaimer': ...}) : null`. The suite's
"appears exactly once" check keeps passing (its fixture has recognised medications); add a second
case with only unrecognised ones asserting **zero**.

---

# NOT BLOCKING, but fix in the same pass

## F1 — the schedule guard misses the exact phrase the patch says it catches

The shipped source comment and the patch header both say:

> *"around chemo" / "after chemo" are gone because they are schedules written in words, which is what
> the guard in `test/v72-med-purpose.mjs` exists to catch.*

Run against the guard's own regex:

| candidate line | guard |
|---|---|
| `A steroid given around chemo` | **CAUGHT** |
| `A steroid given after chemo to calm nausea.` | **passes** |
| `Given after chemo.` | **passes** |
| `Take at night for sleep.` | passes |
| `Take two tablets` | passes |

Half of the claim is false. `after chemo` is not in the alternation (`on chemo days|around chemo|with
chemo` are), and neither is `at night`, nor any number written as a word. The guard is not too tight
— no legitimate line trips it — it is **too loose in the one place its own documentation points at.**

## F2 — there is NO fever guard at all, and fever removal is this release's headline safety decision

The header devotes a paragraph to it: *"EVERY FEVER CLAUSE IS DELIBERATELY GONE... a fever during
chemo is a thing to REPORT, not to suppress."* I confirmed none is present in the shipped table
(`fever`/`temperature`: zero matches). **But nothing in the suite would notice one coming back.**
The patch header also says the table is expected to be refreshed later — *"Refreshing it to exact
federal wording later is a data change into the same table"* — and federal wording for
acetaminophen and ibuprofen says *reduces fever* in so many words. The single most likely future
edit to this file walks straight through the gate. Add `/\bfever|temperature\b/i` to the section 1
table checks; it is one line and it is the check that matters most here.

## F3 — the placeholder does not appear while a new medication's name is typed

The patch header claims: *"The placeholder is resolved from the NAME BEING TYPED, so it appears as
soon as a recognised medication name is entered on a brand-new medication."* Measured — Meds → Add,
typed `Zofran` keystroke by keystroke, waited 1.2s:

```
{ "nameValue": "Zofran",
  "purposePlaceholder": "For example: settles nausea",
  "purposeValue": "" }
```

`updateMedicationForm('name', ...)` is called with no `rerender` argument, so nothing re-renders and
the placeholder — computed at render time from `state.medEditor.form.name` — never updates. The
control for this is the suite's own section 4 PASS: on an already-saved Zofran the editor opens with
`placeholder: "Prevents and settles nausea and vomiting."`, so the resolver is fine; only the live
update is missing. Not harmful (the line appears on the card after saving, and reopening the editor
shows it), but the claim in the release documentation is untrue and the feature is less discoverable
than it is described as being. Either pass `rerender: 'debounced'` on the name field, or delete the
sentence from the header.

## F4 — the key normaliser does not do what the comment above it says

```js
// ...so "Zofran (ODT)" and "zofran" land on the same key.
```

Measured: `"ZOFRAN (ODT)"` → `"zofran odt"`, which is not `"zofran"` and matches nothing. The
comment is false. The behaviour is a **miss, not a wrong line**, which is the safe direction, so this
is a comment fix, not a code fix — unless you want suffixed brand names to resolve, which I would
not recommend: matching on a prefix is how a wrong line gets attached to the wrong drug.

## F5 — "42 entries" is 41

`outputs/PM_app-v72.md` line 38 and the audit brief both say 42. The file has 41 keys, and the suite
prints `41 entries`. No entry is being dropped by the suite's extraction regex — I checked
(`suite-visible: 41`, `missed by suite: []`) — the count in the write-up is simply wrong.

---

# WHAT I TRIED TO BREAK AND COULD NOT

## The name-keyed lookup — this app's own risk, and it is properly guarded

`purposeLookup` uses `Object.prototype.hasOwnProperty.call` **and** a `typeof v === 'string'` check.
Both care-tracker v74 crash paths are closed. Probed keys and results:

| typed name | key | result |
|---|---|---|
| `constructor` / `Constructor` | `constructor` | `''` — no line, no throw |
| `toString` | `tostring` | `''` |
| `hasOwnProperty` | `hasownproperty` | `''` |
| `__proto__` | `proto` | `''` |
| `Zofran!!!` | `zofran` | correct line |
| `  zofran  ` | `zofran` | correct line |
| `ZOFRAN®` | `zofran` | correct line |
| `Ｚｏｆｒａｎ` (fullwidth) | `` (empty) | `''` — the `!k` early return catches it |
| `Tylenol #3` | `tylenol 3` | `''` — correct, that is a different drug |
| `Senokot-S` | `senokot s` | `''` — correct |

The empty-key early return matters more than it looks: without it, `''` would be tested against the
table and a unicode-only name would take whatever `MED_PURPOSE['']` did. It is there.

The suite's section 6 reproduces the care-tracker crash properly — **and its own comment records that
its first version could not fail** (it drove the add form, which needs more than a name, so nothing
was ever added and it passed 24/24 against the bare-index build). That rewrite is the right one:
writing straight into storage and reloading is the truer test, because the damage was persistence,
not the moment of adding. I looked for the same class elsewhere in the suite and found no second
instance — every remaining assertion is against a value read from the file under test or from
`localStorage`, none against `document.body.textContent`, none pinning a version literal.

## The generic-name fallback

`purposeOf` is `typed || lookup(name) || lookup(sub)`. Name-typed `Mystery` + generic `Ondansetron`
resolves to the ondansetron line — correct, and the suite asserts it on Pantoprazole. Name matching
one entry and generic matching a different one resolves to the **name**, which is the right
precedence: the name is what the user calls the medication, the generic is a note about it.

## The medication editor — the "neighbouring field gets dropped" class

Four medication shapes seeded, editor opened, **Save changes** pressed with nothing altered, stored
object dumped and diffed field-by-field against app-v71 doing the identical thing:

| shape | fields exercised | difference v71 → v72 |
|---|---|---|
| Zofran | gap type, gapH, doses, quickLog, note, generic | `purpose` absent → `""` — **nothing else** |
| Dexamethasone | window type, 2 windows, daily limit + unit, grouped-morning, treatment-only with before/after days, weekly schedule, paused, note | `purpose` absent → `""` — **nothing else** |
| Iron | interval schedule with anchor, grouped-evening, pills limit unit | `purpose` absent → `""` — **nothing else** |
| Madeupzz | minimal, unrecognised | `purpose` absent → `""` — **nothing else** |

Schedule type, windows, gap hours, daily limit and unit, dose options, home-screen placement,
treatment-day availability and day counts, notes, paused state and `alerts` all survive byte-identical.
`normalizeMedication` spreads `...original` first, so the new key needs no whitelist entry. Zero page
errors on either build.

## Storage and rollback

`persistMedicationConfig` writes the whole medication object, and `normalizeMedication` on **both**
builds begins `{ ...original }`, so:

- an app-v71 build reading a v72-written config **keeps** `purpose` (it passes through untouched and
  is written back on the next save) — rollback is safe, nothing is lost going backwards;
- a v72 build reading a pre-v72 config sees `purpose` absent, `purposeOf` falls to the table, and the
  first save stamps `purpose: ""` — which resolves identically. No migration needed.

`purpose` is never read by reminders, missed-dose tracking, dose ceilings, the report paths or the
backup writer — I checked every read site of the medication object that the diff could reach. There
is no medication-config diff/compare path in this build for two phones to disagree over (`sync` here
covers entries, not the medication list), so the field cannot make two devices report as differing.

## Rendering at 320px

Meds screen, three recognised medications, 320px viewport: `documentElement.scrollWidth === 320`
(no horizontal page scroll), every purpose line `scrollWidth === clientWidth` (nothing clipped), the
line wraps to two rows and the card grows to fit, and **zero** elements overflow their box without an
explicit scroll style. The `h()` trap does not apply: `'data-med-purpose': med.id` is always a string
and the `placeholder` expression always ends in a string fallback, so no conditional attribute can
arrive as `null`/`false`.

## Falsification numbers

- Gate suite on this build: **24/24**. On the app-v71 base it cannot even start section 2 — the
  builder reports 12/24, consistent with what I see (no table, no `data-med-purpose`, no field).
- My editor-round-trip probe, falsified: run against app-v71 as if it were the release and the
  `purpose` column reads `<absent>` on all four shapes instead of `""` — the probe distinguishes the
  builds, so a dropped field would show. Run against v72 it shows exactly one added key and no other
  difference.
- My placeholder probe, falsified against its control: on a **saved** Zofran the same selector reads
  `placeholder: "Prevents and settles nausea and vomiting."` (suite section 4, PASS); on the
  **add** form after typing the same name it reads `"For example: settles nausea"`. Same code, same
  selector, opposite results — the probe is measuring the re-render, not the resolver.
- The schedule-guard result above is the guard's own regex evaluated directly, red on
  `around chemo` and green on `after chemo`.

# DELIBERATELY EXEMPT

- **iPhone rendering.** This sandbox has Chromium only. 320/360/390 Chromium is not an iPhone and
  never will be; the Meds card at small text sizes on a real iPhone is Aaron's phone test, not mine.
- **Home is asserted clean, not skipped.** The suite checks `[data-med-purpose]` count is 0 on Home,
  which is the right shape for a deliberate exemption — the exemption is written down as an
  assertion instead of an absence.
- **The 41 sentences' clinical accuracy beyond Blocks 1 and 2.** I read all 41 as a patient and as
  someone checking for advice. The other 39 name an effect, carry no dose, no schedule, no fever
  clause and no instruction. `'iron': 'An iron supplement, for low iron levels.'` is circular but
  harmless; `'allopurinol': 'Lowers uric acid levels.'` is terse but true. None of them tells anyone
  to do anything. I am not a clinician and this is not a clinician's review.

# WHAT WOULD CLEAR THE BLOCK

Three data edits and one conditional, then a delta re-audit that only re-reads the table and the
Meds screen:

1. Lidocaine line rewritten with no form, no route, no body site — plus a table guard for that class.
2. "sickness" → "nausea" on lorazepam and ativan.
3. Disclaimer rendered only when at least one line exists, with the zero-line case asserted.
4. F1/F2 while the suite is open: `after chemo` into the schedule alternation, and a fever guard.

Nothing here needs the build re-architected. The engineering in app-v72 is the best-guarded version
of this feature either repo has produced; it is the medical text that is not ready.
