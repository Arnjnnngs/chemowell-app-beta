#!/usr/bin/env python3
"""app-v79 -> app-v80: Home answers "what is due next" before it asks for anything.

Aaron, 2026-09-13, on the redesign mockup: "I love the redesign with what's next instead of what
was there."

THE FINDING BEHIND IT. The category leader's home screen (Medisafe) is a timeline of what is due
when. This app's Home opens with a notice, then banners, then two boxes asking the caregiver to type
in a temperature and a weight -- and the medications, which are the reason the app exists, are
several screens down. The one question a caregiver opens this app to ask, at 2am, one-handed, is
"what is due now", and nothing on the screen answered it.

THE WRITE MODEL, stated before the code (care-tracker Rule 1.5):
  * This release APPENDS nothing. It DELETES nothing. It writes no record of any kind.
  * It adds no stored field, no preference, no migration.
  * The hero is computed entirely from `status()`, `medWindowsFor()` and `doseProgressToday()`,
    all of which Home already calls on every render.
  * Its button SCROLLS to a card that already exists. It does not log a dose, because a second way
    to log a dose is a second way to double-log one, and the card it scrolls to already carries
    every guard -- the ceiling, the gap, the override -- that the real control has.
That last point is the whole safety argument for shipping a large visual change to a medication app.
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
HTML, SW = ROOT / 'index.html', ROOT / 'sw.js'

def die(msg):
    print('PATCH FAILED: ' + msg); sys.exit(1)

src = HTML.read_text(encoding='utf-8')
if 'function nextDueDose' in src:
    die('already applied')

def cut(old, new, what):
    global src
    if src.count(old) != 1:
        die(what + ' is not where it was (found ' + str(src.count(old)) + ') -- nothing written')
    src = src.replace(old, new, 1)

# ---- the computation, beside the ring that already answers the other half ------------------------
cut("""// Dose-progress ring (item 11): 44px SVG built as an innerHTML string, matching the existing""",
    """// WHAT IS DUE NEXT. Read-only: every input here is something Home already computes on each render.
//
// "Next" means the soonest of: a scheduled medication whose window is open right now, and a
// scheduled medication whose window opens later today. A medication that is paused, not scheduled
// today, blocked around a treatment day, or already logged in its current window is not next --
// status() answers all four and is the single place that decides, so this cannot drift from what the
// cards below say.
//
// AS-NEEDED MEDICATIONS ARE DELIBERATELY EXCLUDED. A painkiller available every four hours is not
// "due" at any time -- it is available -- and putting one in a card headed "Up next" would tell a
// caregiver to give a dose nobody asked for. Only medications with windows can be late for anything,
// which is the same line `doseProgressToday` and the missed-dose walk already draw.
function nextDueDose(now) {
  const d0 = dayStart(now);
  let best = null;
  for (const med of state.meds) {
    if (!med) continue;
    if (!(med.windows && med.windows.length)) continue;      // as-needed: available, never due
    if (!medScheduledOn(med, now)) continue;
    if (treatmentOnlyBlocks(med, now) || treatmentExcludedNow(med, now)) continue;
    const st = status(med);
    // st.paused covers med.paused -- status() returns it on its first line -- so there is no
    // separate check for it above. Verified by deleting one and watching nothing change.
    if (st.paused || st.chemoBlock || st.courseComplete || st.noWindowToday) continue;
    // Open right now beats anything later, and among open ones the first in list order wins -- the
    // same order the cards are drawn in, so the hero always names a card the caregiver can see.
    if (!st.locked) {
      if (!best || !best.openNow) best = { med, st, openNow: true, at: now };
      continue;
    }
    if (!Number.isFinite(st.availableAt)) continue;
    if (st.availableAt < now) continue;                      // in the past: it is missed, not next
    if (st.availableAt >= nextDay(d0)) continue;             // tomorrow is not "up next" today
    if (!best || (!best.openNow && st.availableAt < best.at)) best = { med, st, openNow: false, at: st.availableAt };
  }
  return best;
}

// Dose-progress ring (item 11): 44px SVG built as an innerHTML string, matching the existing""",
    'the doseRing comment')

# ---- the card ------------------------------------------------------------------------------------
cut("""  // app-v77 phase 2: one renderer for every daily-total card. Was three copies keyed to three
  // medication ids, with two hardcoded ceilings. A medication appears here because the caregiver
  // gave it a homeCard, and it shows ITS name, ITS limit and ITS unit.""",
    """  // UP NEXT -- the first thing on Home, above the boxes that ask for a number.
  //
  // It is one card, not a screen: the medication, the dose, when, and one control that takes the
  // caregiver to the real logging card. Nothing here logs anything (see the write model in
  // harness-v80-up-next.py) and nothing here is stored.
  {
    const nx = nextDueDose(now);
    const prog = doseProgressToday(now);
    if (nx) {
      const mins = Math.max(0, Math.round((nx.at - now) / 60000));
      const whenWords = nx.openNow
        ? 'Due now'
        : mins < 60
          ? ('Due in ' + mins + ' minute' + (mins === 1 ? '' : 's'))
          : ('Due at ' + fmtTime(nx.at));
      // The dose, only where the medication actually carries one. "500 mg" is useful; an empty
      // separator where a dose would be is the app showing its own plumbing.
      const firstDose = nx.med.doses && nx.med.doses.length ? nx.med.doses[0].label : null;
      const sub = [firstDose, nx.med.sub || null].filter(Boolean).join(' · ');
      const ringPct = prog.scheduled > 0 ? Math.min(100, Math.round(prog.taken / prog.scheduled * 100)) : 0;
      parts.push(h('section', {
        'data-home': 'up-next',
        style: {
          position: 'relative', overflow: 'hidden', borderRadius: '20px', padding: '18px 18px 16px',
          color: '#FFFFFF',
          background: 'linear-gradient(152deg, #E4693B 0%, #BF4C1A 52%, #8B3C1B 100%)',
          boxShadow: '0 10px 30px -12px rgba(139,60,27,0.55), 0 1px 2px rgba(139,60,27,0.20)'
        }
      },
        // 14px of gap and a 56px ring, measured at 320: at 12/62 the medication name and the ring
        // were two pixels apart on the narrowest phone this app supports.
        h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '14px' } },
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('div', { style: { ...TYPE.label, color: 'rgba(255,255,255,0.82)' } }, 'Up next'),
            // overflowWrap, not ellipsis: a medication name is the one string on this card that must
            // never be trimmed, because it is what the caregiver is about to act on.
            h('div', { style: { fontSize: '23px', fontWeight: '800', letterSpacing: '-0.02em', lineHeight: '1.15', marginTop: '3px', overflowWrap: 'anywhere' } }, nx.med.name),
            sub ? h('div', { style: { fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.88)', marginTop: '4px' } }, sub) : null,
            h('div', { style: { fontSize: '13.5px', fontWeight: '700', color: 'rgba(255,255,255,0.95)', marginTop: '7px' } },
              whenWords + (nx.st.windowName ? ' · ' + nx.st.windowName : ''))
          ),
          prog.scheduled > 0 ? h('div', {
            role: 'img',
            'aria-label': prog.taken + ' of ' + prog.scheduled + ' scheduled doses logged today',
            style: { flexShrink: '0', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', lineHeight: '1',
              background: 'conic-gradient(#FFFFFF ' + ringPct + '%, rgba(255,255,255,0.26) 0)' }
          },
            h('div', { style: { width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(155,60,25,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2px' } },
              h('div', { style: { fontSize: '14px', fontWeight: '800', letterSpacing: '-0.02em' } }, prog.taken + '/' + prog.scheduled),
              h('div', { style: { fontSize: '8px', fontWeight: '700', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.8)' } }, 'DOSES')
            )
          ) : null
        ),
        h('button', {
          onClick: () => scrollToMedCard(nx.med.id),
          style: { marginTop: '15px', width: '100%', minHeight: '48px', borderRadius: '14px', border: '0', background: '#FFFFFF', color: '#9E3F1C', fontSize: '16px', fontWeight: '800', boxShadow: '0 3px 10px rgba(0,0,0,0.16)' }
        }, nx.openNow ? 'Go to ' + nx.med.name : 'Show me the card')
      ));
    } else if (prog.scheduled > 0 && prog.taken >= prog.scheduled) {
      // ALL DONE IS A STATE WORTH SHOWING. Without this the card simply vanishes once the last dose
      // is logged, and a screen that answers "what is due next" by disappearing looks broken at the
      // exact moment it should feel finished.
      parts.push(h('section', { 'data-home': 'up-next', style: { borderRadius: '20px', padding: '16px 18px', background: '#E9F6F0', border: '1px solid #BFE3D5', display: 'flex', alignItems: 'center', gap: '13px' } },
        h('div', { style: { flexShrink: '0', width: '38px', height: '38px', borderRadius: '50%', background: '#0F9D6B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px', fontWeight: '800' } }, '\\u2713'),
        h('div', { style: { minWidth: '0' } },
          h('div', { style: { fontSize: '16px', fontWeight: '800', color: '#0A5A40' } }, 'All scheduled doses are in'),
          h('div', { style: { fontSize: '13.5px', fontWeight: '500', color: '#2E6B55', marginTop: '2px' } },
            'Nothing else is scheduled today. As-needed medications are still available below.')
        )
      ));
    }
  }

  // app-v77 phase 2: one renderer for every daily-total card. Was three copies keyed to three
  // medication ids, with two hardcoded ceilings. A medication appears here because the caregiver
  // gave it a homeCard, and it shows ITS name, ITS limit and ITS unit.""",
    'the daily-total card loop comment')

# ---- the scroll, which is the only behaviour the hero has ---------------------------------------
cut("""function doseProgressToday(now) {""",
    """// Take the caregiver to the card that can actually log the dose. NOT a second logging path: one
// control that writes a dose is all this app should ever have, and the card below already carries
// the ceiling check, the gap check and the override flow. A focus ring is set so the destination is
// obvious to a screen reader and to anyone who cannot see the scroll happen.
function scrollToMedCard(medId) {
  const el = document.querySelector('[data-med-card="' + medId + '"]');
  if (!el) return;
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
  el.setAttribute('tabindex', '-1');
  try { el.focus({ preventScroll: true }); } catch (e) {}
  el.style.transition = 'box-shadow .25s ease';
  el.style.boxShadow = '0 0 0 3px rgba(191,76,26,0.55)';
  setTimeout(() => { el.style.boxShadow = ''; }, 1600);
}

function doseProgressToday(now) {""",
    'doseProgressToday')

# ---- the hook the hero scrolls to ---------------------------------------------------------------
# An explicit data- attribute, not a text selector or an nth-child: care-tracker Rule 5 records that
# selecting by text picked the wrong one of three buttons on a card, and a medication name is user
# text that can repeat, contain markup characters, or be empty.
# A grouped medication has no card of its own -- it is a row inside "Evening meds" -- so the hook
# goes on the group's section and the hero lands the caregiver on the card that holds it.
cut("""function renderGroupedMedsCard(title, meds, now) {""",
    """function renderGroupedMedsCard(title, meds, now) {
  // The scroll hook for every medication in the group, since none of them has a card of its own.
  // Set on the section rather than per row: the row is what the caregiver taps, the card is what
  // they need to be looking at, and landing mid-list with the heading off-screen is disorienting.
  const groupHook = {};
  meds.forEach(m => { if (m && m.id) groupHook['data-med-card-' + String(m.id).replace(/[^A-Za-z0-9_-]/g, '')] = 'group'; });""",
    'renderGroupedMedsCard')
cut("""  return h('section', { style: { overflowWrap: 'anywhere' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' } },
      h('div', { style: { ...TYPE.label, color: '#915E48' } }, title),""",
    """  return h('section', { ...groupHook, style: { overflowWrap: 'anywhere' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' } },
      h('div', { style: { ...TYPE.label, color: '#915E48' } }, title),""",
    "the grouped card's section")

# and the lookup has to know about both shapes
cut("""  const el = document.querySelector('[data-med-card="' + medId + '"]');
  if (!el) return;
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
  el.setAttribute('tabindex', '-1');
  try { el.focus({ preventScroll: true }); } catch (e) {}
  el.style.transition = 'box-shadow .25s ease';
  el.style.boxShadow = '0 0 0 3px rgba(191,76,26,0.55)';
  setTimeout(() => { el.style.boxShadow = ''; }, 1600);""",
    """  // Two shapes, because a grouped medication has no card of its own: its own card first, then the
  // group card that contains it. CSS.escape is not assumed -- the id is sanitised the same way the
  // group attribute is written, so the two always agree.
  const safe = String(medId).replace(/[^A-Za-z0-9_-]/g, '');
  const el = document.querySelector('[data-med-card="' + safe + '"]')
    || document.querySelector('[data-med-card-' + safe + ']');
  if (!el) return;
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
  // THE HIGHLIGHT LIVES IN STATE, NOT ON THE NODE. The first version set tabindex, focus and an
  // inline boxShadow directly on the element -- and this app re-renders on a one-second tick, so
  // every one of them was wiped within a second. On a phone the ring would have flashed and
  // vanished, and the caregiver would land on a card with nothing marking it. Caught by the suite
  // asserting the landing rather than the scroll.
  setState({ medFlash: safe });
  setTimeout(() => { if (state.medFlash === safe) setState({ medFlash: null }); }, 1800);""",
    "the scroll target lookup and highlight")

# ---- one progress figure per screen, not two -----------------------------------------------------
# The header ring and the hero's ring showed the same "2/4" about 800px apart on the same screen.
# Two identical figures is not redundancy the reader forgives; it reads as nobody having looked at
# the screen as a whole. The header ring stays for every OTHER tab, where it is the only place that
# number appears -- on Home the hero says it larger and next to the medication it is about.
cut("""      h('div', { style: { textAlign: 'right', flexShrink: '0', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
        doseRing(now)
      )""",
    """      h('div', { style: { textAlign: 'right', flexShrink: '0', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
        state.view === 'home' ? null : doseRing(now)
      )""",
    "the header's dose ring")

# the card reads the flash out of state, so a re-render keeps it instead of clearing it
cut("""    return h('div', { style: { background: '#FFFFFF', border: '1px solid #E9D8D1', ...(st.chemoBlock ? { borderLeft: '4px solid #C0453B' } : {}), borderRadius: '16px', padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 3px 14px rgba(203,122,87,0.10), 0 1px 2px rgba(203,122,87,0.06)' } },""",
    """    const medHook = String(med.id).replace(/[^A-Za-z0-9_-]/g, '');
    const flashed = state.medFlash === medHook;
    return h('div', { 'data-med-card': medHook, 'data-flash': flashed ? 'on' : null, style: { background: '#FFFFFF', border: '1px solid #E9D8D1', ...(st.chemoBlock ? { borderLeft: '4px solid #C0453B' } : {}), borderRadius: '16px', padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: '6px', transition: 'box-shadow .25s ease', boxShadow: flashed ? '0 0 0 3px rgba(191,76,26,0.55), 0 3px 14px rgba(203,122,87,0.10)' : '0 3px 14px rgba(203,122,87,0.10), 0 1px 2px rgba(203,122,87,0.06)' } },""",
    "the medication card wrapper")

# and the state slot it reads
cut("""let state = { entries: [], chemoDates: [], now: Date.now(), toast: null, warn: null,""",
    """let state = { medFlash: null, entries: [], chemoDates: [], now: Date.now(), toast: null, warn: null,""",
    'the state initialiser')

cut("""const APP_VERSION = 'app-v79';""", """const APP_VERSION = 'app-v80';""", 'APP_VERSION')

HTML.write_text(src, encoding='utf-8')
sw = SW.read_text(encoding='utf-8')
if 'chemowell-app-v79-1' not in sw:
    die('the sw.js cache name is not where it was')
SW.write_text(sw.replace('chemowell-app-v79-1', 'chemowell-app-v80-1', 1), encoding='utf-8')
print('up-next hero added')
