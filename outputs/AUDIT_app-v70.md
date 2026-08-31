AUDITED-COMMIT: 1da23de
VERDICT: SHIP

# Zero Day Audit — ChemoWell app-v70 (fifth pass)

Supersedes the audits of `f0c74ca`, `095b56d`, `07e6d39` and `701bfbc`, all of which refused.
Auditor: Zero Day Auditor · 2026-08-31.

## The headline

**I attacked this for the fifth time and could not find a single thing a caregiver would experience.
Every fault I found this round is a hypothetical future regression that the harness would not
catch — not a defect in the build.** That is a different kind of finding from the previous four
rounds, and it changes the verdict.

The sixth false sentence is gone and the fault behind it is gone with it. The scanner no longer
guesses at code shape: it extracts string literals properly and scopes inside their contents, so the
class of hiding place that concealed `'…and what pauses meanwhile'` through four audits no longer
exists. I re-derived the numbers independently rather than taking them: **40 sentences scoped in and
reviewed, all 40 on the allow-list, and I read all 40 against the code myself. None is untrue.**

I also checked the thing I was most worried about — that the allow-list could become a rubber stamp
if the code moved underneath it. It cannot, at least not for the property that matters. All six
"a window that OPENED during the stay" sentences rest on one call site. I changed
`inpatientCoversMoment(win.ws)` to judge the window's close instead of its opening, which makes all
six sentences false without touching a word of prose, and `v67-inpatient-window.mjs` went red
(**8/10**). The load-bearing claim is guarded, just not by this gate.

---

## Why this is SHIP and the previous four were not

Each earlier refusal rested on something a caregiver would actually read or hit:

- Pass 1 — the In-Patient screen told the reader logging was paused. Live, false, on screen.
- Pass 4 — the **Hospital stays** Help blurb said "what pauses meanwhile". Live, false, the first
  line someone reads when they open Help to find out what a stay does.

This pass has no equivalent. I went looking for one specifically: I extracted every live sentence
the scanner **discards** — the 54 that SCOPE matches and NARROW drops — and read all of them. They
are identifiers, screen labels and true navigational statements ("A banner appears on Home showing
which day of the stay you're on", "The stay closes and moves into In-Patient History with its
length"). **Not one is false.** The hole is real; nothing is currently in it.

So the remaining faults are all of the form "if someone later broke X, no gate would notice". Those
are worth writing down, and I have. They are not worth a sixth round, and I agree with your framing:
a correct fix with a good-enough gate and a written list of its holes beats another cycle.

## The gate's remaining holes, written down

All five below were run against the committed suite from scratch copies outside the repo, each
verified applied by grep first. Three were additionally written with a neutrally-named helper so
that the source-level smoke test — which the file itself correctly labels as *not* the ground
truth — could not see them either. **All five leave the suite reporting `all checks passed`.**

Every one of them evades the gate the same way: **by acting on a dose path the fixture never walks,
or on a field the check never reads.** That is a coverage boundary, and it is enumerable.

| # | What I broke | Route or field | Suite |
|---|---|---|---|
| N1 | *"While a stay is open ChemoWell stops recording what you give her"* on the In-Patient screen | a false claim using no NARROW word | all checks passed |
| C1 | backfilling a missed dose from History is a silent no-op during a stay (`logMissedDose`) | a logging route the fixture never uses | all checks passed |
| C2b | the override / "log it anyway" path is dead during a stay (`opts.force`) | a logging route the fixture never uses | all checks passed |
| D1b | the dose is recorded on the right day, with `dose` and `mg` discarded | a field the check never reads | all checks passed |
| D2b | every dose during a stay is stamped 00:01 — right day, wrong hour | a field the check never reads | all checks passed |

**N1** is the answer to your (a): `NARROW` is the last filter that can drop a scoped sentence, and a
claim can describe blocked logging in words that never say log, dose, medication, card, button,
track, miss, restrict, lock, pause, block or available. *"Stops recording what you give her"* does
exactly that. Cheapest fix: since the extractor now yields clean prose rather than code fragments,
NARROW is doing much less work than it was — it can be relaxed to "any scoped sentence of more than
a few words", with colour values and identifiers excluded by length and shape instead of vocabulary.

**C1 and C2b** are the answer to your (c). Both are paths a caregiver plausibly uses *during* a stay:
"Took later" on a missed dose, and "log it anyway" when a gap timer or limit has the card locked.

**D1b and D2b** are the answer to your (d). The timestamp check asserts day-offset zero, which
correctly kills my X6 from last round, but a dose can be corrupted without moving off today: strip
what was given, or move it to the wrong hour — which also changes which time bucket it lands in and
whether it covers its window. Asserting the stored row's `dose` label and that its `ts` is within a
few minutes of the click closes both, and costs two lines.

## What I verified rather than accepted

- **The six sentences fix, and the fault behind it.** `pauses meanwhile` — 0 occurrences. The blurb
  reads *"and what changes while one is open"*. `CODEY` is gone; literal extraction replaces it.
- **The "never" fix.** `ip-undo` reads *"Logging is not blocked by a stay"*. Thank you for taking
  that one — it was the difference between an allow-list that means "true" and one that means
  "reviewed once".
- **The fixture.** Three medications, shapes that survive `normalizeMedication()` — `type: 'gap'`,
  `gapHours: 0`, real dose objects with `.label`. The `prn`/bare-string problem is gone.
- **The behavioural coverage.** Standalone card logged twice, grouped `Take all` asserted per
  medication rather than by total, and each dose checked for today. My X4, X5 and X6 from the fourth
  pass are all genuinely dead against it.
- **The allow-list, sentence by sentence.** All 40 true. One completeness note, unchanged and not a
  falsehood: `inpatientCoversMoment()` also suppresses a whole calendar day for the legacy
  `inpatient` day-marker, and no sentence describes that.

## Suite runs — real numbers from this tree, this session

Every figure is from a run I executed. I took none of them on trust.

- `test/v70-stay-does-not-lock.mjs` — all green, 40 sentences reviewed.
- `test/v69-treatment-date-help.mjs` — **27/27**.
- `test/v70-remove-one-date.mjs` — **16/16**. `test/v70-remove-one-date-browser.mjs` — all green.
- `test/v67-inpatient-window.mjs` — **10/10** · `test/v67-medflag-backfill.mjs` — **4/4** ·
  `test/v68-treatment-clamp.mjs` — **PASS 28 FAIL 0**.
- `test/overflow-scan.mjs` — **170 of 170 scanned, 0 overflowing, CLEAN, exit 0.**

## Recommended follow-ups — for their own release, not this one

None of these blocks the ship. In severity order:

1. Assert the stored row's `dose` label and that its `ts` is within minutes of the click (D1b, D2b).
2. Drive `logMissedDose` and the `opts.force` override in the behavioural check (C1, C2b).
3. Relax `NARROW` so a scoped sentence cannot be dropped for its vocabulary (N1).
4. Note in `v70-stay-does-not-lock.mjs` that the "window that OPENED" property its prose depends on
   is guarded by `v67-inpatient-window.mjs`, so a future edit does not delete both halves believing
   one covers the other.

## A note on the four rounds

The app changes in this release have been correct since the first pass. Every refusal was about the
prose describing them or the machinery checking them — which is exactly where this project's
documented failures live, so I do not think the rounds were wasted. But the returns are clearly
diminishing, the live-defect surface is now empty, and the remaining holes are written down above
where the next person can find them. Ship it.

## Audit hygiene

All sabotage lived under the session scratchpad, outside the repository, applied with `--file`. Each
was verified applied by grep before any conclusion was drawn from a green. Nothing was committed or
pushed and `/home/user/care-tracker` was not touched.
