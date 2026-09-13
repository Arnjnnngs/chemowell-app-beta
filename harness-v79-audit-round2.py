#!/usr/bin/env python3
"""app-v79, round 2: the nine findings of the Zero Day Audit of commit 5eb5e42.

THE HEADLINE. Fix 4 did not work, and the audit reproduced the exact defect the release claims to
have removed. The collection logic was right; two lines of app-v78 were left standing three lines
ABOVE it, still writing an amber spacing reminder straight into state.warn before any of the new
code runs. The patch's anchor for the rewrite began at `const configuredMedication`, and the leftover
was above that line.

AND THE ONE I HAVE TO OWN: fix 7 re-introduced one care plan's dose ceilings into the product --
`ceilingMax: 4` for Imodium and Lidocaine -- justified in the commit message as moving `const imoMax`
and `const lidoMax` "inline". Neither string exists in the parent commit; phase 2/3 had already
removed them. That is Rule 0 leak shape 3, in the release whose purpose is to remove leak shape 4,
committed by the person writing the rule. The guard in test/v75-no-other-patient.mjs passed because
it only matches three-to-five-digit numbers in mg or mL: a one-digit ceiling in `applications` was
invisible to it. Both the number and the blind spot are fixed here.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / 'index.html'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'warnBatch' in src:
    die('already applied')

def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---- F1 BLOCKER: the leftover that still clobbers the red warning -------------------------------
cut("""  const twoH = 2 * 3600000;
  // app-v76 phase 1: property-driven interaction rules, if this medication carries any. Falls
  // through to the legacy iron/protonix branch below when it does not, which is every medication
  // today. Phase 2 deletes that branch.
  // NO EARLY RETURN. The first version returned here, which put a spacing reminder in front of the
  // red "Acetaminophen ceiling exceeded" warning and dropped it entirely -- reproduced at 6,000mg
  // against a 3,000mg limit. In app-v75 the collision was impossible, because the legacy branch only
  // returned for iron/protonix, which is disjoint from the tylenol block; making the rule generic
  // made it reachable. The ceiling warning is the one that matters, so it is allowed to run and to
  // overwrite. Found by the phase 1 audit.
  const declared = medInteractionsFor(entry);
  if (declared.length) setState({ warn: declared[0] });
  const configuredMedication""",
    """  // THE TWO LINES THAT USED TO BE HERE ARE GONE, and their absence is the whole point of this
  // function's shape. They read `const declared = medInteractionsFor(entry); if (declared.length)
  // setState({ warn: declared[0] });` -- an amber spacing reminder written straight into state.warn
  // BEFORE the collection below runs, so the red ceiling warning the collection exists to protect
  // was destroyed three lines before anything could protect it. app-v79's first attempt rewrote
  // everything from `const configuredMedication` down and left these standing above it, which meant
  // the release that says "red beats amber" shipped the exact order-dependent behaviour it names.
  // medInteractionsFor(entry) is still called, once, into `warnings` below. Nothing is lost.
  // `const twoH` went with them; it had no readers left either.
  const configuredMedication""",
    'the leftover interaction clobber')

# ---- F2: a stale red must not silence every later amber for the rest of the session -------------
# state.warn is cleared in exactly one place -- the caregiver tapping the x. So "never downgrade a
# red" scoped to state.warn means an undismissed red from any earlier moment suppresses every amber
# afterwards, on any medication, with nothing on screen saying so. And leaving that banner up is the
# reasonable thing to do with a warning reading "check with the care team". The rule is about ONE
# logging action, so it is scoped to one: a batch token that "Take all" creates per run.
cut("""function afterLog(entry) {""",
    """function afterLog(entry, warnBatch) {""",
    'the afterLog signature')
cut("""  const worst = warnings.find(w => w.tone === 'red') || warnings[0];
  if (state.warn && state.warn.tone === 'red' && worst.tone !== 'red') return;
  setState({ warn: worst });""",
    """  const worst = warnings.find(w => w.tone === 'red') || warnings[0];
  // SCOPED TO THIS BATCH, NOT TO THE SESSION. The first version read `state.warn`, which is cleared
  // only when the caregiver taps the x on the banner -- so an undismissed red from an hour ago
  // silenced every amber raised afterwards, on every medication, invisibly. A caregiver who leaves
  // a "check with the care team" banner up, which is the sensible thing to do, would simply stop
  // being told about interaction timing. `warnBatch` is an object "Take all" creates once per run
  // and passes to each call; a single log passes none, so it never suppresses anything.
  if (warnBatch && warnBatch.red && worst.tone !== 'red') return;
  if (warnBatch && worst.tone === 'red') warnBatch.red = true;
  setState({ warn: worst });""",
    "afterLog's downgrade guard")
cut("""    setTimeout(() => { ids.forEach(mid => afterLog({ medId: mid, ts, id: 'pending' })); }, 500);""",
    """    // ONE BATCH TOKEN FOR THE WHOLE RUN, so a red raised by the first medication survives an amber
    // raised by the third -- and nothing outside this run is affected by it.
    setTimeout(() => { const warnBatch = {}; ids.forEach(mid => afterLog({ medId: mid, ts, id: 'pending' }, warnBatch)); }, 500);""",
    "take-all's afterLog loop")

# ---- F3 + F4: one care plan's dose ceilings, back in the product file ---------------------------
cut("""  'imodium': { homeCard: { kind: 'pills' }, ceiling: true, ceilingMax: 4, ceilingUnit: 'pills' },
  // Missing entirely, so its card disappeared: the old medHomeCardKind returned 'pills' for it and
  // the old block carried `const lidoMax = 4`. Both were one care plan's numbers; they are written
  // here as that medication's own configured limit, once, on data that predates the properties.
  'lidocaine': { homeCard: { kind: 'pills' }, ceiling: true, ceilingMax: 4, ceilingUnit: 'applications' },""",
    """  'imodium': { homeCard: { kind: 'pills' } },
  // homeCard ONLY, AND DELIBERATELY. app-v79's first attempt also wrote `ceiling: true,
  // ceilingMax: 4` here for both, justified as moving `const imoMax = 4` and `const lidoMax = 4`
  // from inline. Those strings do not exist in the parent commit -- phase 2 and 3 had already
  // removed them -- so it was not moving a number, it was putting one back: leak shape 3, a dose
  // ceiling from one care plan, in the product whose Rule 0 forbids exactly that, added by the
  // release meant to finish removing leak shape 4.
  //
  // It was also applied as a default over an ABSENCE. This migration writes a key when
  // `next[key] === undefined`, and `ceiling` being absent does not mean nobody considered it -- it
  // means the user configured this medication and set no daily limit. That is their decision and it
  // was being silently overwritten with a stranger's number. (backfillDefaultMedFlags carries a
  // whole comment about this absent-vs-false distinction, fifty lines from here.)
  //
  // And it could never have worked: dailyCeiling routes anything with a ceilingUnit through
  // dailyPills, which sums entry.pills, and a lidocaine patch saved by a build before app-v45 has
  // no pills field -- so the card would have read "0 / 4 applications" and "4 applications left"
  // permanently, however many were logged. A limit that always reads as satisfied is worse than no
  // limit shown. `homeCard` is a DISPLAY property and belongs here; a daily maximum is a
  // prescription and does not.
  'lidocaine': { homeCard: { kind: 'pills' } },""",
    'the imodium and lidocaine rules')

# ---- F6 (VOICE): the warning names one member of a shared total -------------------------------
# The same release fixed this false impression on the Home card, on purpose, by labelling the shared
# total "TYLENOL + TYLENOL LIQUID". The warning was left naming one member, so two surfaces describe
# the same number in one release and lead to opposite conclusions -- and the wrong one ends with a
# caregiver giving more liquid because "the pills are over but the liquid is fine".
cut("""  const configuredLimit = dailyCeiling(ceilingOwner);
  if (configuredLimit && configuredLimit.used > configuredLimit.max) {""",
    """  const configuredLimit = dailyCeiling(ceilingOwner);
  // WHAT THE TOTAL IS ACTUALLY OF. After logging Tylenol Liquid the warning read "Tylenol daily
  // limit exceeded ... today's Tylenol total is 3,500 mg", naming a medication the caregiver did not
  // tap, with a number bigger than anything they logged under that name. At 2am that reads as
  // "I mis-tapped" or, worse, "the pills are over but the liquid is fine".
  const ceilingNames = ceilingOwner ? ceilingGroupMedIds(ceilingOwner)
    .map(id => (state.meds.find(m => m.id === id) || {}).name).filter(Boolean) : [];
  const limitLabel = ceilingNames.length > 1 ? ceilingNames.join(' + ') : (ceilingOwner || {}).name;
  if (configuredLimit && configuredLimit.used > configuredLimit.max) {""",
    "the ceiling warning's label")
cut("""    warnings.push({ tone: 'red', title: ceilingOwner.name + ' daily limit exceeded', body: "Today's " + ceilingOwner.name + ' total is '""",
    """    warnings.push({ tone: 'red', title: limitLabel + ' daily limit exceeded', body: "Today's " + limitLabel + ' total is '""",
    'the ceiling warning body')

# ---- F8: the schemaV stamp skipped every medication with no legacy rule -------------------------
cut("""  if (!rules) return next;
  // `windows` is the one key the old code IGNORED on a legacy medication""",
    """  // STAMPED BEFORE THE RULE LOOKUP, NOT AFTER IT. This sat below `if (!rules) return next;`, so a
  // medication that predates the properties and matches no legacy rule was never stamped and was
  // re-walked by the migration on every version-1 restore, forever. Harmless while the rule table is
  // fixed. It stops being harmless the first time an id is ADDED to LEGACY_MED_RULES, which would
  // then apply retroactively to a customer's own medication of that name on an old device.
  //
  // `next &&` IS NOT DEFENSIVE PADDING. `next` is `med ? {...med} : med`, so a null or undefined
  // medication reaches here as null -- and moving the stamp above the early return crashed on
  // exactly that, caught by the hostile-value section of the equivalence suite the moment the line
  // moved. A null medication is not hypothetical here: the resolvers are commented throughout as
  // distrusting their normaliser because an import, a hand-edited config or a restored archive from
  // an older build can all deliver one.
  if (next) next.schemaV = MED_CONFIG_VERSION;
  if (!rules) return next;
  // `windows` is the one key the old code IGNORED on a legacy medication""",
    "migrateLegacyMedRules' early return")
cut("""  if (rules.replaceWindows) delete next.windows;
  next.schemaV = MED_CONFIG_VERSION;""",
    """  if (rules.replaceWindows) delete next.windows;""",
    "the old schemaV stamp")

# ---- F9: "0 / 1 pills" ---------------------------------------------------------------------------
cut("""            hcMax > 0 ? (' / ' + hcMax.toLocaleString() + ' ' + hcUnit) : (' ' + hcUnitFor(hcUsed)))""",
    """            // The max is a count like any other: a medication limited to one pill a day read
            // "0 / 1 pills". This site was left plural on purpose in the first pass and the purpose
            // was wrong.
            hcMax > 0 ? (' / ' + hcMax.toLocaleString() + ' ' + hcUnitFor(hcMax)) : (' ' + hcUnitFor(hcUsed)))""",
    "the home card's max unit")
cut("""      hcMax > 0 ? h('div', { role: 'img', 'aria-label': hcUsed.toLocaleString() + ' of ' + hcMax.toLocaleString() + ' ' + hcUnit + ' used today'""",
    """      hcMax > 0 ? h('div', { role: 'img', 'aria-label': hcUsed.toLocaleString() + ' of ' + hcMax.toLocaleString() + ' ' + hcUnitFor(hcMax) + ' used today'""",
    "the home card bar's aria-label")

# ---- the reason four of eight fixes shipped untested: afterLog cannot be reached ---------------
# Same reasoning and same pattern as window.__syncTest and window.__notifTest already in this file:
# this is a single <script type="module">, so a real browser harness cannot reach a module-scoped
# function otherwise -- and the audit's headline finding was that NOT ONE of 231 checks across seven
# suites touches afterLog, where four of app-v79's eight fixes live. A commit message was doing a
# check's job. The alternative was to lift afterLog into a Node sandbox, which is exactly what let
# the v77 suite report "zero differences" about a release whose Home screen was dead.
# Exposes nothing a caller could not already do from the UI: logging a dose and reading the banner.
cut("""  window.__notifTest = {""",
    """  // app-v79: the warning path, for test/v79-warning-priority.mjs. See the note above __syncTest.
  window.__warnTest = {
    afterLog,
    getWarn: () => state.warn,
    clearWarn: () => setState({ warn: null }),
  };
  window.__notifTest = {""",
    'the notif test hook')

HTML.write_text(src, encoding='utf-8')
print('app-v79 round 2 applied: the leftover clobber, the session-wide red, and a ceiling that should never have been written')
