# Zero Day Audit — ChemoWell app-v74 (the SHIPPED build, live on `main`)

AUDITED-COMMIT: b0db2ae776635d0a9c0cd79e4a21078db24e576d
VERDICT: DO NOT SHIP

**Headline, first, because messages survive rollbacks and files do not.**

**Two blockers. Neither is a logic bug — the link mechanics are clean and I could not break them.
Both are what the caregiver sees.**

1. **The release adds a one-tap path that sends the medication name off the phone, and for a whole
   class of users the app says nothing about it at all.** The disclaimer that mentions MedlinePlus is
   gated on at least one medication being in the built-in table. When none is — a state the code's
   own comment calls *"a common state, not an edge case"* — every card still shows **"Look it up on
   MedlinePlus"** and **no disclaimer renders**. Verified in a browser at 320 and 360. Meanwhile
   About and two FAQ answers still say, unqualified, *"the app never sends your information
   anywhere"* and *"nothing is ever sent anywhere."* This is the exact premise the fetch was deleted
   over.
2. **At 320px the link renders as two separate-looking underlined links with a 44px gap between
   them** — "Look it up on" on one line, "MedlinePlus" 44px below it — because the 44px touch target
   is made with `lineHeight: '44px'`, which applies per line when the text wraps. Screenshot below.

Both fixes are copy/CSS. No logic change, no stored field, no migration.

---

## What I could not break (and tried hard to)

* **Reproducibility — exact.** `harness-med-source-patch.py` applied to the app-v73 base at
  `73fbfec` produces an `index.html` **byte-identical** to what is live. `diff` exit 0, zero lines
  of difference. The release is provably the base plus this patch and nothing else, which also
  settles attack #1 by construction: the patch adds no network code.
* **Nothing leaves the phone.** Independently instrumented, not taken from the suite: 22 medications
  through load, render, save and edit, every non-localhost request recorded. Exactly four
  destinations, all `cdn.jsdelivr.net` Capacitor library files, byte-identical to app-v73, none
  carrying a medication name or anything else of hers. `test/v74-med-lookup.mjs` reproduced at
  **23/23**.
* **The link, against 22 hostile names** — `&`, `#`, `?`, single and double quotes,
  `<script>`, `<img onerror>`, newlines, RTL override, emoji, 500 characters, `javascript:`,
  `data:`, `//evil.example.com`, `https://evil.example.com/#`, `%3Cscript%3E`, `constructor`,
  whitespace-only, empty. Of the 20 that rendered a link: **all `https:`, all host
  `medlineplus.gov`, no `javascript:`/`data:`/`vbscript:` reachable by any input, no markup
  injected** (no script ran, no element created inside any card), no page errors. The 500-character
  name builds one well-formed 538-character URL. `//evil.example.com` stays a query value on
  `medlineplus.gov` — it cannot move the host, because it sits after `?query=`.
* **Falsified.** Removing `encodeURIComponent` from `MED_SOURCE.searchUrl` turns 13 of the 20 hrefs
  bad and the encoding check goes **RED**. The check can fail. *(My companion assertion — "at least
  one name then escapes medlineplus.gov" — stayed green under that mutant. **That assertion was
  wrong, not the code**: the value is after `?query=`, so no name can change the host. Reported
  rather than quietly dropped.)*
* **The `h()` trap.** The anchor is inside an IIFE that returns `null`; `h()`'s child loop skips
  `child == null` before `appendChild`. No attribute on the anchor is ever null or undefined —
  `href`, `target`, `rel` and the `data-` hook are always strings. Clean.
* **Layout, the structural part.** 320 / 360 / 390, with a 56-character medication name and a
  210-character description: `scrollWidth === clientWidth` at all three widths, the link stays inside
  its card at all three, bottom nav reachable. No overflow, no clip. (The 320px wrap is BLOCKER 2 and
  is cosmetic, not an overflow.)
* **Mechanics.** `APP_VERSION` = `app-v74`, `sw.js` CACHE = `chemowell-app-v74-1`. Moved together.
* **Records.** The README app-v74 row and `outputs/PM_app-v74.md` are accurate on every mechanical
  claim I checked: 23/23 is real, "appends nothing" is real (no new stored field in the patch or the
  diff), "exactly four CDN destinations" is real, and the `rel="noopener noreferrer"` referrer claim
  is true. The PM doc is unusually straight about shipping with no audit on this exact build. **The
  records are not where this release fails.**

---

## BLOCKER 1 — A new one-tap path sends the medication name off the phone, undisclosed, and for some users undisclosed *entirely*

**Why this is the blocker and not a nitpick.** This release exists in its current shape because the
fetching version *"would have made the app's own promise untrue"* — the promise being the medication
name reaching MedlinePlus. **The shipped link sends the same datum to the same host.** The difference
is that the caregiver initiates it, and consent needs disclosure. There is very little, and for some
users none.

### The gate

`index.html` (the Meds screen):

```js
sortedMeds.some(m => purposeOf(m)) ? h('div', { 'data-med-disclaimer': 'true', ... },
  'These descriptions are written here — general information about what a medication is usually for,
   not advice and not a dose. Each one links to MedlinePlus, where you can read more.
   Follow her care team.') : null,
```

The **disclaimer** is conditional on a description existing. The **link** is not:
`purposeSourceLink(med)` returns a link for every medication with a non-empty name, always.

### Measured, in a browser

| Medication list | cards | descriptions | lookup links | disclaimer on screen |
|---|---|---|---|---|
| two names not in the table (`Qqzzxw Forte`, `Vbnmqq XR`) | 2 | 0 | **2** | **NONE** |
| one in the table + those two | 3 | 1 | 3 | present |

Same result at 320 and 360. The code's own comment above that gate says it plainly: *"This app has
no default medication list and the table is supportive-care drugs, so 'no medication is recognised'
is a common state, not an edge case."* **That reasoning was applied to the descriptions and not to
the link that was added underneath them.**

### What the rest of the app still says, unamended by this release

* About (`index.html` ~7895) — *"All data stays on this device — no cloud, no accounts, no tracking,
  and **the app never sends your information anywhere**."*
* FAQ *"Is my data private?"* (~2926) — *"…there's no cloud, no account, and **nothing is ever sent
  anywhere**."*
* FAQ *"Is my information stored on a server somewhere?"* (~3105) — *"**ChemoWell does not send your
  information to us or to anyone else.** There's no tracking and no analytics."*

### Read as a tired caregiver at 2am

*"Each one links to MedlinePlus, where you can read more"* reads as **"there is further reading
available."** It does not read as **"tapping this tells a website which drug your wife is on."**
And on a phone whose medication list the table does not recognise, she gets the second thing with
none of the first.

### The fix (copy only, no logic)

1. Make the sentence self-describing, e.g. *"Tapping one opens MedlinePlus in your browser and
   searches for that medication by name — that search leaves your phone. Nothing you log ever does."*
2. **Ungate it from `purposeOf`** — or render a short version on cards that have no description — so
   the link is never on screen without it.
3. One clause in the privacy FAQ answer, so the absolute statements there stay true.

---

## BLOCKER 2 — At 320px the link renders as two separate-looking links 44px apart

The 44px touch target is built with `lineHeight: '44px'` on an `inline-block`. At 320px the text
wraps, and line-height applies **per line**: the element becomes 88px tall and shows

```
Look it up on
                     ← 44px of empty space, both halves underlined
MedlinePlus
```

Measured: 320px → `h=88, w=157`. 360px and 390px → `h=44, w=189` (single line, correct).

It is still one anchor and one tap target, so it works — but on the narrowest supported phone it
**looks like two broken links**, which is the kind of thing this project's Designer seat exists to
catch at exactly these three widths. Screenshot:
`outputs/v74-shipped-320-link-wrap.png` (probes: `test/v74-shipped-audit-probe.mjs`, `test/v74-shipped-audit-disclaimer-probe.mjs`).

**Fix:** drop `lineHeight: '44px'` and get the target from the box instead, e.g.
`display: 'inline-flex', alignItems: 'center', minHeight: '44px', lineHeight: '1.35'`. One line.

---

## Non-blocking

* **N1 — `'` `(` `)` `!` `*` `~` are not escaped by `encodeURIComponent`** and reach the href
  verbatim: `?query=Zo'fran'%20onclick%3D'alert(1)`. **Harmless as shipped** — `h()` sets `href` with
  `setAttribute`, so nothing is concatenated into an HTML string and nothing can break out of the
  attribute (confirmed: no markup created, no script ran). It would matter the day this URL is put
  through `h()`'s `innerHTML` branch. Worth a comment at `MED_SOURCE`, not a change.
* **N2 — the empty-name guard in `purposeSourceLink` is nearly unreachable.** `saveMedicationEditor`
  refuses an empty or whitespace-only name, so neither state is reachable through the UI. Via
  tampering: a stored `''` is normalised to `'Untitled medication'` and produces a **live link to a
  MedlinePlus search for the phrase "Untitled medication"** — a dead end, not a hazard; a stored
  `'   '` survives as `''` and correctly renders no link, because in
  `String(original.name || 'Untitled medication').trim()` the `||` runs before the `.trim()`. That
  normaliser quirk is pre-existing, not app-v74.
* **N3 — a fifth network destination exists in the file.** `fetch(SYNC_API_BASE + path)` (~line 759).
  `SYNC_API_BASE` is `''`, `syncApiCall` throws `sync_backend_not_configured` before reaching
  `fetch`, so it is unreachable and the "exactly four destinations" claim holds **at runtime today**.
  It stops holding the day that constant is filled in, and the gate's section 1 is the thing that
  should notice. Pre-existing. The same line carries a `TODO` in a production path.
* **N4 — "Each one links to MedlinePlus"** uses *each one* to mean each **description**, but the
  links sit on every card including those without one. Under-describes rather than misstates;
  folding it into the BLOCKER 1 rewrite fixes it for free.

---

## Attack-by-attack

| # | Attack | Result |
|---|---|---|
| 1 | Still no request carrying user data? | **Clean.** Four jsdelivr Capacitor loads, unchanged from app-v73, no user data. Proved twice — by byte-identical patch reproduction, and by instrumenting every request through load/render/save/edit. |
| 2 | Break the link — injection, wrong host, `javascript:` | **Clean** against 22 hostile names. Falsified: the encoding check goes red when `encodeURIComponent` is removed. |
| 3 | Honesty | **BLOCKER 1.** |
| 4 | Layout at 320 / 360 / 390 | Structurally clean (no overflow, no clip, nav reachable). **BLOCKER 2** on the 320px wrap. |
| 5 | The `h()` trap | **Clean.** IIFE returns `null`, skipped before `appendChild`; no attribute is ever null. |
| 6 | README row and `PM_app-v74.md` | **Clean** on every mechanical claim. The untrue-notes failure did not repeat. |

## How to reproduce this audit

```
python3 harness-med-source-patch.py --base <app-v73 index.html from 73fbfec> --out /tmp/out.html
diff /tmp/out.html index.html        # expect: no output
env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node test/v74-med-lookup.mjs
```
