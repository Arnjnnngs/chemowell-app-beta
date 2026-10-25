# Enhancer pass — app-v86

**Run late, and that is the finding above all the others.** Rule 2.6 says this seat runs
**before** the build, on the screens it is about to touch, so Aaron picks from the list and the
build carries the pick. It did not run at all on app-v86 until the PM gate refused the release for
its absence. **The defect Aaron reported is this checklist's flagship item** — a screen that offers
Remove and no Add — so the one seat most likely to have predicted his bug is the one that was
skipped. Nothing below is being built in this release; it is a list for Aaron to size.

Screens read: **Reports → Bowel Movement**, **Reports → Appetite**, **Reports → History**,
**Settings → profile row**, **Home → Up Next card and the bowel-issue banner**.

## The proposals

| # | Screen | What is missing | Size |
|---|---|---|---|
| E-1 | Bowel Movement, Appetite | **A past day can only be deleted, not corrected.** | S |
| E-2 | Home bowel-issue banner | **"Loose" cannot be recorded from the banner at all.** | S |
| E-3 | History | The summary says "1 BM" above two rows that look identical. | S |
| E-4 | Settings profile row | Rename works only on the profile you are in. | M |
| E-5 | Bowel Movement, Appetite | No way to log for a day that is not today. | M |

### E-1 — a past day can only be deleted, not corrected. **S. Recommended.**

Checklist item 3: *"can a mistake be corrected, or only deleted and redone?"* Both report screens
now log **today** properly and supersede a correction. Every **earlier** row still carries exactly
one control — `Remove`. So a caregiver who mis-tapped yesterday has to delete the record and has
no way to put the right one back, which is the delete-based correction this release spent four
audit rounds removing from every other path. **On the very screens it rebuilt.**

### E-2 — the banner cannot record "Loose". **S. Recommended, and it is a gap in a medical record.**

`BOWEL_MOVEMENT_LABELS` carries five values. The bowel-issue banner's select offers four:
`Normal`, `Very little`, `None`, `Diarrhea`. **`Loose` is missing.** A caregiver watching for
diarrhea during chemotherapy, correcting the day from the banner the app puts in front of them,
cannot record the value that sits between normal and diarrhea — the one that most often matters
first. They must leave the banner and use the Reports screen, and nothing tells them so.

**Pre-existing** — identical at `87d1784`, so this release did not cause it. But app-v86 rewrote
that banner's writer, which is exactly when a seat reading the screen should have caught it, and
the reason this pass running late is a real cost rather than a clerical one.

### E-3 — one screen disagreeing with itself. **S.**

A corrected day now reads `1 BM` in the summary — correct — above two rows showing the old answer
and the new one, looking identical and a second apart. The export and the printed report mark the
superseded one; the screen does not. Nothing untrue is printed and the changelog claims only the
export and the report, but a reader counting rows gets a different answer from the summary.
Already on `BACKLOG.md`; it belongs here too because it is a *screen* problem, not a data one.

### E-4 — rename reaches only the profile you are in. **M.**

Deliberate, documented and safe: renaming another profile means writing into that profile's own
storage from here, and cross-profile writes are what broke reminders in app-v85. The copy now says
so plainly. It is still a thing the caregiver may expect to be able to do from a list showing
every profile.

### E-5 — logging for a day that is not today. **M.**

The new logger does today only. In-Patient has log-now, log-for-another-day and edit; this screen
has log-now. Checklist item 5 — *where a sibling screen already got it right, why didn't this
one?* — and the sibling to point at is **Symptoms**, not In-Patient: Symptoms sits on this same
Reports screen and carries Edit, Remove and a `+` for a past entry, which is the exact three-way
symmetry E-1 and E-5 are arguing for. (The first version of this item named In-Patient, which has
log-now and a `+` for a past stay but no edit — a weaker example, found by the PM.) The honest
answer for why this release does not have it is that it was scoped to the missing door, not the
whole room. Worth it only if Aaron has wanted it; a caregiver catching up after a bad night is the
case that needs it.

## What is already there and worth keeping

Read as checklist item 6 — *is everything on the screen worth being there?* Yes. The state line
(*"Sunday, Oct 25 · currently Diarrhea"*) means the card answers its own question without the
caregiver reading the history below, and the caption (*"Picking again replaces today's answer. The
earlier one stays in the record."*) tells them what a second tap does **before** they tap it.
Neither is decoration. No figure on these screens is an average of events that accumulate over
time, which is the trap Rule 2.7 question 3 exists for.

## Empty states, read out loud

**Corrected after the PM checked it.** The first version of this paragraph claimed these empty
states had been fixed by this release. They were not: *"No bowel movement entries logged yet."* is
byte-identical at `87d1784`, and *"logged from Home"* was never in an empty state at all — it was
in the Reports **card description**, which this release did fix. The conclusion was right (nothing
to propose here) and the route to it was wrong, which is exactly the kind of thing that gets
believed later because it was written down.

What is actually true: the empty states say nothing false, and the card descriptions that used to
send a reader to a screen they could not act on now describe what this screen does.

## Recommendation to Aaron

**E-1 and E-2 together, as one small release.** Both are S, both are about a caregiver being
unable to record something true, and E-2 is a value missing from a medical record on the path the
app pushes hardest. E-3 is cheap and makes one screen stop contradicting itself. E-4 and E-5 only
if he wants them.
