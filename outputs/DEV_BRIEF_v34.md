# DEV BRIEF — v34: "patients & personal caregivers only" positioning + multi-person caregiver FAQ
Stage: Developer (investigation only). Owner intent: state clearly the app is for patients and personal/family caregivers — NOT nurses/doctors/medical staff/facilities (zero HIPAA exposure); FAQ must confirm one caregiver can track multiple people via profiles; positioning word is "caregiver", never "nurse".

## Verified facts
- FAQ_ITEMS: 13 items, single-quoted JS strings with literal U+2019/U+2014. Accordion keyed on state.faqOpenId === item.id.
- About & legal labeled-paragraph pattern (Medical disclaimer) identified for reuse.
- tierLimit: pro=Infinity, plus=3, free=1 — read from code.
- "nurse": zero matches app-wide pre-change; change is purely additive.

## Deliverables specced
1. FAQ 'who-for' — "Who is ChemoWell for?" — pinned FIRST (identity/legal question precedes privacy).
2. FAQ 'caregiver-multi' — directly after 'switch-profile' (same topic cluster; builds on its instructions).
3. "Intended use" label+paragraph in About & legal, above Medical disclaimer, same markup pattern.

## Landmines flagged
1. ASCII apostrophe in single-quoted strings = SyntaxError = blank app. All copy uses U+2019.
2. FAQ ids must be unique (verified no collision).
3. CONTRADICTION FOUND: Pro plan card said "Built for professional and multi-patient caregivers" — "professional" undercuts the new positioning. Surfaced to Owner via Lead Dev; Owner directive ("leave this as caregiver") covers it → reworded.
4. Version-target check: sandbox had rolled the tree back to v29 mid-session; correct base is origin/main v33 → target v34. index.html APP_VERSION and sw.js CACHE must both bump.
5. Render perf: non-issue (15 vs 13 items).

## Alternative considered
Intended-use disclaimer in onboarding instead: REJECTED as primary vehicle — one-time exposure, first-run friction, drags the heavily-tested onboarding into regression scope. FAQ + About & legal is persistent and re-findable. If the Owner later wants an affirmative acknowledgment, scope it separately.

## Done criteria
New items render/expand/collapse at specced positions; no mojibake; "nurse" only in the two not-intended-for sentences; plan limits match tierLimit; versions bumped consistently; README row; onboarding unaffected; zero non-network console errors.
