AUDITED-COMMIT: 23aedd6
VERDICT: DO NOT SHIP

# Zero Day Audit — app-v68 head (d50e60b..23aedd6)

STATUS: COMPLETE.

Scope: the single commit 23aedd6, claiming to close the two blockers from
outputs/AUDIT_app-v68-remediation.md. Files touched: index.html (7 lines of CSS),
release_check.sh (+26/-8), test/overflow-scan.mjs (+48/-7), and a one-line VERDICT header
added to three older reports.

## Headline

**The screen-layout fix is real and I could not break it. The release gate is not fixed:
two two-line files still clear the entire thing — and they do it while four real reports
sitting right beside them all say DO NOT SHIP, which the gate prints out and then ignores.**
The previous bypass took three lines. It now takes two.

---

## Suites, run by me at 23aedd6

    test/v67-chemo-offset.mjs        26/26 PASS   exit 0
    test/v67-inpatient-window.mjs    10/10 PASS   exit 0
    test/v67-medflag-backfill.mjs      4/4 PASS   exit 0
    test/v68-treatment-clamp.mjs     28/28 PASS   exit 0
    test/overflow-scan.mjs           60 combinations, 0 problems, CLEAN, exit 0  (run twice,
                                     identical; ~4 min each)

`./release_check.sh` exits **1**, correctly, saying: no current chain report for app-v68 that
says VERDICT: SHIP. It lists all five reports it found and gives the reason for each — every one
of them says DO NOT SHIP. That is the right answer for the right reason. Every other check in the
script passes; I confirmed that by satisfying the chain gate in a throwaway clone and watching the
script run to "Release check passed" with no other complaint.

---

# CLAIM-BY-CLAIM

## Claim 1 — the nav label no longer spills between 321px and 345px. CLOSED. Genuinely.

I did not trust the ten sampled widths. I measured the rendered width of all five nav labels
against their own grid cell at **every whole pixel from 300px to 500px** — 201 widths, 1005
measurements.

- From 308px upward, every label fits at every width. The tightest point in the whole range is
  "Symptoms" at 325px with 3.8px to spare, and at 330px with 4.8px. The band the last audit found
  broken is comfortably clear.
- Nothing wraps to two lines anywhere in the range.
- The smallest the text ever gets is 9.50px, which is the same floor the previous CSS had. It
  never goes below that, so nothing became less legible than it already was.

I then put the **previous release's CSS** back and re-ran the scan: it goes RED at 330px,
"Symptoms wider than the box it sits in by 3px". So the last audit's blocker was real, and the two
new widths added to the scan's list genuinely catch it. That is a check that can fail, and I made
it fail.

I also removed the whole `.navlabel` rule: RED at 320px, 8px spill. The rule as a whole is guarded.

**What I could not break:** browser zoom does not make this worse — zooming in simply behaves like
a narrower screen, and I swept every narrower screen. `env(safe-area-inset)` does not interact with
it at all: the bottom nav applies only the *bottom* inset, never the left or right ones, so the
notch never narrows the nav while `vw` stays wide. iPhone text-size settings scale the old fixed
sizes and the new ones identically.

## Claim 2 — the chain gate. **NOT CLOSED. See BLOCKER-1.**

Two of the three requested repairs landed and both work. The third — the one that mattered — did not.

## Claim 3 — a blank screen no longer counts as scanned. HALF CLOSED. See MAJOR-A.

## Claim 4 — dropdowns are now covered. **The rule cannot fire in this app. See MAJOR-B.**

## Claim 5 — ellipsis now needs a real clipping overflow. CLOSED, verified both ways.

A box with `text-overflow:ellipsis` and no clipping, holding text 108px too wide: **flagged, exit 1.**
The same box with `overflow:hidden` added: **not flagged, exit 0.** Correct in both directions, no
false positive. This one is simply right.

---

# FINDINGS

## BLOCKER-1 — two two-line files still clear the entire release gate

In a throwaway clone at this exact commit I created these two files and nothing else:

    outputs/AUDIT_app-v68-zz.md   ->   AUDITED-COMMIT: <the head sha>
                                       VERDICT: SHIP
    outputs/PM_app-v68-zz.md      ->   AUDITED-COMMIT: <the head sha>
                                       VERDICT: SHIP

`./release_check.sh` printed **"Release check passed."** and exited 0.

In the same run it printed, immediately above, all four real reports and the words "says DO NOT
SHIP" beside each one — and shipped anyway. The gate treats a DO NOT SHIP verdict as merely "not
the report that clears this release", not as a stop. **A report that says do not ship, about this
exact code, should be an absolute block. It is not.**

The last audit asked for three specific repairs. Two landed:

- The audited commit must now be an ancestor of HEAD. I made a side commit off HEAD~1, put its sha
  in a report — **correctly refused**, "not in this branch's history". Real fix, and it can fail.
- A DO NOT SHIP verdict at the top of the file is read and refuses the report. Real fix.

The third did not land: the last audit asked that the AUDITED-COMMIT line be required near the top
of the file. It is still read from anywhere. Both consequences are still live, and I re-proved both:

- **A report whose first two lines quote the header of the report it is answering, and which then
  declares its own older commit and its own DO NOT SHIP verdict, passes the gate.** Exit 0.
- **A report with 900 lines of prose and the header buried at the bottom passes.** Exit 0.

And a new hole this change introduced:

- **`VERDICT: SHIPPING SOON — three blockers open` is read as SHIP.** So is
  `VERDICT: SHIP, PROBABLY NOT`. So is `VERDICT: SHIPWRECK — DO NOT SHIP`. The pattern matches the
  first four letters and stops looking. Anything beginning "SHIP" ships. Meanwhile
  `VERDICT: **DO NOT SHIP**` (bolded, as a person would write it) and `VERDICT: DO  NOT  SHIP`
  (two spaces) are read as *no verdict at all* — those fail closed, which is the safe direction,
  but it shows how narrow the matching is.

Minimum fix: require the AUDITED-COMMIT and VERDICT lines within the first ~10 lines of the file;
anchor the verdict to the end of the line so "SHIPPING SOON" cannot pass; and make **any** report
naming an ancestor of HEAD and saying DO NOT SHIP fail the release outright rather than being
listed and ignored.

Beyond that, no string check can prove a person read anything. If that is the goal, the gate needs
something a stub cannot fake — a minimum length, a required section naming what was falsified, or a
countersignature. As it stands, the gate proves a file exists with the right two lines in it.

## MAJOR-A — a broken screen with one sentence on it still counts as fully scanned and clean

The new rule is "more than 80 characters of non-navigation text". It does catch a completely blank
screen: I made Reports, In-Patient and Symptoms render nothing at all, and the scan correctly said
**COULD NOT REACH x3, exit 1**. That is a real improvement and I proved it.

But the threshold is too low to mean much. I made those same three screens render **one line of
83 characters** — "Loading your information. If this message stays, close the app and open it again"
— and nothing else. Three of the five tabs are now stripped to a single sentence, and the scan
reports **60 combinations, 0 problems, CLEAN, exit 0.**

Eighty characters is roughly one sentence. Every real screen in this app carries far more: the
thinnest is In-Patient at 181 characters even for a brand-new user with no data at all. So there is
plenty of room to raise the bar.

**The other direction is fine.** I looked for a legitimately sparse screen that would now fail
falsely and could not find one — even with no medications and no entries saved, the thinnest screen
is more than twice the threshold. So raising it is safe.

Two smaller notes on the same check: it subtracts only the *first* `<nav>` on the page, and the
medication editor is not covered by it at all — it is still cleared by the presence of a hook, so an
editor that renders its wrapper and nothing inside would pass.

## MAJOR-B — the new dropdown rule cannot fire in this app, and the dropdowns really are cut off

The new rule asks: is the `<select>` box wider than the column it sits in? The app's own stylesheet
says `select{max-width:100%}`, which makes that impossible by construction. I measured all three
dropdowns in the app (they are all in the medication editor; there are no others anywhere): each is
**exactly** as wide as its column, over by 0.0px, at every width.

I proved the rule is not merely asleep — I removed `max-width:100%` and gave selects a minimum
width, and the scan went **RED, 28 problems, exit 1**. The mechanism works. It just guards something
the CSS already guarantees.

Meanwhile the defect it was written for is present right now, on the most common phone in the world,
and the scan says clean. Measuring the option text against the space inside the control:

    360px phone, medication-type dropdown
      shows: "Scheduled — remind me at specific times"          CUT OFF by 19px
      option: "As needed — wait a set number of hours..."       CUT OFF by 116px
    360px phone, dose-schedule dropdown
      option: "Every few days (for example, every other day)"   CUT OFF by 51px
    320px phone, medication-type dropdown
      shows: "Scheduled — remind me at specific times"          CUT OFF by 59px

This is the exact case the first audit filed as MINOR-9 and the exact case this rule's own comment
names ("Every few days (for example, every other day)"). It is still invisible. The comment claims
coverage the code does not have — the third time in three releases that this same claim has been
made about dropdowns and been wrong.

Not a blocker on its own: the text is only clipped in the closed control, and tapping it opens the
native picker which shows every option in full. But the *gate* claiming to cover it is the problem.
Fix: measure the widest option's text against the control's inner width, which takes a canvas text
measurement — a Range genuinely cannot do it, because a closed select lays out none of its options.

## MAJOR-C — the false claim in the version history is still there, untouched

The last audit found the app-v68 row of README.md making a claim that is not true, and found the
correction filed under a different section. **This commit does not touch README.md at all.** Line 14
still reads, unqualified, that the treatment window was "string-blind" and that "every window typed
in silently collapsed back to 1/1". The last auditor checked that independently and it is false.

That row is the one `release_check.sh` itself reads, and the script's own words for a wrong entry
are "worse than no entry, because it will be believed."

Also still stale, and now doubly so: line 91 describes the fix as "a smaller nav label under 360px".
It was already wrong (it became 320px). After this commit there is no breakpoint at all.

## MINOR-D — the letter-spacing half of the nav rule is not guarded by anything

Deleting `letter-spacing:-0.02em` and leaving the size rule alone leaves the scan **CLEAN at 320,
330, 345 and 360px**. Nothing tests it.

It is doing real work: without it, "Symptoms" at the 320px floor has only **1.2px** of slack, under
the scan's own 1.5px tolerance. With it, 2.8px. On iPhone the system font's metrics differ from the
Chromium the scan measures in, and 1.2px is about 2% of the label — a difference that size would eat
it. So the declaration is correct and should stay; it simply has no check behind it. This is the same
finding as the last audit's MAJOR-A, carried forward in a new shape.

## MINOR-E — the design size is no longer reached on any common phone, and the comment says it is

The new comment says clamp "holds it at the 11px design size on any normal phone". Measured, it does
not. The label only reaches 11px at 387px and above. On the three most common phone widths it is:

    360px (most common Android in the world)   10.16px
    375px (iPhone SE 2/3, 8)                   10.63px
    384px (Galaxy S22/S23)                     10.78px

So nav labels get about 8% smaller for most users, which is a deliberate-looking visual change
nobody has signed off, described by a comment that says the opposite. The sizes are all still at or
above the old 9.5px floor, so nothing is newly illegible — but the comment should say what the code
does.

## MINOR-F — below 308px the label still spills, unchanged from before

At 300px "Symptoms" spills its cell by 1.3px; the spill clears by 308px. This is identical to the
old CSS's behaviour there and 320px is the app's stated floor, so it is not a regression. Recorded
so nobody assumes the clamp covers every width.

## MINOR-G — the gate now hides drift behind a verdict

The verdict is checked before the staleness check, so a report that both says DO NOT SHIP *and* is
out of date reports only the verdict. You lose the information that it was also stale. Cosmetic, but
it is the kind of thing that makes the next reader trust a report they should not.

## MINOR-H — the silent-exit hole in release_check.sh is still open (pre-existing)

Re-tested at this commit: change `const APP_VERSION = 'app-v68';` to double quotes — a legal,
innocuous edit — and `./release_check.sh` **exits 1 having printed nothing about why**. The chain
gate never runs. Untouched by this commit and by the two before it, fail-closed, but silent, which
the script itself calls the worst outcome.

## MINOR-I — the dead condition in the scanner is still dead

    if (!parentClips && cs.whiteSpace !== 'normal' || !parentClips)

still reduces to `if (!parentClips)`. Carried forward from the last audit, untouched.

## NOTE-J — the start-up diagnostic hazard: **I agree it is safe to defer, with one condition**

`cwLogAdd()` stamps entries with `APP_VERSION`, which is declared about 6000 lines later, and it is
the module-init error handler. So a crash during start-up records nothing, in exactly the window the
log exists for. The last auditor proved this by experiment and I have no reason to doubt it.

Deferring is defensible: this commit does not touch it, and the scan's console gate now catches
start-up errors in CI, which is where the original wipe was actually found. **But the condition
matters:** that console gate only exists inside the test run. On a patient's actual phone, a
start-up failure still leaves no trace at all. The fix is one line — move the version declaration
above the logger, or read it lazily. It should go in the next release and not slip again; it has now
been logged and deferred twice.

---

# What I tried to break and could NOT

- **The nav label, at every whole pixel from 300 to 500.** No spill from 308px up, no wrapping, no
  size below the old 9.5px floor.
- **The nav label under zoom and under a notch.** Zoom behaves as a narrower screen, which I swept;
  the nav applies no left/right safe-area inset, so there is nothing for `vw` to disagree with.
- **The ellipsis rule, both directions.** Ellipsis without clipping is caught; ellipsis with
  clipping is correctly left alone.
- **The blank-screen rule against a truly blank screen.** Three dead tabs, caught, exit 1.
- **The ancestor rule.** A side commit off HEAD~1 is refused by name.
- **The DO NOT SHIP rule when the verdict is the first one in the file.** Refused.
- **A verdict in a markdown blockquote (`> VERDICT: SHIP`).** Correctly ignored; the pattern needs
  column zero.
- **The select rule's mechanism.** Breaking the select CSS turns it red across every width.
- **A false failure from the 80-character rule.** No legitimate screen comes near it, even empty.
- **The four unit suites.** Unchanged by this commit, all green, run before and after all sabotage.
- **The `h()` null-attribute trap.** This commit adds no `h()` attributes; index.html changes are
  seven lines of CSS.
- **Version literals and `document.body.textContent`.** No new assertion pins a version string. The
  scan uses `innerText`, not `textContent`, and I confirmed empirically it is not picking up the
  file's own source: a full Home screen measures 994 characters, not 800,000.

# Tree state

`git status` is clean apart from this report:

    ?? outputs/AUDIT_app-v68-head.md

index.html, release_check.sh, test/ and README.md are byte-identical to 23aedd6. All sabotage was
done on copies under /tmp via the scan's `--file` flag, or in a throwaway clone.

---

# VERDICT

**DO NOT SHIP.**

The visible product change — the nav labels — is the best-built thing in this release. I attacked it
at 201 widths and could not make it fail, and the two widths added to the scan genuinely catch the
bug that was there before. Three of the five claims are honestly closed.

But the gate that decides whether anything ships is still openable with two lines of text, and it
now does so while printing four reports that say do not ship. That is the whole point of the gate,
and it is the second release in a row it has failed. And the dropdown rule added in this commit
cannot fire in this app while claiming in its own comment that it covers the exact case that is
broken on screen right now.

Required before ship:
1. **BLOCKER-1** — the header lines must be required near the top of the report; the verdict must
   match the whole line, not its first four letters; and any current report saying DO NOT SHIP must
   fail the release rather than be listed and ignored.
2. **MAJOR-A** — raise the blank-screen threshold well above one sentence (181 characters is the
   thinnest real screen, so there is room), and extend it to the medication editor.
3. **MAJOR-B** — either measure the option text properly, or delete the claim from the comment. A
   gate that says it covers something it cannot is the failure this whole release exists to fix.
4. **MAJOR-C** — correct the version-history row itself, in place, the way that row's own convention
   already does.
