# Zero Day Audit — ChemoWell app-v75

AUDITED-COMMIT: 2464cb1411c8a13ec3598a63f35fa8af93c7c544
VERDICT: SHIP

Both passes returned BLOCK; every finding is fixed and re-verified, and the fixes are what this
verdict is on. Two content questions are named as Aaron's call and neither asserts anything false.

Two independent agent passes. **Both returned BLOCK.** Every finding below was fixed before this
file was written; nothing here is outstanding except the item marked AARON'S CALL.

## Pass 1 — BLOCK

**Headline: the release promoted MedlinePlus above the app's own hand-written line for 14
medications, and for the anti-nausea drugs a chemotherapy patient actually takes, MedlinePlus's
first sentence is not about nausea.**

Verified by running the shipped functions out of `index.html`, not by reading them:

| drug | before | as first built |
|---|---|---|
| promethazine | "Settles nausea and vomiting… It causes drowsiness." | "…allergic rhinitis (runny nose and watery eyes caused by allergy to pollen, mold or dust)…" |
| metoclopramide | "Settles nausea and helps the stomach empty." | GERD and gastroparesis |
| lorazepam | "Eases anxiety, and is also used for nausea and sleep." | anxiety and insomnia |
| diphenhydramine | allergic reactions and sleep | "allergy and cold symptoms" — reads as a cold remedy |
| morphine | "moderate **to** severe pain" | "**severe** pain" |
| Percocet | "A strong pain reliever that also contains acetaminophen." | oxycodone's line, **acetaminophen warning gone**, cited to the oxycodone page |

Clamped to two lines at 320px, promethazine's card reads *"her allergy medicine"*. A caregiver at 2am
with the patient vomiting does not give it. Promethazine is one of the two drugs most likely to be
reached for at that moment. **FIXED** — `describeMed()` orders typed → this app's own line →
MedlinePlus, and returns the words and their page together so a citation cannot appear over text that
did not come from it.

Also fixed in pass 1: a duration ("used on a short-term basis") passing the schedule guard;
`tidy()` missing MedlinePlus's "Prescription X is used to…" opener, which kept the drug name and
added a prescription-only claim; the patch writing `index.html` before validating `sw.js`, so a
drifted CACHE anchor left a bumped version behind a stale service worker; a CDN-noise filter missing
the only error this sandbox produces.

## Pass 2 (delta) — BLOCK

**Headline: the check written specifically to catch pass 1's defect could not fail.**

```js
const overridden = collide.filter(k => own[k] !== own[k]);
```

False for every non-NaN value, so the list was always empty and the assertion always green. The
auditor restored the blocked ordering into `describeMed` and watched it print PASS. The literal
`|| true` class, inside the fix for the previous block. **FIXED** — it now runs the shipped
`purposeOf` and `purposeSourceLink` against every overlapping key and compares the text that comes
back. Falsified: with the blocked ordering restored it names all 13 regressions and 13 false
citations.

Also fixed in pass 2:

- **The patch docstring still argued for the blocked ordering.** Under Rule 0 the patch is the
  release record; a later session would have "restored" the blocked behaviour believing it was the
  intent. It now also says which of the two is authoritative if they disagree again.
- **A FAQ became untrue.** "Side effects — is this normal?" told the caregiver the app *"holds no
  information about any drug"* and is *"not a source of medical information"*. Its keywords include
  "what does it do", "safe to take" and "interaction", so it is where the app steers exactly the
  person asking about a drug. The protective point — the app knows nothing about **this** person's
  treatment — is now stated directly instead of resting on a false claim.
- **Three more guards, all from the content review**, listed below.

Pass 2 verified by execution that pass 1's fixes hold: all 13 overlapping keys return the
hand-written line; 12,544 name/sub pairs produce zero false citations; the patch chain from a clean
app-v74 is byte-identical; the patch order is enforced rather than merely documented.

## The content findings, and what happened to each

The auditor's most valuable work was reading all 31 sentences and asking, for each, whether it is
right for **someone on chemotherapy** — not whether it is true.

| finding | outcome |
|---|---|
| acyclovir / valacyclovir name "genital herpes (a sexually transmitted disease)" — both are routine shingles prophylaxis when counts are low | **GUARD.** No stigmatised indication. The card would attach an STD to a patient who does not have one, on a screen this app exports. |
| carboplatin says "cancer of the ovaries"; ifosfamide "cancer of the testicles"; epirubicin asserts a surgery; oxaliplatin asserts a stage | **GUARD.** No named diagnosis. Carboplatin is standard in lung, breast and bladder disease. The card would be confidently wrong about the most sensitive fact in the app. |
| fluconazole leads with "yeast infections of the vagina" — usually oral thrush prophylaxis | **GUARD.** Gendered anatomy, added the same day one specific woman was taken out of the app. Ordinary anatomy stays allowed, with a check pinning that. |
| amitriptyline says "depression"; the list has it for "nerve pain and mouth sores" | **REPORTED, NOT DROPPED.** No pattern can detect off-label use. The run now compares each sentence against our own recorded reason for asking and prints the ones that share nothing, under a heading saying a person should read them. |
| leucovorin mentions "an overdose of methotrexate"; cyclophosphamide omits breast cancer | **AARON'S CALL.** Both survive the guards. Neither asserts anything false about the patient. |

Net effect: 30 sentences quoted, **11 of them actually shown** — the rest lose to this app's own
lines. The chemotherapy agents assert nothing and keep their lookup link.

## Not fixed here, recorded instead

**Hardcoded medication rules inherited from care-tracker.** `med.id === 'zofran'` drives a three-day
post-chemo block; dexamethasone has an "8 AM & 2 PM" tile; there is an Iron + Protonix interaction
warning and Tylenol ceiling copy gated on medication id. These are one care team's rules living in a
shared product.

**They are unreachable for any real user, and this was verified by running the app rather than by
reading it.** `RESERVED_LEGACY_MED_IDS` fences those ids off, so a new user typing "Zofran" gets
`zofran-2` and no rule fires — confirmed for Zofran, Dexamethasone, Iron, Tylenol and Imodium, with
no legacy tile rendered. The fence is the only thing holding, which is fragile. Removing them is a
behaviour change and belongs in its own release with its own audit.
