# ENHANCER — app-v91 (the contrast release)

**Proposals: three, all small, none built. None of them is a colour change.**

## It ran late again, and that is now a pattern rather than a slip

Rule 1.5 puts the design-time seats **before** the build. This pass ran after two Zero Day Audit
passes, because `release_check.sh` names its missing artefacts one at a time and `stopped_early`
hid this one behind the chain-report stage — the identical sequence recorded in
`outputs/DESIGN-app-v90.md`. **Two releases running, both design-time seats have been summoned by
a gate rather than run before the build.** That is a defect in the gate's ordering and it is
logged; it is not an excuse for this pass.

## The screens this release touched

Every one, which is unusual: the page gradient and five ink tokens are global. But it **adds no
control, removes none, and moves nothing**, so the usual add / correct / remove symmetry table is
unchanged from app-v90's and is not reproduced here. The question worth asking of a readability
release is the sixth one — *is everything already on the screen worth being there?* — and that is
where all three proposals come from.

| | proposal | size |
|---|---|---|
| **E1** | **The contrast gate covers 8 screens at one width. Settings, Calendar, Help, the medication editor, Upgrade, Setup, Bowel, Appetite, Radiation, the symptom reports, every modal and every toast are unmeasured** — and two of the five gradients this release repaired live on screens the gate never visits (Setup's *Get started*, the Upgrade button). They were found by `grep`, not by the scan. The release's own claim is "every piece of text in the app"; the truth is "every piece of text on eight screens at 390px". **Widen the scan's screen list and add 320.** | M |
| **E2** | **Nothing measures a focus ring, a pressed state or a disabled control.** `:hover`, `:focus`, `:active` and `:disabled` are untouched by the scan, so a focus ring could sit below AA with every number in this release green. This is Rule 5.5's question — *every gate here asks about a still frame* — arriving in a new place: the contrast gate is itself a still-frame gate. | M |
| **E3** | **30 `rgba()` literals still encode the retired colours.** The swap was hex-only, so a solid and its own tint no longer derive from one colour — clearest at `index.html:8890`, where `#0B5C40` sits beside `rgba(10,107,74,.10)`, its tint of the pre-release green. Invisible to contrast (a 10% tint of either reads the same against the page) and visible to a person who looks. | S |

## What I looked at and did NOT propose

* **No empty state reads as a bug report this time.** Rule 2.6's second check — *read the empty
  states out loud* — found nothing new; the three that were sitting in the file have been fixed.
* **No screen gained a dead end or lost an action**, because no control changed.
* **I did not propose "make the text bigger".** At 320px the axis labels render at about 4.5 CSS
  px, which is small, but nobody has seen this app on a phone and a size change is a layout change
  — it belongs behind a real device, not behind a guess. Named here so it is on the record as
  considered and declined, not missed.
