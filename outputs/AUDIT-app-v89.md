AUDITED-COMMIT: c692f8a
VERDICT: DO NOT SHIP

# Zero Day Audit — ChemoWell app-v89

Auditor: Zero Day Auditor (independent). Commit audited: `c692f8a` (parent `8a7d696`).
Audited against a **clean `git archive` export of c692f8a** served on its own port, not the working
tree — see "A note on the working tree" below, which matters for reproducing anything here.

Baseline re-run of the release suite against that clean export: **30/30, 0 failed.** Every claim
below was reproduced against that export.

---

## HEADLINE

**The one Help topic this release rewrote because it was false is still not usable at the moment it
is needed.** `priv-lost-phone` now gives a five-step recovery procedure. Step 4 — the step a person
follows after losing their phone — says *"On the new phone: install ChemoWell, then **Settings** →
**Export** → **Restore from a backup**"*. **On a new install there is no Settings, no menu and no
Restore.** `render()` short-circuits to the Welcome screen until a patient name exists
(`index.html:5426`), and that screen has exactly seven controls: Male, Female, Chemo, Radiation,
Both, Other, Get started. No menu button exists in the DOM at all.

The release's own changelog says *"That page now tells you how to save one, how to put a password on
it, and how to get everything onto a new phone."* The third clause is not true yet, and it is the
clause the person reads with a dead phone in their hand.

Second blocker, same topic: the encrypt-before-you-send instruction is **step 3 of 5**, printed
inside a numbered list, after step 1 ("Save backup file") and step 2 ("Email it to yourself").
Following the steps in the order they are numbered emails the complete medical record unencrypted,
and is then told to turn encryption on "first".

Both are one-line copy fixes. Neither is caught by any check in the new suite, including check 6.5,
which exists for exactly this class.

---

## BLOCKERS

### B1 — HIGH — The recovery procedure's first action on the new phone does not exist
**File/line:** `index.html:4203` (`HELP_TOPICS`, `priv-lost-phone`, step 4). Gate:
`index.html:5426`.

**Reproduce.** Clear all storage, open the app. You get the Welcome screen: patient name, sex,
treatment type, "Get started". There is no hamburger (`document.querySelector('[data-tour="menu-btn"]')`
is `null`), no Settings, no Export, no Restore, and the word "restore" does not appear on the
screen. Verified against the clean export of `c692f8a`.

**Why it matters to a caregiver.** This topic's entire reason for being rewritten in this release is
that the old one lied about backup existing and *"Someone could have lost a record because Help
denied the existence of the thing that would have saved it"* (the commit message's own words). The
new version replaces a lie with a procedure that stops dead at the step that counts. The person
following it has just lost a phone; they are not in a state to work out that they must first invent
a name, complete a three-question setup, and only then look for the menu.

**Fix (one clause).** Step 4 should read something like: *"On the new phone: install ChemoWell. Set
it up with any name to get past the welcome screen, then menu → **Settings** → **Export data** →
**Restore from a backup**, and pick the file."* Worth adding, because it is also surprising: on a
restore into the profile you just made, the name you typed at setup **wins** — `cwBkApplyTo()` fills
preference gaps only and never overwrites (`index.html:622-628`) — so the name in the backup does
not come back unless you choose "Put it in a new profile".

### B2 — HIGH — "Turn on the password **first**" is printed third, after the file has been shared
**File/line:** `index.html:4203`, `priv-lost-phone` steps 1–3. Rendering: `stepList()` at
`index.html:10169` draws these as a numbered `<ol>` under the heading "STEP BY STEP", so the reader
sees literal circled 1, 2, 3.

**Reproduce.** Help → Your data & privacy → "What happens if I lose my phone…". Rendered output:

```
1  Save one now: menu → Settings → Export → Save backup file. ...
2  Your phone's share screen opens. Email it to yourself, or put it in Drive or Files ...
3  Turn on Protect the file with a password first if you are sending it anywhere.
```

**Why it matters to a caregiver.** Steps 1 and 2 are a complete instruction to put an unencrypted
file containing every entry, appointment, note and medication into an email. The warning arrives
after the act. The app's own in-screen copy gets this right — `renderBackupSection()` says *"Put a
password on it before you send it anywhere"* **above** the buttons (`index.html:10970`), and
`renderBackupProtect()` sits above them too. Help inverts the order the screen itself uses.

**Compounding: the control named in step 1 stops existing once step 3 is done.** The Save button is
`state.bkProtect ? 'Save protected backup' : 'Save backup file'` (`index.html:10976`). Measured:
with the toggle off it reads **"Save backup file"**; with it on it reads **"Save protected
backup"**. So a reader who obeys "first" cannot find the button step 1 told them to tap. This is
v66's *"Tap Start or End"* defect exactly — named in the suite's own comment at
`test/v89-everything-free.mjs:264-265` as the thing check 6.5 mechanises — and 6.5 misses it
because it samples only the default state (`bkProtect` off).

**Fix.** Make the password step 1, and have step 2 name both labels: *"Tap **Save backup file** — or
**Save protected backup** if you turned the password on."*

---

## MAJOR (not blocking, but fix in this release)

### M1 — The changelog leads with a promise the app cannot keep
`index.html:9320`: *"If you lose your phone, your records come back — from a backup file you
saved."* The condition is real but arrives after the dash, behind an unconditional headline. Nobody
who has not saved a backup gets their records back, and this is the population most likely to read
that line. Lead with the condition. (Rule: never promise an outcome that has not been confirmed.)

### M2 — "the only thing in ChemoWell you had to pay for" is contradicted two bullets later
`index.html:9317` says the printable report *"was the only thing in ChemoWell you had to pay for"*;
`index.html:9319` says *"Paying now adds one thing only: more people to look after."* A second
person has always cost money. Scope the first bullet — "the only **feature** you had to pay for".

### M3 — Help names a screen section that is not called that
`priv-lost-phone` steps 1 and 4 and `exp-printable` all route via *"**Settings** → **Export**"*. The
section's visible heading is **EXPORT DATA**, and the two backup controls sit under a further
sub-heading, **BACKUP & RESTORE**. At 2am, "Export" and "Export data" are close enough to cost a
reader thirty seconds they do not have, and "Save backup file" is not under the words they were
told to look for.

### M4 — A Briticism, newly introduced, in a US-market app
`index.html:4202`, `priv-server` step 5, new in this release: *"there is nobody to **ring** who can
restore it for you."* "Ring" for "call" reads as foreign to the audience and to the rest of the
file. This repo already carries an explicit anti-Briticism check for spelling
(`test/v57-search.mjs`, the litre/liter case); idiom is the same defect with no check behind it.

### M5 — The new suite is not wired into `release_check.sh` in this commit
`git show c692f8a:release_check.sh` runs `test/v76-properties-equivalence.mjs`,
`test/v76-empty-window-render.mjs` and `test/v75-no-other-patient.mjs`. **`test/v89-everything-free.mjs`
is not in that list.** Hard rule 6 makes `release_check.sh` the mechanism precisely because "a rule
enforced only by the person it constrains is the one that gets skipped". A suite the gate does not
run is a suite that rots by the next release. (An uncommitted working-tree edit adds it — see the
working-tree note. It is not in the audited commit.)

---

## FALSIFICATION — four mutants I wrote, four survivors

Each is a byte copy of the **commit's** `index.html`, served on its own port, suite unmodified and
taken from `git show c692f8a:test/v89-everything-free.mjs`. The repo was not touched.

| # | Mutant | Suite result | Verdict |
|---|---|---|---|
| A9 | Settings-surface `+ Add profile` guard `>=` → `>` (Account untouched) | **30/30 green** | escape |
| A10 | Plus card regains two bullets: "Priority help by email" and "Shared caregiver access (coming later)" | **30/30 green** | escape |
| A11 | `openPrintReport()` gives free users only the last 3 rows (`rows.slice(-3)`) | **30/30 green** | escape |
| A12 | Prices swapped: Plus `$14.99`, Pro `$4.99` | **30/30 green** | escape |

**A11 is the one that matters.** It is the shape a future soft paywall actually takes — not the
button refusing, but the report quietly coming back short. Section 1 proves a *document* comes back
(`/Treatment record/` plus one seeded temperature) and says so honestly in its own comment, but it
never proves the document is **complete**. A free user hands a doctor a three-row record and nothing
anywhere says it was trimmed. Cheap fix: seed N entries across M days and assert the report contains
all N.

**A10 falsifies the suite header's own claim about section 5.** The header names section 5 as the
check most likely to be vacuous and defends it by saying it "asserts over a vocabulary —
report, backup, restore, CSV, export, insight, encrypted". That vocabulary is closed: a feature sold
tomorrow under a word not on the list passes, and 5.3's promise detector (`coming soon|in
development|planned`) is defeated by "coming later". Section 5 is not vacuous — it is
**enumerative**, which is a different and quieter weakness. Suggest inverting it: assert the two
paid cards' bullets match a small allow-list of profile-count language, rather than avoid a
deny-list of feature words.

**A9** is a near miss rather than a hole in the cap: the sheet stops appearing, but
`createProfile()` keeps its own `>=` guard (`index.html:634`), so no second profile is created —
the user gets a name field, taps **Create**, and **nothing at all happens, with no message**.
Measured: `{"list":[{"id":"p1",...}]}` unchanged after Create. The cap is genuinely two-layered,
which is good news; the gap is that section 3 drives only the Account surface and the Settings
surface at `index.html:10395` is untested.

**A12** survives because 4.2 only asserts both price strings appear *somewhere* in the sheet, not on
the right card. Low stakes in a simulated-purchase beta; a real stake the day Play Billing lands.

### The builder's eight mutants
Re-ran as supplied on ports 8901–8908 against the suite; all behaved as recorded (M1 four red, M2–M8
one red each). No disagreement with the builder's record. The builder's own disclosure about check
1.5 (sampling after `await popupPromise`, by which time the toast had auto-dismissed) is accurate
and the fix at `test/v89-everything-free.mjs:114-120` is the right one.

---

## MINOR

* `test/v89-everything-free.mjs:137` — section 2 never calls `await c.close()`. Every other section
  does. Test hygiene only.
* Section 5 reads `SHEET` captured in section 4. If section 4 ever fails to open the sheet, `SHEET`
  is `''` and 5.1 / 5.3 / 5.4 all pass on an empty string. 5.0 fails loudly in that case, so the
  suite does not go green — but three of its checks would be reporting nothing.
* `exp-printable` still carries `"plus"` in its `keywords` and still relates to `pro-plans`. A free
  feature indexed under the paid tier's name.
* `renderExportSection()`'s Printable report button keeps `display:'inline-flex'` and `gap:'7px'`
  now that the PLUS pill child is gone. Harmless, one child.
* `HELP_CATEGORIES` blurb for `profiles` still reads *"More than one person, and what Plus and Pro
  add"* — accurate, but "what they add" is now only the first half.

---

## CHECKED AND CLEAN

**The paywall removal.** `grep upgradeOpen: true` returns exactly four call sites, all the profile
cap (10395, 10396, 11311, 11344). The feature paywall is gone and nothing replaced it.
`openPrintReport()` after the deletion makes no tier assumption anywhere downstream;
`buildExportRows()` is the same function CSV already used. All three early returns reached and all
three say something true, measured on a free tier:
* empty record → *"Nothing to report yet — log something first"*;
* popups blocked (`window.open` stubbed to `null`) → *"Pop-up blocked — allow pop-ups for this app to
  print the report"*, and the plans sheet does **not** open behind it;
* native share failure → `catch` reports the message rather than falling through.

**The profile cap, the only thing still sold.** `tierLimit()` is untouched by this diff and still
`pro → Infinity, plus → 3, free → 1` (`index.html:172`). Driven through the real button:
free/1 → sheet, plus/1 → form, plus/3 → sheet, pro/3 → form. The Settings surface at the free cap
also still opens the sheet (measured separately, since the suite does not cover it).
`createProfileForRestore()` (`index.html:253-263`) is still deliberately uncapped, with its comment
intact, and `renderBackupChoice()` offers "Put it in a new profile" with no tier test — so Help's
claim *"restoring will make room for the profile it needs even on Free"* is **true**.

**The plans sheet still sells.** Three cards, three prices, `Simulate purchase (beta)` on both paid
cards. I clicked each one: Plus writes `{"tier":"plus","simulated":true,"purchasedAt":…}`, Pro writes
`"pro"`, and in both cases the sheet immediately re-renders with "✓ Current plan" on the right card
and the Buy button correctly replaced on that card only. The suite does **not** cover this — it
counts purchase controls but never presses one — so it is recorded here as audited by hand.

**Rendered, not read from source.** Opened the in-app What's New notice (upgrade path, `seen-version
= app-v88`), the What's new drawer view, and all four rewritten Help topics in a real browser. **No
literal `**` or backticks anywhere** — the app-v88 defect class is not repeated. `test/v55-help.mjs`
agrees ("no FAQ answer renders literal ** or backticks", 120 walkthroughs opened).

**Rule 0.** `test/v75-no-other-patient.mjs` 29/29 against the commit. No patient name; no gendered
pronoun in a user-facing string; no dose/ceiling/schedule; rule table 9 entries, ceilings 0/0/0. The
pronoun ratchet at **32 is correct and verified two ways**: the suite's own two-sided check reports
"32 found, ratchet set at 32", and the diff's added lines contain **zero** gendered pronouns while
the removed lines contain four. The new copy uses they/them throughout ("Each kept completely
separate — **their** own medications"), and the Designer's catch of "carer" → "caregiver" is present
in the shipped text.

**Layout on the two touched screens.** Export section and plans sheet measured at 320 / 360 / 390:
zero document overflow, zero element overflow, zero tap targets under 44px, at every width. The
plans sheet scrolls inside its own `88vh` box, and `upgradeOpen` is already in the scroll-lock
registry (`index.html:1868`), so Rule 5.5 is satisfied for this surface.

**Release mechanics.** `APP_VERSION = 'app-v89'` (`index.html:9307`) and `CACHE =
'chemowell-app-v89-1'` (`sw.js:1`) moved together. No `h()` null-attribute trap introduced — this
diff adds no attribute props, and the existing `Object.assign(..., saveBlocked ? {disabled:'disabled'} : {})`
spread pattern is intact with its warning comment.

**Regression suites run (all against the serving file):**

| Suite | Result |
|---|---|
| `test/v89-everything-free.mjs` (clean export) | 30/30 |
| `test/v75-no-other-patient.mjs` | 29/29 |
| `test/v84-whatsnew.mjs` | 100/100 |
| `test/v55-help.mjs` | ALL GREEN (120 walkthroughs) |
| `test/v57-search.mjs` | 53/53 exact, ALL GREEN |
| `test/v61-backup.mjs` | 22/22 (incl. "restoring is never gated on the paid tier") |
| `test/v63-encrypted-backup.mjs` | 22/22 |
| `test/overflow-scan.mjs` | 3 overflows, 320px Home, **pre-existing** |

The three `overflow-scan` failures are all the same `"10:00 AM"` element on Home at 320px, nowhere
near this diff, and `outputs/PM-app-v88.md:146` already records them as *"proven pre-existing against
app-v87's published file"*. Not a v89 regression; still outstanding.

---

## A NOTE ON THE WORKING TREE (read before reproducing anything)

While I was auditing, **another worker was editing the working tree**, so `http://127.0.0.1:8899`
was not serving `c692f8a` for part of the session. Observed, in sequence: `test/v89-everything-free.mjs`
with check 7.1 forced to `false` (a falsification in flight, later reverted); a 59-line improvement
to `release_check.sh` that makes the suites actually run against the clean export and adds
`test/v89-everything-free.mjs` to the list (this is M5's fix); `test/v76-empty-window-render.mjs`
gaining `FALSIFY_BASE`; and **`index.html` itself** changing — "Export" → "Export data" (M3),
"nobody to ring" → "no one to call" (M4), "reports" → "the reports screens", and the changelog's
"If you lose your phone, your records come back" → "If you saved a backup file, your records come
back onto a new phone" (M1).

**I have not audited any of that.** It is uncommitted, it is not in `c692f8a`, and it does not touch
B1 or B2. Everything above was re-verified against a `git archive` export of the commit on port
8890. If those edits are committed, this audit needs a delta pass over them — in particular the
index.html copy changes, which are caregiver-facing strings nobody has yet read in a rendered page.

I did not modify any tracked file.

---

## NOT CHECKED — stated so nobody assumes otherwise

* **iOS / Safari rendering.** Chromium only in this sandbox. Standing exemption on every release.
* **The native Capacitor path.** `nativeShareFile()` was exercised only through its browser
  fallback. Whether the report reaches a real Android share sheet is untested here.
* **Real purchases.** `TEST_MODE` simulated only. No Play Billing or App Store path exists yet.
* **The sync backend**, `capacitor.config.ts`, `package.json`, `.github/workflows/`.
* **`sw.js` beyond the CACHE constant.**
* Suites not run, for time: `v76-properties-equivalence`, `v76-empty-window-render`, `v79-*`,
  `v80-*`, `v81-*`, `v82-*`, `v83-*`, `v85-*`, `v86-*`, `v87-*`, `v88-*`.
* **Whether a real person can complete the B1 journey anyway.** I proved the named path is missing;
  I did not measure how long it takes someone to find the working one.
* The three pre-existing 320px Home overflows — confirmed pre-existing, not diagnosed.

---

## IF ONLY ONE THING IS FIXED

**B1.** Everything else on this list costs a reader a few seconds of confusion or costs the business
a mispriced card. B1 costs someone their records, in the one situation the topic exists for, on a
page this release specifically promised had been made honest.
