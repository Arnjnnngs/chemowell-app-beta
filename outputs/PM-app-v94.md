AUDITED-COMMIT: 0c74ea397e82c0afb7bae8cbb3b5371ebea6502e
VERDICT: DO NOT SHIP

# Project Manager — ChemoWell app-v94

**DO NOT SHIP, and the reason is one thing only: `./release_check.sh` exits 1.** No audit has read
the bytes that would ship. The delta re-audit said SHIP at `ca48e31`, and `index.html` changed
after it — so the gate refuses the release and names exactly that. Raw output and exit code below.

**Nothing I found in the work itself is wrong.** The owner's bug is fixed on both surfaces and I
measured it; every finding from both audits is accounted for; the release mechanics are right; the
changelog is true and within Rule 0.9. The one defect is a process defect: **production code moved
after the last audit signed off, and the rule that catches that has no size exception.** The remedy
is a short delta-3 audit pass against `0c74ea3`, not a rebuild.

I did not re-audit the code. Two independent audits did that. What follows is whether the process
ran, whether every finding landed somewhere, whether the deliverable is what the owner asked for,
and whether the mechanics are right.

## The tree as I measured it

| | measured | expected | |
|---|---|---|---|
| `git rev-parse HEAD` | `0c74ea397e82c0afb7bae8cbb3b5371ebea6502e` | `0c74ea39…` | matches |
| branch | `claude/caretracker-team-review-i83ik2` | same | matches |
| `index.html` md5 | `9dbb11ebb200ee5a7181942847feb25e` | same | matches |
| `sw.js` md5 | `8efcc1e7e7c55a22902057b722b5a58b` | same | matches |
| `APP_VERSION` (index.html:9842) | `app-v94` | — | — |
| `sw.js` CACHE (sw.js:1) | `chemowell-app-v94-1` | — | — |
| `git status --porcelain` | empty, before and after every run | clean | clean |
| `HEAD` vs `origin/claude/…-i83ik2` | identical sha | pushed | pushed |

I ran no `git checkout` and edited no application file, suite or corpus. The mutant sweep mutates
`index.html` in place and restores it; I took its md5 before and checked it after with `md5sum -c`
— `index.html: OK`, byte-identical, and `git status` clean. The only file I wrote is this report.

**`care-tracker` was not touched.** I did not modify a file in it, run anything against it, open
its live site, touch Firestore or port anything to or from it. I read only the notice that loads
automatically into every session, which is what that notice permits.

## The chain, stage by stage

| Stage | Artefact | Ran? |
|---|---|---|
| Enhancer (design-time) | `outputs/ENHANCER-app-v94.md` | Yes — before the build, on Home. Four proposals (E7–E10), **none built**, E7 recommended and queued in `REQUESTS.md`. An explicit "nothing this time" on E10. |
| Designer | `outputs/DESIGN-app-v94.md` | Yes. No layout, spacing, type, colour or control changed; it states that, then renders the two states this release makes more frequent anyway. Chromium-only exemption stated. |
| Builder write model | in the README row and the header comment at `index.html:2533` | Yes. Appends nothing, deletes nothing, and the tie-break (two-pass claim) is stated before the code. |
| Zero Day Audit 1 | `outputs/AUDIT-app-v94.md` | Yes — **DO NOT SHIP** at `0242928`: one BLOCK (the notification path) plus F1–F5. |
| Delta re-audit | `outputs/AUDIT-app-v94-delta2.md` | Yes — **SHIP** at `ca48e31`, with D1–D5 and one item marked NOT CLEARED (D4). |
| Delta-3 audit | **absent** | **No. This is the failure.** Three commits landed after the SHIP, one of them touching `index.html`. |
| PM | this file | Yes. |
| Mechanical gate | `./release_check.sh` | Yes — **exit 1**, stopped early. |

Both audits are substantial (19.7 KB and 22.9 KB), both measured rather than read, and the first
one's BLOCK was correct and load-bearing: it caught a release that fixed the screen and left the
phone ringing. That is the dropped-requirement shape, and the chain caught it. Credit where it is
due — the process worked right up to its last three commits.

## Finding-by-finding accounting

I walked both reports' findings against `BACKLOG.md`, `REQUESTS.md` and the file. **Every one is
accounted for. Nothing else went the way F3 and F4 went.**

### Audit 1

| # | Subject | Disposition | Evidence |
|---|---|---|---|
| **BLOCK 1** | The alarm plan still asked for a dose already given | **Fixed and measured** | `medWindowDueAt` now calls the shared walk. Mutant 8 restores the exact predicate and **dies on 6 checks** in my own sweep. |
| F1 | The app-v93 appointment fix had no check and no mutant | **Fixed and measured** | Mutant 11 restores the block and dies on *"SILENCING DOES NOT TOUCH THEIR APPOINTMENT ALARM"*; I saw both in my runs. |
| F2 | `status()` ran two different clocks | **Fixed** at `index.html:3103` (`atH = hourTs`). The rest of the class is **logged** as `BACKLOG` M46. | Mutant 12 is a declared hole pointing at M46. |
| F3 | An alarm with no `extra` survives every cancel path | **Logged — `BACKLOG` M47 (S)** | Was lost for a release; the delta audit caught that, and M47 says so in those words. |
| F4 | Suite fixtures use window shapes `deriveWindowEnds` cannot produce | **Logged — `BACKLOG` M48 (S)** | Same; M48 records the contiguous-geometry gap and what to add. |
| F5 | The "three answers" count was wrong in two places | **Fixed** | `index.html:2534` reads six with all six named; the README row corrects itself explicitly. |

### Delta re-audit

| # | Subject | Disposition | Evidence |
|---|---|---|---|
| D1 | The app-icon badge was claimed and **unfalsifiable** | **Fixed and measured** | Mutant 13 plants the fourth naive copy; the suite gained two app-icon checks at the 17:03 clock. In my sweep mutant 13 **dies** on *"a dose logged 15 minutes early takes it off the app icon"*. This was the right fix: the claim now has a gate behind it. |
| D2 | Two more mixed-clock sites | **Logged by name in M46** (`profileDueCount:1062`, `missedDosesFor:2860`); the `chemoRelativeWindows` half folded into **M45** | The audit's complaint was that a class cited as "about forty" is not a list; both sites are now named. |
| D3 | "30 checks" wrong in two documents | **Fixed** | README row and `REQUESTS.md` both read **35**; the suite is 35 (I ran it). See one leftover below. |
| D4 | F3 and F4 lost — **the NOT CLEARED item** | **Cleared** | M47 and M48 now exist, each naming that it was lost and why that matters under Rule 7. |
| D5 | `window.__v86Test` ungated and now drives the plugin cancel | **Logged — `BACKLOG` M49 (S, before store submission)** | |
| Optional #5 | `wi < 0` should fail safe | **Done** — and it is the commit that costs this release its gate pass. See below. |

**One leftover, non-blocking and worth one line in the next pass:** `release_check.sh:941` still
describes the suite as *"33 checks"*. That is a comment inside the gate script, not an assertion
and not patient-facing, and it was the document that was *right* when D3 was written — the suite
then grew to 35 underneath it. Same class as D3 and F5, third instance, cheapest possible fix.

Also minor: `DESIGN-app-v94.md` quotes the ring bullet in an earlier wording than shipped. The
substance is identical; the quote is stale, not false.

## Item 2 — the work added after the SHIP. This is the judgement that is mine.

The delta audit said SHIP at `ca48e31`. Three commits followed:

| Commit | What | Reads production code? |
|---|---|---|
| `1ea4da7` | Clears D1–D5: mutant 13, two app-icon checks, M47/M48/M49, the counts | Docs, suite, corpus — **and one line of `index.html`** |
| `3a1c0a1` | Mutant 8's anchor had gone stale; mutant 14 declared | Corpus only |
| `0c74ea3` | The corpus's final numbers in the README | Docs only |

I read the diff, not the messages. **`git diff ca48e31..HEAD -- index.html` is 14 lines and one of
them is code:**

```
-  if (wi < 0) return !coveredWindowFlags(d0, mine, [w])[0];
+  if (wi < 0) return true;
```

The rest is the comment explaining it.

**On the substance, this change is right, and I verified its safety claim myself rather than taking
it.** It is the delta audit's own recommendation #5, specified verbatim, for the reason the auditor
gave: judging an unknown window on its own is *more* permissive than the indexed path, because a
lone window is the last window and its late reach runs to midnight — so any dose that day would
cover it. On a medication tracker, hiding a dose that is still needed is the dangerous direction
and nagging is the annoying one. `return true` is the safe answer.

**And it is inert today.** I grepped every reference to `medWindowDueAt` and read each call site
rather than trusting the audit's table. Four shipping sites and one test hook, all of which iterate
or index `med.windows` raw, so `indexOf` always resolves and `wi < 0` is unreachable:

| line | caller | how it reaches the window |
|---|---|---|
| 1064 | `profileDueCount` — app-icon badge, drawer dot | `med.windows.forEach(w => …)` |
| 13404 | `dueRemindersAt` — reactive web notification | `med.windows.forEach(w => …)` |
| 13694 | `buildReminderPlan` — OS alarm | `(med.windows \|\| []).forEach(w => …)` |
| 14338 | `__v86Test.medWindowDue` | `((med.windows) \|\| [])[wi]` |

Mutant 14 reverses the fallback and nothing goes red — which is the honest, declared confirmation
that the branch is dead code today, and the corpus says so in its own comment rather than hiding it.

**So: is it within what the delta audit covered?** The change itself, yes — the auditor wrote the
line. **The shipping tree, no.** And that distinction is the whole point of the rule:

- A documentation correction after a SHIP is nothing. `0c74ea3` is that.
- A corpus repair after a SHIP is close to nothing, and `3a1c0a1` is actually a *credit* to this
  release: mutant 8 — the mutant for the defect this release exists to fix — had an anchor spanning
  the very line `1ea4da7` changed, so it silently **did not apply**. The builder caught that by
  running the sweep rather than reading it. That is exactly the failure mode the brief warned me
  about, and it was found and fixed before it reached me.
- **A change to production dose logic after a SHIP is a different thing**, and this is one, however
  small and however inert. `medWindowDueAt` is this release's central function. No auditor has read
  the file as it now stands. The gate's own words are the precedent: app-v68 shipped 67 unaudited
  lines of `index.html` because a report was *named* for the version.

**I am not waving this through on the grounds that I verified it myself.** I am the PM; I am not the
independent adversarial pass, and substituting my reading for the auditor's is precisely the
self-verification Hard Rule 5 forbids. A one-line fail-safe is also exactly the kind of change that
gets waved through, which is why the rule has no size exception.

**The remedy is small and specific:** one delta-3 Zero Day Audit pass against `0c74ea3`, scoped to
the 14-line diff, mutants 13 and 14, and the two new app-icon checks. The auditor already knows this
code and already specified this change. On its SHIP, the gate's only objection disappears and this
release can be offered to the owner.

## Release mechanics

| Item | Status |
|---|---|
| `APP_VERSION` moved | `app-v92` → **`app-v94`** vs `origin/main` ✔ |
| `sw.js` CACHE moved | `chemowell-app-v92-1` → **`chemowell-app-v94-1`** ✔ |
| Consistent with each other | both `v94` ✔ |
| `CHANGELOG` entry for this version | present, `index.html:9865` ✔ |
| Rule 0.9 size | title 5 words, 3 bullets, **61 words** total — under ~70 ✔ |
| Every statement true of the shipped file | ✔ — see below |
| README version-history row | present, and its figures match what I measured ✔ |
| Working tree clean, everything pushed | ✔ |

**The changelog's third bullet, which the brief asked me to check specifically** — *"The reminder
and the app-icon count do the same — logging early switches them off."* True on both halves, and
now falsifiable on both, which it was not when the delta audit wrote D1: the reminder half dies
under mutants 8, 9 and 10, the app-icon half under mutants 8 and 13. **One caveat worth the owner
knowing, not a defect:** `BACKLOG` M40 records that the native Android build has no badge plugin,
so on that build the app *icon* never carries a number and the visible counterpart is the count on
the menu button — which the same function drives, so the sentence is true there too, just about a
different pixel. The bullet is honest; the platform gap is logged.

**The README row's figures, each checked against what I measured, not against the row:** 35 checks
✔ (I ran it: 35/35), 14 mutants ✔, *"11 caught, 0 unexpected survivors, 0 stale anchors, 1
over-block control green, 2 declared holes"* ✔ — my sweep printed that line for line, holes 12 and
14. The row also states the corpus found two defects in itself, which matches `3a1c0a1`.

## What I re-ran, and what I took on trust

**Re-ran myself, in the repository, on this exact tree:**

| What | Result |
|---|---|
| Tree verification — sha, 2 md5s, 2 version strings, clean tree, push state | all match |
| `test/v94-window-coverage.mjs` | **35/35**, 0 failed |
| `falsify.sh` + `mutants-v94-coverage.sh`, all 14 | **11 caught, 0 unexpected survivors, 0 could not be measured, 0 stale anchors, 1 over-block control green, 2 known holes (12, 14)** |
| `test/v75-no-other-patient.mjs` | **29/29**, pronoun ratchet **32 found / 32 allowed**, all three debt ceilings at 0/0/0 |
| `medWindowDueAt` call-site audit — grep plus read of all five | `wi < 0` unreachable, independently confirmed |
| `index.html` md5 after the sweep (`md5sum -c`) | OK — restored byte-identical |
| Changelog word count, parsed from the array | 61 words, 3 bullets |
| Finding walk: both reports vs `BACKLOG.md` / `REQUESTS.md` | all accounted for |

**Taken on trust from the builder, and the gate stopped before it could confirm them** — this is
the honest cost of the gate failing early, and the delta-3 pass should let the gate run them:
`v93-profile-notifications` 27/27, `v85-profile-reminders` 43/43, `v92-pill-clearance`,
`v92-text-collisions`, `v84-whatsnew` 100/100, `v90-chart-axes` 162/162, `v89-everything-free`
75/75, `contrast-scan` 327/327, `overflow-scan` 171/171, both `v76-*`. All reported green by the
builder; none re-measured by me.

**No real device, no APK.** Nothing in this repository can test one, and every notification
measurement here — mine, the suite's and both audits' — goes through the shipped functions with a
stubbed Capacitor bridge.

## The deliverable against what the owner asked for

> *"I just logged my medication for the 5:00 round and it still shows me to log it."* (2026-11-06,
> logged at about 16:45) · *"Just build and fix. It all needs to be fixed regardless."* (2026-11-10)

**Fixed, on the surface he experienced and on the one he did not mention.** On his own fixture — one
17:00–21:00 window, one dose at 16:45 — the card stops asking, the ring agrees with it, the OS alarm
is dropped from the plan, the reactive notification does not fire, the app-icon count goes to zero,
and logging the dose cancels the already-armed alarm. Each of those is a named check in the suite I
ran, and each dies under a mutant I watched die.

**No scope drift upward.** The Enhancer proposed four improvements and **built none of them**; E7 is
queued in `REQUESTS.md` as "not built". No control was added, moved or removed, and the Designer
confirms no layout change. The adjacent work that did land is all either the reported bug's other
half (the ring, which was in his screenshot), the audit's BLOCK (the notification path), or an audit
finding inside a function this release already rewrote (F2's clock). The app-v93 appointment BLOCK
was carried here, which is the previous release's unfinished gate and squarely inside *"it all needs
to be fixed regardless."*

**No dropped requirement.** The brief's test — a release that fixes the screen and leaves the phone
ringing — is the exact thing the first audit refused, and the refusal held: the fix now reaches the
alarm, the reactive notification, the badge and the cancel-on-log path, with a mutant on each.

## The mechanical gate — raw output, verbatim

Run as `env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy ./release_check.sh`.

**Run 1, the diagnostic.** The gate will not report on anything until a PM artefact exists, so there
is no way to learn its objection without one already on disk. I wrote a substantive draft of this
file stating `VERDICT: SHIP` purely so my own verdict could not mask a different failure, ran the
gate, and then wrote the real sign-off. This run is therefore the one that shows **the gate's own
objection to the release**, with nothing of mine in front of it:

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.2bGZfPOq6I
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v92 (chemowell-app-v92-1) at acb42f3
   9 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: no CURRENT chain report for app-v94.
   Finding a filename is not reading a report. app-v68 was gated by an audit of 51ba75f
   while the head being shipped was 68d3dd6 — 67 further lines of index.html, a rewritten
   treatmentActiveOn among them, that no auditor had ever seen. The report was NAMED for
   v68, and the name was all this gate checked.
   missing: a CURRENT outputs/AUDIT*app-v94* report saying VERDICT: SHIP
   Reports found, and why each is not current:
     outputs/AUDIT-app-v94-delta2.md — examined ca48e31; changed since: index.html 
     outputs/AUDIT-app-v94.md — says DO NOT SHIP
   Re-run that stage against the current tree, or drop the unaudited work to a later
   version. Code that ships must be code someone read.

⛔ STOPPED EARLY -- the checks after this point did NOT run.
   This is not the complete list of what is wrong with the release; it is the first thing
   that made the rest of the gate impossible to evaluate. Fix it and re-run.
```

**Exit code: 1.**

Two things to read out of that output beyond the headline. **The gate stopped early**, so none of
the suites ran inside it — its silence on them is not a pass, and my own runs cover only three of
them. And **the PM artefact was accepted**: the gate named only the missing audit, so the header,
substance and currency of this file all satisfied it. The audit is the single blocker.

**Run 2, against the tree as committed**, with this sign-off in its final form. My refusal is now
itself the first thing the gate hits, which is correct and is the confirmation that a PM refusal
actually stops the release rather than being filed beside it:

```
ℹ️  Suites will run against a clean export of HEAD at /tmp/tmp.a6CBQCPeAH
   (not the working tree -- see the app-v82 note above).
ℹ️  Baseline: PUBLISHED.json -> app-v92 (chemowell-app-v92-1) at acb42f3
   9 commit(s) have changed index.html since that record. This gate assumes NONE of
   them are live yet. If any were already pushed, run ./mark_published.sh <that commit>
   first -- otherwise the comparison below is against the wrong build.
❌ RELEASE CHECK FAILED: a chain report refuses this release, and nothing supersedes it.
   These say DO NOT SHIP:
     outputs/PM-app-v94.md — examined 0c74ea3
   A refusal is cleared by re-running that stage against a LATER commit and it saying
   SHIP — not by adding another file beside it.

⛔ STOPPED EARLY -- the checks after this point did NOT run.
   This is not the complete list of what is wrong with the release; it is the first thing
   that made the rest of the gate impossible to evaluate. Fix it and re-run.
```

**Exit code: 1.**

Note for whoever clears this: by the gate's own rule a refusal is superseded only by the same stage
examining a **later** commit. So the delta-3 audit's SHIP must name a commit strictly after
`0c74ea3`, and this PM stage must then run again against that commit. The audit's SHIP alone will
not lift my refusal, and it should not.

The baseline note is expected and correct: `PUBLISHED.json` records app-v92 as live, and the nine
commits since are app-v93 and app-v94, neither of which has been pushed to `main`.

## Not mine to decide

**Pushing to `main` needs the owner's word, and he has not given it for app-v93 or app-v94.** Both
releases are waiting on him. This sign-off would have cleared app-v94 to be *offered* to him; it
does not authorise a push, and I have pushed nothing to `main`. I committed one file, this report,
to the working branch.

## For the owner, in plain words

**Your bug is fixed, and fixed properly — but I am not signing it off yet, and the reason is a rule
we wrote on purpose.**

What you reported: you gave the 5 o'clock dose at about quarter to five, and the app kept asking for
it. That is fixed. The card stops asking, the ring beside it now agrees instead of contradicting it,
and — this is the part the first review refused the release over — **your phone stops asking too.**
The first version of this fix only fixed the screen. The alarm would still have gone off at five
telling you to give the dose you had just given, which is worse than the bug you reported, because
the phone reaches you when you are not looking at the app. The review caught it, the fix now covers
the alarm, the pop-up notification and the number on the app icon, and there is a test behind every
one of those so it cannot come back quietly.

Nothing was added that you did not ask for. Four possible improvements were written down and none of
them was built; one of them is worth your opinion later — showing *which* dose slot the card is
asking about when a medication has more than one.

**Why I am stopping.** Two independent reviews examined this release. After the second one approved
it, one line of the main file was changed — a safety tidy-up that the reviewer itself had
recommended, in a branch of code that nothing can currently reach. I checked that myself and it is
correct and harmless. But our rule is that code which ships is code a reviewer has actually read,
with no exception for small or obvious changes, and the automatic check enforces that rather than
trusting anyone's judgement. It refused, so I refuse. That rule exists because a release once went
out with 67 unexamined lines in it on exactly this reasoning.

**What it takes to clear:** one short review pass over a fourteen-line change. Not a rebuild, not
more building. Then the check runs the rest of the tests and this is ready to offer you.

**One thing only you can check, once it is live**, because nothing here can test a real phone: give
a dose ten or fifteen minutes before its scheduled time, then watch that the phone does **not** buzz
for it when that time arrives, and that the number on the menu button drops. Everything on this side
is measured with a simulated phone. A real one buzzing is the only proof that counts.

Also still waiting on you: **app-v93 and app-v94 are both built and neither has gone live.** Nothing
goes to the live app without you saying so.
