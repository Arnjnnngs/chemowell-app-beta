# Enhancer pass — app-v87

**Run late, and that is the finding above the findings.** Rule 1.5 puts this seat BEFORE the build,
on the screens about to change. It was skipped on app-v86, the PM refused that release for it, and
**it was skipped again here** — on the release whose own README row opens by explaining that both
its features exist *because* that seat was skipped last time. The PM refused this release for the
same reason, one release later, and was right to.

What that cost is measurable rather than theoretical. app-v87 turned up **five** separate places
where Help described a control the app does not have. Every one of them is this checklist, item for
item. Three independent audit rounds read past the fifth; it was found by a person sweeping bolded
names by hand.

Screens examined: the Home bowel-issue banner, the daily check-in sheet, **Reports → Bowel
Movement**, **Reports → Appetite**, and the Help topics those screens are described by.

This seat PROPOSES. It does not widen a release on its own — this is a patient's medical app and
every extra control is a new way to mis-tap. Aaron decides.

---

## E-1 — You can correct a day you logged. You still cannot log a day you missed. **(M)**

This release's headline is that a past day can be corrected rather than only deleted. Correct that,
and the gap one step over becomes visible: **`Correct` renders on an existing row.** A day with no
row has no control at all, and the logger above the list writes to `dayStart(simNow())` — today,
always, with no date step.

So a caregiver who was in hospital Thursday and Friday and opens the app on Saturday can record
Saturday and nothing else. The two days are simply absent, and nothing on the screen says why or
offers a way.

**And the sibling screens already got this right**, which is checklist item 5 exactly:

| Report screen | Log today | Log another day | Correct | Remove |
|---|---|---|---|---|
| Paracentesis | yes | **yes — the add opens a date step** | yes | yes |
| Weight | yes | **yes — same date step** | yes | yes |
| Bowel Movement | yes | **no** | yes (this release) | yes |
| Appetite | yes | **no** | yes (this release) | yes |

The mechanism exists and is already used by two screens on the same tab. **Recommended** — it is the
other half of the feature Aaron asked for, and a missed day is the common case for the daily
questions rather than the rare one.

## E-2 — The appetite note can be shown, exported and preserved. **Nothing can enter one.** (S)

The appetite history row renders `e.note`. The CSV carries it. This release wrote a careful rule
about what happens to it when the answer changes, and app-v86 wrote one before that.

**There is no control anywhere that creates one.** The only writer that ever passed a note is
`submitAppetite()`, which nothing calls — it is the dead code already sitting on `BACKLOG.md` from
the app-v86 audit. The live logger has no note field, the row corrector passes no note, and the
daily check-in sheet has no appetite-note field either.

So the app displays a field a caregiver cannot fill, and two releases have now written rules
governing data that cannot exist. **That is a dead end of the purest kind** (checklist item 4) and an
add/display asymmetry (item 1).

Either give the logger a note field, or stop rendering and exporting one. **Recommended: give it the
field** — "ate half a sandwich, no nausea" is exactly the sort of thing a clinician reads, and the
plumbing to carry it is already built and tested. **But it is Aaron's call**, because the honest
alternative is one less control on a screen a tired person uses at night.

## E-3 — The empty states are fine now, and that is worth recording. (nil)

Checklist item 2 says read them out loud. *"No bowel movement entries logged yet."* and *"No appetite
entries logged yet."* Both are plain and neither sends the caregiver somewhere else — app-v86 fixed
the versions that said *"logged from Home"*, which was the app filing a bug report about itself.

They could name the control directly above them, but a screen that opens with a logger and then says
"nothing yet" is not confusing. **Nothing proposed.** Recorded so the next pass does not re-open it.

## E-4 — Is everything already on these screens worth being there? (nil)

Item 6, the one this seat is most likely to walk past. Every element on both report screens earns
its place: the coloured dot encodes three states rather than decorating (green normal, amber a
variation, red an issue — and this release fixed Loose rendering green, identical to a normal day);
the date reads as a weekday, which is how a person remembers; `Correct` and `Remove` are distinct
actions with distinct consequences. **No average, no derived statistic, nothing computed about the
patient that a clinician could not use.** The Paracentesis screen's *"Averaging 5.6 L per
procedure"* — a number this seat walked past on a sibling app and the Voice later removed — has no
equivalent here. **Nothing to remove.**

## E-5 — The banner. (nil, now)

It offers all five values, it names the day it writes to, and the day-count makes the alert's state
legible. Both of this release's defects were on this screen and both are closed. **Nothing further
proposed.**

---

## Summary for the release message

| # | Proposal | Size | Recommendation |
|---|---|---|---|
| E-1 | Log a bowel/appetite day you missed, with a date step as Paracentesis and Weight already have | M | **Recommended** — the other half of what was asked for |
| E-2 | A note field for appetite, or stop showing and exporting one | S | **Recommended: the field** — Aaron's call |
| E-3 | Empty states | — | Nothing this time |
| E-4 | Anything on screen that should not be | — | Nothing this time |
| E-5 | The banner | — | Nothing this time |

**Neither E-1 nor E-2 is built in app-v87.** Both are proposals for Aaron, and the release is
complete without them: it delivers exactly the two items he ordered.
