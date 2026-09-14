# What app-v80 leaves open — start the next release here

Everything below was found by the round-3 audit (`outputs/AUDIT-app-v80-round3.md`, **SHIP**) or by
running the suites, and every item is deliberately NOT fixed in app-v80. The rule this obeys is the
one app-v68 and app-v79 paid for: **code must not change after the audit that read it.** The one
correction that did land is documentation only — the README sentence below — which is the same
latitude the app-v79 PM took and stated.

---

## 1. The hero button's long-name threshold is wrong, and 14 is the right number

**Item 1 of the next release.** `(nx.openNow && String(nx.med.name).length <= 22)` decides whether
the button reads *"Go to [name]"* or *"Show me the card"*. The audit measured a real 22-character
name — *Mycophenolate Mofetil2* — and it is **still cut to an ellipsis at 320px and at 360px**.

**What round 3 genuinely fixed is not affected:** the button is 48px at every width and every name
length, and the card is 185 / 211 / 238px at 320 / 360 / 390. Round 2's five-line button driving the
card's height is gone. What is left is a name that reads *"Go to Mycophenolate Mofe…"* where it
should have read *"Show me the card"* — cosmetic, and the card it goes to still carries the full
name.

**The fix:** change `22` to `14`. **The falsification:** a 15-character name must produce
*"Show me the card"* and a 14-character one must produce *"Go to …"* in full at 320px, measured by
`boundingBox()` rather than by reading the label.

## 2. `test/v80-contrast.mjs` sees one ground and one card

Two limits the audit named, both worth closing and neither a defect today:

- It reads a background **only from the text element itself**. A background set on an ancestor, or a
  `background-image` on a child, would leave the suite measuring against the gradient and flattering
  a real failure.
- It can only ever see the **orange hero**. The green *"All scheduled doses are in"* card is never
  rendered in its fixture, so nothing measures its contrast at all.

## 3. The `minWidth: 0` sentence — corrected, and the pattern behind it is the real finding

The README said the missed-dose banner needed `minWidth: 0` because *"a wrap alone would have
changed nothing."* Measured each half alone: **the `overflowWrap` is the whole fix.** Corrected in
the file.

**That is the third release running with an unmeasured claim in the release notes** — after round
2's *"clears 4.5:1"* (it measured 3.3–3.8) and app-v79's three stale check counts. The claims are
always about a property the author believed rather than measured, and they are always caught by
somebody else. `test/v80-contrast.mjs` is the answer for one class of them; there is no equivalent
for "which half of this two-part fix is load-bearing" except measuring each half, which costs two
runs and is what the audit did.

## 4. Known-red suites, unchanged by app-v80 and each measured on the app-v79 file

| Suite | State | Not this release's, because |
|---|---|---|
| `audit-v55` | 3 failures | identical on the app-v79 file |
| `pm-v55` | 1 failure @360 | identical on the app-v79 file |
| `pm-v55b` | 2 failures @360 | identical on the app-v79 file |
| `v57-browser-notice` | 17 failures | documented in `run-all-tests.sh` as nine releases old |
| `v74-shipped-audit-probe` | 3 failures | pre-existing on the parent commit, written up in its own commit message |
| `audit-v55b` | cannot start | reads `/tmp/topics.js`, a path from a sandbox that no longer exists |

`audit-v55b` is the worst of these and the cheapest to fix: **a suite that cannot start is
indistinguishable from one that passes**, which is the sentence this repo has written three times.

## 5. The CI gate's first green run is the only proof it is fixed

`verify-live.yml` gets `fetch-depth: 0` and a pinned Chromium in app-v80. The audit verified
everything checkable from here — `npm install --no-save` leaves `package.json` and
`package-lock.json` byte-identical, playwright resolves from `test/*.mjs`, `release_check.sh` runs
neither file that hardcodes `/opt/pw-browsers/chromium`, and no path was found that makes the gate
green when it should be red. **A GitHub runner cannot be driven from this sandbox.** The first push
after app-v80 is the measurement; if that run is still red, this is not fixed and the next release
starts here instead of at item 1.

## 6. After the push, `PUBLISHED.json` needs re-recording

It currently names a **local** sha (`2f24edd`) that does not exist on a runner, so the gate fell
back to `origin/main` with a warning. Run `./mark_published.sh` with **no argument** after fetching
— its default is `origin/main`, which survives a fetch — and commit the result.
