AUDITED-COMMIT: 17391dd
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v81, round 9 (delta: `17391dd` over `b19e390`)

## The headline, in plain words

**Round 8's block is closed for the five strings round 8 measured, and I could not reopen any of
them. But the maximum is still counted whenever it is written the way a pharmacy actually writes
it — with the word "tablets" after the number. `5/325 mg q4-6h prn max 8 tabs daily` stores EIGHT
TABLETS PER DOSE. With a six-a-day limit the card's only dose button comes up reading
`· over limit` BEFORE A SINGLE DOSE HAS BEEN GIVEN, and the disclosure does not fire, because a
dose carrying a `pills` number is by definition not an uncountable one. That is round 8's harm,
unchanged, reached through a different string.**

The whitelist closes the shapes where the invented number is followed by a *non*-noun (`q6h`,
`#30`, `max 8 per day`). It cannot close the shapes where the invented number is followed by the
noun, and a daily maximum almost always is: *max 8 tabs/day*, *up to 6 tabs per day*, *no more
than 12 tablets in 24 hours*, *dispense 30 tablets*, *#30 tablets*. All five count. The commit
message and the README row both state that "a maximum" counts nothing. Measured on the shipping
parser, that sentence is false.

**Everything else in the round holds and I re-measured rather than read it.** 184/184, 481/481
across twelve suites (the totals sum to exactly 481), 48 unique mutants across seven FALSIFY files,
Rule 0 27/27. The fractions do evaluate before the new gate, so `1/2 tab BID` still counts 0.5. The
v45 leading-number behaviour is genuinely untouched. Nothing threw anywhere.

**The fix is again small and again in one function.** It is not another noun.

---

# BLOCKS

## BLOCK 1 — a daily maximum written with its noun is counted as the per-dose amount, and the card locks at zero doses *(HIGH)*

### Measured through the shipping parser (`window.__doseTest.parseDoseOptions`)

    "5/325 mg q4-6h prn max 8 tabs daily"          -> pills: 8
    "5/325 mg q6h max 8 tabs/day"                  -> pills: 8
    "5/325 mg up to 6 tabs per day"                -> pills: 6
    "5/325 mg no more than 12 tablets in 24 hours" -> pills: 12
    "5/325 mg #30 tablets"                         -> pills: 30
    "5/325 mg dispense 30 tablets"                 -> pills: 30
    "5/325 mg q6h 3 doses remaining"               -> pills: 3

On `3854df3` (before round 9) every one of these carried no count at all and the limit was
disclosed as not applied. `parseDoseOptions` is what the editor calls on save (index.html 7144), so
this is reachable from the Add-medication form alone — no import, no legacy config.

### Measured on the screen, 390×900, clock frozen at 10:00, zero doses logged

Config seeded and re-read through `migrateDoseLabels`, which re-parses every stored label with the
same `parseDoseOptions` — the mechanism the release's own suite section 3f relies on.

| dose typed | limit | the card's only dose button, at ZERO doses | notice |
|---|---|---|---|
| `5/325 mg q4-6h prn max 8 tabs daily` | 6 pills | **`5/325 mg q4-6h prn max 8 tabs daily · over limit`** | none |
| `5/325 mg q6h max 8 tabs/day` | 4 pills | **`5/325 mg q6h max 8 tabs/day · over limit`** | none |
| `5/325 mg q6h` (round 8's string) | 4 pills | `5/325 mg q6h` — ordinary Log | fires, correctly |
| `5/325 mg 1 tablet` | 4 pills | `5/325 mg 1 tablet` — ordinary Log | none, correctly |

`doseBlocked` is `amt > (dc.max - dc.used)` — 8 > 6 − 0 — so the ordinary Log button never appears.
The medication can only be given through the red two-tap override, and every dose it writes is
stamped `override:true, overrideReason:'overLimit'` into History and into the export a caregiver
hands a nurse. That is the round-8 harm verbatim.

### Why this is a block and not a preference

1. **It is the same harm the previous round was refused for**, at the same severity, on a string at
   least as likely as the one that was measured. `MAX 8 TABLETS PER DAY` is how the cap is printed
   on a US label; `max 8 per day`, the form this round pinned in the suite, is the rarer of the two.
2. **There is no disclosure.** The release's whole argument is that the app never pretends a limit
   is holding when it is not. Here it pretends the opposite — that a limit is exceeded when nothing
   has been given.
3. **The claim that it is closed is in the record.** The commit message ("a maximum is not a dose
   either"), the new comment block in index.html ("Saying what a countable thing IS closes the
   class"), the suite row `why: 'a maximum is not a dose either'`, and the README row published to
   Aaron all state that a maximum counts nothing. For the ordinary written form it counts.
4. **The suite cannot see it.** Every new row puts the maximum in the noun-less form. There is no
   row anywhere in which a noun-qualified number after a ratio is NOT the amount — which is the
   round-8 finding one level up: the suite was extended along the axis of the last block, not along
   the axis the new rule opened.

### The fix *(S)*

The missing test is not *what follows the number*, it is *what stands between the strength and it*.
Suggested shape, which keeps every row this round pinned green: after a ratio, count a
noun-qualified number only when the text between the end of the ratio and that number contains **no
other digit and no word**, allowing exactly one exception — an immediately preceding range
(`\d+\s*(?:-|to)\s*`), which is what makes `7.5/325 mg 1-2 tabs` count 2.

Checked by hand against the pinned rows: `5/325 mg (1 tablet)` → 1 ✓ · `5/325 mg 2 tablets every 6
hours` → 2 ✓ · `5/325 mg 1 patch` → 1 ✓ · `5/325 mg (2 capsules)` → 2 ✓ · `7.5/325 mg 1-2 tabs` →
2 ✓ · every string in the table above → no count, and the disclosure fires ✓.

### The suite

Add, each asserting **no `pills`**: `5/325 mg q6h max 8 tabs/day`, `5/325 mg up to 6 tabs per day`,
`5/325 mg no more than 12 tablets in 24 hours`, `5/325 mg #30 tablets`. Add one mutant — *"a
noun-qualified number past a ratio is counted wherever it appears"* — which must go red on all
four. And extend the end-to-end case rather than adding a second one: it currently seeds
`5/325 mg q6h` and asserts no override button at zero doses; seed
`5/325 mg q4-6h prn max 8 tabs daily` beside it and assert the same thing. That single row is what
this block would have failed on.

### Name the seat

**The builder's falsification duty.** M46–M49 all mutate the new rule *towards* the behaviour of
the previous two rounds. None asks what the new rule now admits. Round 8 named this exact miss —
*"a generalisation is exactly the change where the new cases are the ones to write down"* — and the
answering round narrowed the generalisation without writing down what the narrowed rule still lets
through.

---

# RECORDED — not blocking, for the backlog

1. **`COUNTABLE_NOUN` is case-sensitive, and pharmacy labels are printed in capitals.** The regex
   carries no `i` flag. Measured: `5/325 mg 1 tablet` → 1, `5/325 mg 1 Tablet` → **no count**,
   `5/325 mg 1 ML` → **no count**. On the screen the capitalised one correctly shows *"This amount
   is not counted toward the daily limit of 4 pills…"*, so this is the disclosed direction and not
   a block — but a caregiver who capitalises loses the pill limit entirely, and `ml|mL` being the
   one pair spelled both ways shows case was thought about for one entry and missed for the other
   twenty-five. *Fix (S): add `i` and drop the duplicate spellings.* No suite row uses a capital,
   and no mutant would die if `i` were added, so the board cannot currently tell. **Seat: the
   builder.**

2. **A claim in the commit message is false, and the inconsistency behind it is real.** The message
   justifies `7.5/325 mg 1-2 tabs` → 2 with *"it matches what the app already does for a bare
   `1-2 tablets`"*. Measured: bare `1-2 tabs` → **1**, bare `1 to 2 tablets` → **1**. The same
   medication written two ways counts 1 or 2 depending on whether a strength precedes it — a factor
   of two on a ceiling, in opposite directions of safety. The bare behaviour is pre-existing v45 and
   unchanged by this round; only the justification is new. *Suggested (S): correct the sentence, and
   decide the range convention once for both.* **Seat: the Voice.**

3. **The README row published to Aaron repeats the maximum claim** — *"An interval, a quantity
   dispensed and a maximum are none of those, so they count nothing and the app says the limit is
   not being applied, which is true."* The last four words are the part that is not. This is the
   copy-is-false shape the Voice exists for; it is developer-facing, not caregiver-facing, which is
   the only reason it is recorded rather than blocking. It must be rewritten with the fix for
   BLOCK 1, not separately. **Seat: the Voice.**

4. **Real units that are not on the whitelist lose their count after a ratio**: `tsp`, `teaspoon`,
   `vial`, `pen`, `unit`, `supp`/`suppository`, `sachet`, `scoop`, `ampule`. Measured — e.g.
   `5/325 mg 2 units` → no count, while a leading `8 units` still counts 8 (pinned in section 4).
   Every one of these is disclosed on the card and in the confirmation, so the app is honest about
   it; I do not think any of them is a harm and I would not widen the list to chase them. Recorded
   only so a later round does not discover the asymmetry and think it is new. `tablespoons` and
   `dropperfuls` losing their count is deliberate and correct — the word boundary works.

5. **Round 8's RECORDED items 1–3 are unchanged by this round** (Confirm below the fold on a large
   batch; "This amount" naming an amount other than the one being logged; `2 mg/kg` and `5 mg/mL`
   setting `pills` from the mg number). Not re-audited, not re-opened.

---

# VERIFIED THIS ROUND — do not re-do in round 10

- **Round 8's BLOCK 1 is genuinely closed.** All seven of its measured strings now carry no count:
  `5/325 mg q6h`, `5/325 mg every 6 hours`, `10/325 mg q8h`, `5/325 mg q4-6h`,
  `5/325 mg (max 8 per day)`, `5/325mg #30`, `7.5/325 mg 1-2 tabs` (now 2, the cautious direction).
- **Fractions evaluate before the new gate**, so `sawRatio` is not set by a proper fraction:
  `1/2 tab BID` → 0.5, `1/2 tablet q6h` → 0.5, `1/3 tablet 2 tabs` → 0.333…, `5/325 mg 0.5 tablet`
  → 0.5. The interaction the brief asked about is sound.
- **The v45 leading-number behaviour is untouched**, measured rather than argued: `1 patch` → 1,
  `2 sprays` → 2, `1 tsp` → 1, `5 mL BID` → 5, `2 vials` → 2, `1 unit` → 1, `1 sachet` → 1,
  `2 scoops` → 2. M48 covers the gate's removal.
- **The disclosure is not noisier than it should be.** An mg-only limit on the same medication says
  nothing (it counts the mg fine); a medication with no limit says nothing; an ordinary countable
  tablet with a tablet limit says nothing — all three re-measured, plus `5/325 mg 1 tablet` silent
  on screen.
- **Every number in the commit message and the README.** `test/v81-dose-parser.mjs` re-run:
  **184/184**. The twelve totals in `outputs/SUITES-app-v81.txt` sum to exactly **481** across
  **twelve** suites. **48** unique mutant ids across seven FALSIFY files (M1–M49, M36 unused).
  `test/v75-no-other-patient.mjs` **27/27**.
- **Rule 0**: the diff touches a regex, comments, tests and one README row. No name, no pronoun
  about a patient, no dose or ceiling from one care plan, no new branch on a medication id. The
  README's *"thrown her out of the field mid-word"* is developer-facing prose about a text cursor,
  pre-existing in the row and not app copy.
- **Nothing threw** in any run, at 390×900 or through the hook.

## What round 10 has to do

One function, one added condition, four suite rows, one mutant, and the two sentences in the commit
message and README that say a maximum counts nothing. Nothing else in the round needs to move.
