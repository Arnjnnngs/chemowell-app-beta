# Designer Review — v34 (copy-only: FAQ items, Intended use, Pro bullet)
## Verdict: PASS
Reviewed rendered output at 390px, 320px, 1280px (evidence set + own live captures).

## Findings
- Major: none.
- Minor 1 (process): first evidence set was mis-framed — pinned who-for row out of frame, open states clipped behind sticky header, welcome toast overlapping. Fix: re-shoot centered, wait out the 4.5s toast. (Re-shot by Lead Dev; verified by Lead Designer.)
- Nit 2: mixed separators in multi answer ("…allows up to 3, and Pro…"). Fix: semicolons throughout. (Applied.)
- Nit 3: 320px Pro bullet wrap severed "looking / after". Fix: U+00A0 between "looking" and "after". (Applied.)
- Nit 4: pre-existing accordion bottom-padding asymmetry (~14-16px top vs ~26-28px bottom) — affects all items, predates v34, correctly out of scope.

## Confirmed surface by surface
Pinned placement correct at all widths; new FAQ rows typographically identical to existing (weight/size/alignment/+− affordance, two-line wrap matches existing two-line rows); answers readable at 390px (~42 chars/line) and 320px, no clipping; INTENDED USE label pattern identical to MEDICAL DISCLAIMER (size/weight/letter-spacing/rhythm), correct order; Pro bullet reads naturally, clean wrap; copy tone consistent with app voice ("Settings — Profiles" phrasing matches switch-profile answer exactly).
