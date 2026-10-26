# Designer pass — app-v89

Surfaces this release changes: the **plans sheet** and the **Export section** on Account.
Six screenshots in `outputs/design-app-v89/`, at 320 / 360 / 390 CSS px, deviceScaleFactor 2.

## Measured on the rendered page, not read off the source

| Width | Export section | Plans sheet |
|---|---|---|
| 320 | no control under 44px · no horizontal overflow | 743px tall, content 914px, scrolls internally · no control under 44px · no horizontal overflow |
| 360 | same | 743 / 875, scrolls internally · clean |
| 390 | same | 743 / 875, scrolls internally · clean |

The sheet is **shorter than it was**: eight bullets came off the two paid cards and nothing was
added, so there is less to scroll past than in app-v88 at every width.

## What looking at the page actually found

Two things, neither visible in the diff:

1. **A fixture defect of mine first.** The first set of shots had the What's New notice sitting on
   top of the plans sheet, because the seed left `chemowell-app-seen-version` stale against the new
   `APP_VERSION`. Not an app defect — but worth recording, because it is the same shape as the
   thing that got app-v88 refused: *a screenshot of the wrong state looks exactly like a screenshot
   of a broken screen.* Retaken with the notice marked seen.

2. **"a carer with a round of patients" on the Pro card.** Read on the page it stopped the eye: a
   British district-nursing idiom in an app that says **caregiver** 120 times and *carer* exactly
   once — the once being the line I had just written. This is the "British spellings the file does
   not use" failure named in the sibling project's Rule 2.2, caught this time by looking rather
   than by an auditor. Now *"For a family caring for several relatives, or a professional
   caregiver."*

## Read as a reader, at 320px

The ladder is legible in one pass: **$0 one person · $4.99 three · $14.99 as many as you need**, with
the Free card bordered green and marked *Current plan*. Nothing on the sheet names a feature you do
not have. The three "Every feature, for…" bullets deliberately repeat, because the repetition is the
message.

## Deliberately exempt, stated rather than skipped

* **Chromium only.** No iPhone rendering can be reproduced in this sandbox, so Safari's handling of
  the sheet's `env(safe-area-inset-bottom)` padding is unverified here, as on every release.
* **Nothing on a real phone.** Aaron's checklist is in the release message.
* **The What's New notice stacking above the plans sheet** (z-index) is pre-existing, unchanged by
  this release, and only reachable by opening the plans sheet without dismissing an update notice
  first. Not charged here; worth a look when the stacking order is next touched.

---

## Re-measured after the audit's copy fixes (same day)

The blockers and majors rewrote `priv-lost-phone` end to end and lengthened both paid cards'
middle bullets ("Each **person** kept completely separate", "…or a professional caregiver **with
several patients**"), so the two screens were measured again rather than assumed unchanged.

| Width | Export section | Plans sheet |
|---|---|---|
| 320 | no control under 44px · no horizontal overflow | content 935px (was 914), scrolls internally · clean |
| 360 | same | 896px (was 875) · clean |
| 390 | same | 875px (unchanged) · clean |

21px taller at the narrow end, still inside its own scroll, still nothing under 44px and no
horizontal overflow at any width. Screenshots in `outputs/design-app-v89/` are the re-shot set.
