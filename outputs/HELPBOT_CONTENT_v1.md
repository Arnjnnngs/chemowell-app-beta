# HELPBOT_CONTENT_v1.md — offline troubleshooting assistant content

**Stage:** Developer (investigation + content authoring only — no app code touched)
**Date:** 2026-08-10 · **Written against:** `index.html` `APP_VERSION = 'app-v52'` (index.html:5451), `sw.js` `CACHE = 'chemowell-app-v52-4'`
**Deliverable for:** Lead Developer, to transcribe into `index.html`. Then Auditor (copy-clarity + medical-adjacent wording) and PM.

Aaron's ask: *"a very extensive list of problems it can walk a user through. much like the FAQ. but way more details to choose from… end to end app coverage"* and *"you can build it off of the FAQ and also think of anything else an inexperienced person using the app might need help with."*

No live model. No API. No network. This is a structured, offline decision tree authored from: the existing FAQ, every problem Aaron has reported in `REQUESTS.md` and `BACKLOG.md`, every finding in `outputs/AUDIT_full_app_v51.md` / `AUDIT_v52.md` / `AUDIT_v52_2.md`, every bug in README.md's version history, and a screen-by-screen walk of `index.html`.

**Count: 117 entries across 16 categories** (116 full entries plus one pointer entry, `set-units-quick`, which the Lead Developer should either render as a cross-link or merge). 9 flagged medical-adjacent. 8 NEEDS-VERIFICATION items.

---

## 1. The data shape I'm targeting

### What exists today

| Thing | Location | Shape |
|---|---|---|
| `FAQ_ITEMS` | index.html:2030–2047 | `[{ id: string, q: string, a: string }]` — 15 entries |
| `renderFaqView(now)` | index.html:5535–5558 | Maps `FAQ_ITEMS`, renders an accordion. Header + one white section + a bordered list. |
| Open-item state | `state.faqOpenId` — index.html:790 | A single id string or `null`. One item open at a time. |
| Route | index.html:2629 | `if (state.view === 'faq') return renderFaqView(now);` |
| Entry point | index.html:2467 | Drawer item `{ key: 'faq', label: 'FAQ', icon: 'help', helper: 'Common questions' }` |
| Answer rendering | index.html:5553 | `h('div', { style: { padding: '0 14px 14px', fontSize: '13px', color: '#554A52', lineHeight: '1.5' } }, item.a)` |

**Rendering constraint the Lead Developer must know:** the answer div at index.html:5553 has **no `whiteSpace: 'pre-line'`**, so `\n` inside `a` collapses to a space. Steps therefore cannot be newline-separated inside a single string — they must be a real array rendered as list items. (Precedent for the other approach exists: `renderInfoModal()` at index.html:2735 does set `whiteSpace: 'pre-line'` for its `body`.)

### What I'm proposing — extend, don't replace

`FAQ_ITEMS` stays exactly as it is. Add two new constants next to it, deliberately reusing the `id` / `q` / `a` key names so the existing accordion body in `renderFaqView` works unchanged for any topic that has no `steps`:

```js
// Help topics (app-v53, Owner-requested "troubleshooting chatbot") — a structured, fully offline
// decision tree. No model, no API, no network: the user picks a category, then a problem, and gets
// an ordered walkthrough. Extends FAQ_ITEMS' { id, q, a } shape rather than replacing it, so the
// same accordion renderer covers both. NEVER medical advice — `medical: true` topics lead with
// "contact the care team" and treat the app mechanics as secondary.
const HELP_CATEGORIES = [
  { id: 'reminders', label: 'Reminders & notifications', icon: 'help', blurb: 'Nothing arrives, arrives late, or only sometimes' },
  // …16 total, listed in §2
];

const HELP_TOPICS = [
  {
    id:       'rem-none',            // stable, kebab-case, never reused
    cat:      'reminders',           // HELP_CATEGORIES.id
    q:        'I’m not getting any reminders at all',   // same key as FAQ_ITEMS.q
    a:        'Do the battery step first, then the exact-timing step — in that order.', // same key as FAQ_ITEMS.a; renders alone if steps is absent
    steps:    ['Open ChemoWell…', 'Tap the three lines…'],  // NEW: ordered <ol>
    branches: [                                                        // NEW, optional
      { when: 'If there is no “Allow background activity” button', steps: ['…'] }
    ],
    note:     '',                    // NEW, optional: one closing sentence after the steps
    keywords: ['notification','alarm','silent','reminder'], // NEW: search terms not already in q/a
    related:  ['rem-exact-toggle-missing','rem-after-3-days'], // NEW: other topic ids
    medical:  false,                 // NEW: true => render the care-team callout ABOVE steps
    safety:   true                   // NEW: safety-relevant; Auditor must copy-check every one
  }
];
```

**Field contract**

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable. Used by `related`, and by whatever open/selected state replaces `faqOpenId`. |
| `cat` | yes | Must match a `HELP_CATEGORIES.id`. |
| `q` | yes | The line the user taps. Written as the user's own complaint, not a feature name. |
| `a` | yes | 1–3 short sentences. Must stand alone if `steps` is absent — this is the FAQ-compatible field. |
| `steps` | no | `string[]`. Each element is one thing a person does, in order. Render as `<ol>`. |
| `branches` | no | `[{ when, steps }]`. `when` is the condition in plain words ("If a pop-up appeared…"). Render after `steps`, each with its `when` as a sub-heading. |
| `note` | no | One closing sentence — a caveat or a "this is normal". |
| `keywords` | no | Search-only. Words the user might type that don't appear in `q`/`a`. |
| `related` | no | Topic ids. Render as tappable chips at the bottom. |
| `medical` | no | `true` → the walkthrough opens with a care-team callout, styled as its own block, before anything about the app. |
| `safety` | no | `true` → not user-visible; a marker so the Auditor's copy-clarity pass knows which entries carry weight. |

**Compatibility check:** a `HELP_TOPICS` entry with only `{ id, q, a }` is byte-for-byte usable by the existing `renderFaqView` map body at index.html:5545–5556. That is deliberate — it means the Lead Developer can reuse that accordion for topic bodies and only add the `<ol>`/branch/related rendering on top, rather than writing a second renderer.

### One correction to ship alongside this

`FAQ_ITEMS`' `reset` entry (index.html:2044) says *"Settings, all the way at the bottom, under Start over."* **That is wrong today.** "Start over" was moved to the **Account** view — index.html:5933–5941, with the comment *"moved from Settings — Owner-requested"*. Settings has no Start over section. The FAQ has been sending people to the wrong screen since that move. My `set-erase-all` topic below has the correct path; the FAQ string should be fixed in the same release.

---

## 2. The category list

| # | `cat` id | Label shown to the user | Entries |
|---|---|---|---|
| A | `reminders` | Reminders & notifications | 13 |
| B | `meds` | Adding & editing medications | 18 |
| C | `logging` | Logging doses | 8 |
| D | `missed` | Missed doses | 6 |
| E | `treatment` | Treatment days & radiation sessions | 5 |
| F | `vitals` | Temperature, weight, blood pressure & check-ins | 11 |
| G | `symptoms` | Symptoms & reactions | 5 |
| H | `inpatient` | Hospital stays | 5 |
| I | `reports` | History & reports | 6 |
| J | `notes` | Notes & appointments | 7 |
| K | `export` | Sharing & exporting | 6 |
| L | `profiles` | Profiles & plans | 7 |
| M | `settings` | Settings & the Home screen | 6 (5 + 1 pointer) |
| N | `tour` | The walkthrough guide | 3 |
| O | `privacy` | Your data & privacy | 4 |
| P | `app` | The app itself | 7 |
| | | **Total** | **117** |

Suggested on-screen order: `reminders` first (most-reported problem in the project's history — BACKLOG.md says so explicitly), then `meds`, `logging`, `missed`, then the rest as listed, with `app` last.

---

## 3. The content

Conventions below: **`a`** is the short answer. **Steps** are the `steps` array. **Branch** blocks are `branches`. Anything in *italics* is a note to the Lead Developer, not user-facing copy. Screen names are written the way they actually appear on screen; "the menu" always means the three lines in the top left.

---

## A. Reminders & notifications

### `rem-none` — "I'm not getting any reminders at all" · **safety** ⚑
**a:** There are two separate phone settings involved, and the order matters. Do the battery one first. That is what finally worked here, and once it was on, the exact-timing setting turned on without a fight.

**Steps**
1. Open ChemoWell. Tap the three lines in the top left, then tap **Settings**.
2. Scroll down to the part that says **Notifications**.
3. If you see **Turn on notifications**, tap it, and tap Allow when your phone asks.
4. Now look for a button that says **Allow background activity**. **Tap this one first**, before anything else. Your phone will show its own screen — choose the option that lets the app run without limits (on Samsung phones it is usually called *Unrestricted*).
5. Come back to ChemoWell. Now look for **Allow exact reminders** and tap it. Your phone opens a screen called *Alarms & reminders*. Turn the switch on.
6. Come back to Settings in ChemoWell one more time. It should now say **✓ Notifications are on**, with a line underneath telling you how many reminders are set for the next 3 days.

**Branch — "There is no Allow background activity button"**
1. That is fine. The button only appears when your phone is still holding the app back. If it isn't there, your phone is already letting ChemoWell run, and there is nothing to do on that step.
2. Carry on with the exact-timing step above.

**Branch — "It still says 0 reminders, or the count line is missing"**
1. Check that at least one of your medications actually has set times. A medication set to *As needed* never sends a reminder — it only counts hours between doses. See *"One medication never reminds me"*.
2. Check that the medication is not paused. A paused medication is not tracked and does not remind.
3. Look at the top of your Home screen for a box called **Beta date controls**. If it is showing a date that isn't today, reminders are switched off on purpose. Open that box and tap **Reset**.

**Branch — "Everything says it's on, but nothing arrives"**
1. Check your phone isn't on Do Not Disturb or a sleep/bedtime mode.
2. In your phone's own Settings, find Apps, then ChemoWell, then Notifications, and make sure they are allowed there too.
3. Open ChemoWell at least once every couple of days. Reminders are set up 3 days ahead each time you open the app — see *"My reminders stopped after I didn't open the app for a while"*.

**note:** ChemoWell can ask your phone for permission, but it can never switch these settings on for you — Android deliberately puts that in your hands.
**keywords:** notification, alarm, alert, silent, nothing, never, missing, battery, optimisation, optimization
**related:** `rem-exact-toggle-missing`, `rem-after-3-days`, `rem-no-reminder-for-med`, `rem-web-vs-app`

---

### `rem-exact-toggle-missing` — "The 'Alarms & reminders' switch isn't there, or won't turn on"
**a:** This is a known quirk on some Samsung phones. Once you say no to it, the whole section can disappear. There are two standard ways to bring it back.

**Steps**
1. First, do the battery step described in *"I'm not getting any reminders at all"* — on the phone this was tested on, that alone made the switch work.
2. If it is still missing: close ChemoWell completely (swipe it away from your recent apps), then open it again, and try the button once more.
3. If it is still missing: open your phone's Settings, tap Apps, find ChemoWell, and use the app's own force-stop option. Then open ChemoWell again.
4. If it is *still* missing: open your phone's Settings, tap Apps, tap the three dots in the top corner, and choose **Reset app preferences**. This does not delete anything — it only clears hidden permission decisions across all your apps. Then try again.

**note:** You do not have to solve this to get reminders. When exact timing is off, ChemoWell already sets every reminder a few minutes early on purpose, so an ordinary phone delay makes it arrive on time rather than late. The time you see on screen is always the real time.
**keywords:** exact, alarms and reminders, samsung, one ui, toggle, greyed out, missing, won't turn on
**related:** `rem-none`, `rem-late`

---

### `rem-late` — "The reminder came a few minutes early, or a few minutes late"
**a:** A few minutes early is on purpose. A few minutes late means your phone is delaying the app.

**Steps**
1. If it arrived **early**: that is ChemoWell doing it deliberately. When your phone hasn't granted exact timing, the app sets reminders about four minutes ahead so normal phone delays land them on time instead of late. Every time shown in the app is still the real time.
2. If it arrived **late**: go to the menu → **Settings** → **Notifications**, and do both steps in *"I'm not getting any reminders at all"* — background activity first, then exact reminders.
3. Once the app says exact timing is allowed, it stops setting reminders early and uses the exact time you chose.

**note:** If one particular medication truly cannot be late, it is still safest to set its reminder a few minutes ahead yourself.
**keywords:** early, late, wrong time, minutes, delayed
**related:** `rem-none`, `rem-exact-toggle-missing`

---

### `rem-web-vs-app` — "I'm using ChemoWell in a web browser, not the installed app"
**a:** In a browser, reminders only work while ChemoWell is actually open on screen. They cannot reach you with the phone locked or the tab closed.

**Steps**
1. Check which one you have: the installed app opens on its own, with no address bar at the top.
2. If you are in a browser and you need reminders while the phone is locked or put away, you need the installed app version.
3. In the browser version, everything else works exactly the same — logging, history, reports, exports. Only background reminders are limited.

**keywords:** browser, chrome, website, tab, locked, installed, apk
**related:** `rem-none`

---

### `rem-after-3-days` — "My reminders stopped after I didn't open the app for a while"
**a:** ChemoWell sets up reminders three days ahead every time you open it. If the app isn't opened for longer than that, the queue runs out.

**Steps**
1. Just open ChemoWell. That alone refills the next three days of reminders.
2. To check it worked: menu → **Settings** → **Notifications**. It should say how many reminders are scheduled over the next 3 days, and when the next one is.
3. Try to open the app at least every couple of days, even briefly.

**keywords:** stopped, ran out, vacation, away, three days, 72 hours
**related:** `rem-none`

---

### `rem-none-scheduled` — "It says 'No reminders are currently due in the next 3 days'"
**a:** That means the app is working fine — there is genuinely nothing to remind you about in that window.

**Steps**
1. This is normal if all your medications are *As needed*. Those never send reminders; they only track the hours between doses.
2. It is also normal if your medications are set to specific days of the week, and none of those days fall in the next three days.
3. It is also what you'll see if every medication is paused.
4. If you expected a reminder, open the **Meds** tab, tap the medication, and check it is set to **Scheduled** with at least one time listed under *Schedule windows*.

**keywords:** no reminders, none due, empty, zero
**related:** `rem-no-reminder-for-med`

---

### `rem-paused-sim` — "It says reminders are paused because of the beta date controls"
**a:** There is a testing box on Home that lets you pretend it is a different day. While that is on, reminders are switched off so your phone doesn't get alerts at the wrong real-world time.

**Steps**
1. Go to **Home** and look near the top for a box labelled **Beta date controls**.
2. Tap it to open it.
3. Tap **Reset**.
4. The date at the top of the screen goes back to today, and reminders start working again.

**keywords:** beta, date controls, simulated, paused, test date
**related:** `set-beta-date-controls`

---

### `rem-blocked` — "It says notifications are blocked for ChemoWell"
**a:** Your phone is refusing notifications for this app. It has to be turned back on in your phone's own settings.

**Steps**
1. Menu → **Settings** → **Notifications** → tap **Try again**.
2. If nothing happens, your phone has stopped asking. Open your phone's own Settings, tap Apps, find ChemoWell, tap Notifications, and turn them on there.
3. Come back to ChemoWell and open Settings again. It should now say **✓ Notifications are on**.

**keywords:** blocked, denied, refused, permission
**related:** `rem-none`

---

### `rem-failed` — "It says reminders couldn't be set on this device"
**a:** Something went wrong while arming the reminders. Your existing reminders are untouched — this only stops new ones being set.

**Steps**
1. Menu → **Settings** → **Notifications** → tap **Try again**.
2. If it fails again, close ChemoWell completely and open it again, then try once more.
3. If it keeps failing, restart the phone and try again.

**keywords:** failed, error, couldn't set, try again
**related:** `rem-none`

---

### `rem-no-reminder-for-med` — "One particular medication never reminds me"
**a:** Reminders only go out for medications set to **Scheduled** with real times on them. Several settings can also switch them off for that one medication.

**Steps**
1. Open the **Meds** tab and tap that medication to open it.
2. Check **Schedule type**. If it says *As needed*, it will never remind you — that mode only counts hours between doses. Change it to *Scheduled* if you want reminders.
3. Check **Schedule windows**. There must be at least one time listed. Each row is one reminder.
4. Check **Days taken**. If it's set to particular days of the week, or every few days, it only reminds on those days. If it's set to *As needed — don't flag missed doses*, it never reminds.
5. Check whether the medication is **Paused**. A paused medication is not tracked and sends nothing. Open it and tap **Resume** if that's wrong.
6. Check **Treatment-day availability**. If it's set to only appear near your treatment day, or to be excluded around it, that also controls when it reminds you.

**keywords:** one medication, specific, not reminding, no alert
**related:** `med-asneeded-vs-scheduled`, `med-days-taken`, `med-pause-resume`, `med-treatment-availability`

---

### `rem-appointment` — "My appointment reminder never came"
**a:** Appointment reminders use the same phone settings as dose reminders, plus one setting on the appointment itself.

**Steps**
1. Menu → **Calendar**. Find the appointment and open it.
2. Check the reminder setting. If it says **No reminder**, that's why. Change it to *At the scheduled time*, *1 hour before*, *The morning of (9 AM)*, *1 day before*, or a custom lead time.
3. Save the appointment.
4. If it's set correctly and still didn't arrive, work through *"I'm not getting any reminders at all"* — it's the same phone permissions.

**keywords:** appointment, calendar, doctor visit, reminder
**related:** `rem-none`, `appt-reminder-choose`

---

### `rem-checkin-time` — "I want the daily check-in reminder at a different time"
**a:** There's one shared reminder time for the daily check-in, and it can only be set between 8 AM and 10 PM.

**Steps**
1. Menu → **Settings** → **Home screen**.
2. Make sure at least one of *Weight in daily check-in*, *Bowel movement in daily check-in*, or *Appetite in daily check-in* is switched on. The time field only appears once one of them is.
3. Underneath, tap **Daily check-in reminder time** and pick a time.
4. It asks once a day, about that day — it will not keep nagging you about yesterday.

**note:** The check-in reminder is deliberately limited to daytime hours. Dose reminders are not — those fire at any hour.
**keywords:** check-in, daily, time, overnight, 8am, 10pm
**related:** `vit-checkin-modal`

---

### `rem-silent` — "The reminder appeared but made no sound"
**a:** Sound and vibration for notifications are controlled by your phone, not by ChemoWell.

**Steps**
1. Check the phone isn't on silent, vibrate-only, Do Not Disturb, or a bedtime/sleep mode.
2. Open your phone's own Settings, tap Apps, find ChemoWell, then Notifications.
3. ChemoWell uses separate notification categories for dose reminders, appointment reminders, and the daily check-in. Open each one and check its sound and importance settings.

**keywords:** silent, no sound, vibrate, quiet, mute
**related:** `rem-none`

---

### `rem-tap-notification` — "I tapped the reminder and I'm not sure what it did"
**a:** Tapping a reminder brings ChemoWell to the front. It does not log the dose for you.

**Steps**
1. After tapping the reminder, you land in the app.
2. Go to **Home** and find the medication's card.
3. Tap the dose button on that card to actually record it.
4. Nothing is recorded until you tap that button — a reminder is only a nudge.

**keywords:** tap, open, notification, does it log
**related:** `log-basic`

---

## B. Adding & editing medications

### `med-add-first` — "How do I add a medication?"
**a:** Meds tab, then Add. The only thing you truly have to fill in is the name and how it's taken.

**Steps**
1. Tap **Meds** at the bottom of the screen.
2. Tap **Add**.
3. Type the **Medication name**. This is what you'll see everywhere in the app, so use whatever you call it day to day.
4. Choose **Schedule type**: *As needed* if it's taken whenever it's needed with a wait in between (like a painkiller every 4 hours), or *Scheduled* if it's taken at set times.
5. Fill in the rest as far as you want — you can come back and change any of it later.
6. Tap **Add medication** at the bottom.

**note:** Enter exactly what the care team prescribed. ChemoWell only ever repeats back what you typed in — it never checks or suggests a dose.
**keywords:** add, new, create, first medication
**related:** `med-asneeded-vs-scheduled`, `med-dose-options`, `med-save-blocked`

---

### `med-asneeded-vs-scheduled` — "What's the difference between 'As needed' and 'Scheduled'?"
**a:** *As needed* counts hours since the last dose. *Scheduled* uses set times of day and can remind you.

**Steps**
1. Pick **As needed** for something taken only when it's needed. You then set **Hours between doses**, and the card on Home locks until that many hours have passed.
2. Pick **Scheduled** for something taken at set times. You then add one or more times under **Schedule windows**, and each one can send a reminder.
3. A scheduled medication can also have a minimum gap on top of its times, if doses shouldn't land too close together.
4. Only *Scheduled* medications can be flagged as missed. *As needed* ones never are — there's no set time for them to be late for.

**keywords:** as needed, prn, scheduled, difference, which one
**related:** `med-gap-hours`, `med-windows`

---

### `med-dose-options` — "What goes in 'Dosage options', and why are there commas?"
**a:** These become the buttons you tap to log a dose. A comma separates different strengths of the same medication.

**Steps**
1. Type the amount the way you'd say it: `500 mg`.
2. If the same medication comes in more than one strength, separate them with a comma: `500 mg, 1000 mg`. You get one button for each.
3. Those strengths share one schedule and one daily limit — they're the same medication, just different amounts.
4. It doesn't have to be milligrams. `1 patch, 2 patches`, `2 sprays`, `1 capsule` all work.
5. You can leave this blank. You'll still get a plain Log button, just without a specific amount recorded.

**keywords:** dosage, comma, strengths, mg, buttons, amount
**related:** `med-daily-limit-locked`, `med-limit-unit`

---

### `med-daily-limit-locked` — "The Daily limit box is greyed out and says 'Locked'" · **safety** ⚑
**a:** Daily limit stays locked until Dosage options above it contains an amount in the same unit you picked for Limit unit. This is the single most-reported sticking point in this screen.

**Steps**
1. Look at **Limit unit**, just above Dosage options. It's one of: *Total milligrams (mg)*, *Number of pills / doses*, or *Number of applications*.
2. If Limit unit is **Total milligrams (mg)**, Dosage options must contain a number followed by the letters `mg` — for example `500 mg`. A bare `500` will not unlock it.
3. If Limit unit is **Number of pills / doses** or **Number of applications**, any entry that starts with a number counts — `2 tabs`, `1 patch`, `2 sprays` all work.
4. Fix Dosage options, and the Daily limit box unlocks straight away. You don't need to save first.
5. The amber warning underneath Dosage options disappears at the same moment.

**Branch — "I don't want a daily limit at all"**
1. Leave Daily limit blank. The medication saves fine without one.
2. The amber warning line is just explaining why the box is locked. It is not blocking the save.

**note:** A daily limit only blocks logging once the number is reached. You can always log past it by tapping the button that appears and confirming — ChemoWell never refuses to record something that really happened.
**keywords:** locked, greyed, disabled, daily limit, warning, banner, can't type
**related:** `med-limit-unit`, `med-dose-options`, `log-anyway-override`

---

### `med-limit-unit` — "Which Limit unit should I pick?"
**a:** Pick the thing you'd actually count at the end of the day.

**Steps**
1. Choose **Total milligrams (mg)** when the care team gave you a maximum in milligrams — for example "no more than 3000 mg of paracetamol in 24 hours".
2. Choose **Number of pills / doses** when the limit is a number of tablets or capsules.
3. Choose **Number of applications** for creams, patches, sprays, and drops.
4. Whichever you choose, Dosage options above has to carry an amount in that same unit — see *"The Daily limit box is greyed out"*.

**note:** The list is currently only those three. More units (mcg, mL, puffs, drops, and others) are planned.
**keywords:** limit unit, mg, pills, applications, which
**related:** `med-daily-limit-locked`

---

### `med-gap-hours` — "What is 'Hours between doses' / minimum gap?"
**a:** It's the shortest time the app will wait before letting you log that medication again.

**Steps**
1. For an **As needed** medication, this is required. Without it the card would never lock after a dose. Type the number of hours, like `4`.
2. For a **Scheduled** medication it's optional, and it sits on top of the set times — it stops a dose being logged again too soon after the last one.
3. While the gap is running, the card on Home shows *Waiting* and tells you when the next dose opens.
4. You can still log early if there's a real reason — tap the button and confirm. It's recorded as an early dose.

**keywords:** gap, hours between doses, minimum, waiting, too soon
**related:** `log-button-locked`, `log-anyway-override`

---

### `med-save-blocked` — "It won't let me save the medication"
**a:** A message appears at the bottom of the screen saying exactly what's missing. Here's what each one means.

**Steps**
1. *"Enter a medication name before saving."* — the name field is empty.
2. *"Enter a minimum gap in hours…"* — an *As needed* medication needs **Hours between doses** filled in, otherwise its card would never lock after a dose.
3. *"Add at least one schedule time…"* — a *Scheduled* medication needs at least one row under Schedule windows. Tap **+ Add another time window**.
4. *"Pick at least one day of the week, or switch Days taken to Every day."* — Days taken is set to specific weekdays but none are selected.
5. *"Every-few-days schedules need a gap of at least 2 days."* — the *Every few days* option needs a number of 2 or more.
6. Fix whichever one it named, then tap the save button again.

**note:** A locked Daily limit box does **not** block saving. That one is explained in *"The Daily limit box is greyed out"*.
**keywords:** won't save, error, blocked, toast, message, red
**related:** `med-daily-limit-locked`

---

### `med-days-taken` — "This medication isn't taken every day"
**a:** The **Days taken** setting handles that.

**Steps**
1. Open the **Meds** tab, tap the medication.
2. Find **Days taken** and choose one:
3. *Every day* — the normal case.
4. *Specific days of the week* — then tap the day buttons for the days it's taken.
5. *Every few days* — for every-other-day or similar. Set the number (2 or more) and the day it starts from.
6. *As needed — don't flag missed doses* — available any day, and never flagged as missed.
7. On a day it isn't scheduled, its card on Home says **Not scheduled today** with a button to log it anyway if you need to.

**keywords:** days, weekly, every other day, not daily, schedule days
**related:** `log-off-day`

---

### `med-windows` — "What does 'Reminds at' mean under Schedule windows?"
**a:** Each row is one reminder — a single time of day, not a stretch of time.

**Steps**
1. Open the medication and look under **Schedule windows**.
2. Each row shows one time, and you can give it a name like *Morning* or *With breakfast*.
3. That time is when the reminder goes out.
4. To add another daily dose, tap **+ Add another time window**.
5. To remove one, tap the remove button on that row.

**note:** How these times relate to missed doses is explained in *"When does a dose count as missed?"*.
**keywords:** reminds at, windows, times, twice a day, morning, evening
**related:** `miss-what-counts`

---

### `med-placement` — "Where does this medication show up on Home?"
**a:** The **Home screen placement** setting decides that.

**Steps**
1. Open the medication and find **Home screen placement**.
2. *Own Home card* — it gets its own card in the **Quick log** section.
3. *Morning group* / *Afternoon group* / *Evening group* — it joins a shared card with the others in that group, which also has a **Take all** button.
4. *No Home card* — it's tracked and kept in the Meds list, but doesn't appear on Home at all. Use this for something you want on record but don't log daily.
5. Save, then go to Home to see it in its new place.

**keywords:** home, placement, card, group, morning, evening, hidden
**related:** `med-not-on-home`, `log-group-take-all`

---

### `med-treatment-availability` — "What is 'Treatment-day availability'?"
**a:** It lets a medication appear only around your treatment day, or be blocked around it.

**Steps**
1. Open the medication and find **Treatment-day availability**.
2. *Always available* — no restriction. This is the normal setting.
3. *Only near treatment day* — it only appears on Home for a window of days around your treatment date, and is hidden the rest of the time.
4. *Excluded near treatment day* — the opposite: it's greyed out and can't be logged for a window of days around your treatment date.
5. For either of the last two, set **Days before** and **Days after** to define the window. The line underneath shows the window in plain words as you type.
6. This only does anything once a treatment date is set on Home. Until then, the medication just shows every day with an amber **No date set** label.

**note:** If your profile's treatment type is *Other*, this whole section isn't shown — an "Other" profile has no treatment day in the sense this feature means.
**keywords:** treatment day, only near, excluded, window, days before, days after
**related:** `treat-set-date`, `med-not-on-home`

---

### `med-pause-resume` — "I want to stop a medication for a while without deleting it"
**a:** Pause it. Everything is kept, and it stops being tracked or reminding you until you resume.

**Steps**
1. Open the **Meds** tab and tap the medication.
2. Tap **Pause** at the bottom.
3. On Home its card stays visible, marked **Paused**, with a **Resume** button.
4. While it's paused it sends no reminders and is never flagged as missed.
5. When it's time to start again, tap **Resume** — on the Home card or in the editor.

**note:** The days it was paused are remembered, so old missed-dose counts don't change retroactively.
**keywords:** pause, stop, hold, temporarily, resume, restart
**related:** `miss-false-missed`

---

### `med-edit-delete` — "How do I change or delete a medication?"
**a:** Meds tab, tap the medication to edit it. Deleting is a two-tap confirm.

**Steps**
1. Tap **Meds** at the bottom.
2. Tap the medication you want to change.
3. Change whatever you need, then tap **Save changes**.
4. To delete it instead, use the delete option and confirm when it asks. It will tell you this can't be undone.
5. Deleting a medication does not delete the doses you already logged — those stay in your history and in your exports.

**keywords:** edit, change, delete, remove, medication
**related:** `med-pause-resume`

---

### `med-not-on-home` — "I added a medication but I can't find it on Home"
**a:** Work through these in order — one of them is almost always it.

**Steps**
1. Is the **Quick log** heading collapsed? Look for a small arrow next to it. If it shows a number in brackets, tap it to open it back up.
2. Is it in a group? Scroll further down Home for **Morning meds**, **Afternoon meds**, or **Evening meds**.
3. Open the **Meds** tab and tap the medication. Check **Home screen placement** — if it's *No Home card*, that's why.
4. Check whether it's **Paused**.
5. Check **Days taken** — if today isn't one of its days, it shows as *Not scheduled today* rather than a normal card.
6. Check **Treatment-day availability** — if it's *Only near treatment day* and today is outside that window, it's hidden on purpose.
7. Are you looking at the right person? Tap the three lines in the top left and check the name at the top.

**keywords:** missing, disappeared, can't find, not showing, gone, home
**related:** `med-placement`, `treat-set-date`, `pro-switch`

---

### `med-generic-name` — "What's the Generic name field for?"
**a:** It's optional. It's there so a brand name and its generic name both make sense later.

**Steps**
1. Put the name you use day to day in **Medication name** — that's what appears everywhere in the app.
2. Put the other name in **Generic name** if it helps, for example the brand name when you've used the generic as the main name.
3. It's purely for your own reference and for anyone reading your exported records.

**keywords:** generic, brand, other name, alternative
**related:** `med-add-first`

---

### `med-notes-field` — "Where do I put instructions like 'take with food'?"
**a:** The **Notes** field at the bottom of the medication editor. It shows on the medication's card on Home.

**Steps**
1. Open the **Meds** tab and tap the medication.
2. Scroll to **Notes** at the bottom.
3. Type anything useful — *Take with food*, *From Dr. Kim*, *Crush if needed*.
4. Save. It appears under the medication's name on Home so it's in front of you when you log.

**keywords:** notes, instructions, with food, reminder text
**related:** `note-add`

---

### `med-reorder` — "I want my medications in a different order on Home"
**a:** The Meds tab has up and down arrows for that.

**Steps**
1. Tap **Meds** at the bottom.
2. Find the section about Home screen order.
3. Use the small ▲ and ▼ arrows next to each medication to move it.
4. Go to Home to see the new order.

**note:** Those arrow buttons are small. If you keep missing them, try tapping slightly lower and to the centre of the button.
**keywords:** order, reorder, sort, move, arrange
**related:** `med-placement`

---

### `med-many-strengths` — "The same medication comes in two strengths"
**a:** That's one medication with two dose buttons, not two medications.

**Steps**
1. Add it once.
2. In **Dosage options**, list both with a comma: `500 mg, 1000 mg`.
3. On Home you get a button for each strength.
4. They share one schedule, one gap timer, and one daily limit — because they're the same medication.

**keywords:** two strengths, half tablet, different doses, same medication
**related:** `med-dose-options`

---

## C. Logging doses

### `log-basic` — "How do I record that a dose was taken?"
**a:** Tap the dose button on that medication's card on Home.

**Steps**
1. Go to **Home**.
2. Find the medication under **Quick log**, or inside its Morning/Afternoon/Evening card.
3. Tap the button showing the amount that was taken.
4. If it asks you to confirm, tap Confirm.
5. It appears immediately in **Today's journal** further down the Home screen.

**keywords:** log, record, taken, dose, tap
**related:** `log-wrong-time`, `log-remove`

---

### `log-button-locked` — "The Log button is greyed out or won't do anything"
**a:** The card tells you which rule is holding it, in the words on the card itself.

**Steps**
1. **Waiting** — the minimum gap since the last dose hasn't passed. The card says when it opens.
2. **Limit** — today's daily limit has been reached. It resets after midnight.
3. **Restricted** — a hospital stay is currently marked as active, so home logging is paused. End the stay on the **In-Patient** tab if that's wrong.
4. **Not scheduled today** — today isn't one of this medication's days.
5. **Outside its treatment-day window** — the medication is set to only appear near your treatment day, and today isn't in that window.
6. **Paused** — tap **Resume**.
7. In every one of these cases except Paused and Restricted, there's a button to log it anyway. See *"How do I log something the app is blocking?"*.

**keywords:** greyed, disabled, locked, won't log, blocked, waiting, limit
**related:** `log-anyway-override`, `ip-meds-restricted`

---

### `log-anyway-override` — "How do I log something the app is blocking?" · **safety** ⚑
**a:** Every lock in ChemoWell can be overridden. It records what happened rather than pretending it didn't.

**Steps**
1. On the blocked card, tap the button that appears — the wording depends on the reason, for example *Daily limit of 3,000 mg reached. Log more anyway?*
2. Read what it says. It names the rule you're about to go past.
3. Tap the dose amount and confirm.
4. The dose is recorded with a small label — **Early**, **Over limit**, or both — so it's clear later that it was outside the usual rule.
5. That label shows up in History and in the records you export.

**note:** ChemoWell's limits are only what you typed in when you set up the medication. They are not medical guidance. If you're unsure whether a dose is safe, that's a question for the care team or the pharmacist, not for the app.
**keywords:** override, anyway, force, ignore, past limit, early
**related:** `med-daily-limit-locked`, `med-gap-hours`

---

### `log-double-tap` — "I think I logged the same dose twice"
**a:** Check Today's journal — the app is built to ignore a double-tap, so there's often nothing wrong.

**Steps**
1. Scroll down Home to **Today's journal**.
2. Look at the time the dose was recorded. A genuine double-tap does not create two rows.
3. If there really are two rows and one is wrong, tap **Remove** next to it and confirm.
4. If Remove isn't there, the entry is more than 48 hours old — see *"I logged something by mistake"*.

**keywords:** twice, duplicate, double, two entries, accidental
**related:** `log-remove`

---

### `log-wrong-time` — "I forgot to log a dose at the time — can I put in the right time?"
**a:** Yes. When the app asks for the time, change it before confirming.

**Steps**
1. Log the dose the normal way.
2. When the date and time screen appears, tap the time and set it to when it was actually taken.
3. You can change the date too if it was a different day.
4. Tap **Confirm**.
5. If you set a time in the future, it warns you and asks you to press Confirm again — that's deliberate.

**note:** Blood pressure is the one exception: it records immediately with no time screen, so it can't be backdated from Home.
**keywords:** wrong time, backdate, past, earlier, yesterday, forgot
**related:** `log-forgot-yesterday`, `vit-bp-log`

---

### `log-remove` — "I logged something by mistake"
**a:** You can remove it from History, but medication doses lock after 48 hours.

**Steps**
1. Tap **Reports** at the bottom, then **History**.
2. Find the entry on its day.
3. Tap **Remove** next to it, then tap **Delete** to confirm.
4. If **Remove** isn't there, that entry is a medication dose older than 48 hours, and it's now permanent history. That's on purpose — a medication record shouldn't be quietly rewritable days later.
5. Weight, blood pressure, bowel, appetite, symptoms, period markers and radiation sessions can be corrected at any time, however old.

**note:** Temperature currently follows the medication rule, so a temperature older than 48 hours can't be removed. That's a known gap.
**keywords:** mistake, delete, remove, undo, wrong entry, 48 hours
**related:** `vit-temp-cant-remove`

---

### `log-forgot-yesterday` — "I forgot to log yesterday's doses"
**a:** Log them now and set the time back, or resolve them from the missed-dose list.

**Steps**
1. If the dose is showing as missed: tap **Reports** → **History**, switch to the missed-dose view, find it, and tap **Took later**.
2. If it isn't showing as missed: log it from Home and change the date and time on the confirm screen to when it actually happened.
3. Either way it lands on the right day in History and in your exports.

**keywords:** forgot, yesterday, catch up, behind, late
**related:** `miss-resolve`, `log-wrong-time`

---

### `log-group-take-all` — "What does 'Take all' do on the Morning/Evening card?"
**a:** It logs every medication in that group at once, for the ones that are currently due.

**Steps**
1. On Home, find the **Morning meds**, **Afternoon meds** or **Evening meds** card.
2. Check the list of names on it first.
3. Tap **Take all** to log them together.
4. Anything in that group that's locked, paused, or not scheduled today is skipped rather than logged.
5. To log just one of them, tap that medication's own **Log** button on the same card instead.

**keywords:** take all, group, all at once, morning meds
**related:** `med-placement`

---

## D. Missed doses

### `miss-what-counts` — "When does a dose count as missed?"
**a:** A reminder stays open, not missed, until the next reminder for that medication that day — or until midnight if it was the last one.

**Steps**
1. Say a medication has reminders at 8 AM and 2 PM. The 8 AM one stays open until 2 PM.
2. If a dose is logged at any point before 2 PM, the 8 AM reminder counts as covered, even though it was late.
3. If nothing is logged by 2 PM, the 8 AM one is flagged missed.
4. The last reminder of the day stays open until midnight.
5. *As needed* medications are never flagged missed — there's no set time for them to be late for.

**keywords:** missed, when, rules, grace, late, counts
**related:** `miss-resolve`, `miss-false-missed`

---

### `miss-resolve` — "How do I clear a missed dose?"
**a:** Every missed dose has three buttons — Took later, Skipped, and Clear. They mean different things.

**Steps**
1. Tap the red missed-dose banner on Home, or go to **Reports** → **History** and switch to the missed-dose view.
2. Find the row and choose one:
3. **Took later** — the dose was given, just late. This records a real dose.
4. **Skipped** — it was deliberately not given. This records that decision, permanently.
5. **Clear** — just remove the flag. Nothing is recorded. Use this when it was logged another way, or it was never really due.
6. The count on the banner goes down as you resolve each one.

**keywords:** clear, resolve, took later, skipped, missed dose, banner
**related:** `miss-clear-all`

---

### `miss-banner` — "There's a red 'missed doses' banner and I can't get rid of it"
**a:** Tap the banner itself — it takes you to the list where each one can be resolved.

**Steps**
1. Tap the red banner on Home. It opens History filtered to missed doses only.
2. Resolve each row with **Took later**, **Skipped** or **Clear**.
3. For today's misses, the banner also has its own **Clear** button that dismisses just that banner without touching the underlying record.
4. Once every miss is resolved, the banner goes away and stays away, including after closing and reopening the app.

**keywords:** red banner, won't go away, missed, stuck, alert
**related:** `miss-resolve`, `miss-clear-all`

---

### `miss-clear-all` — "I've got weeks of missed doses and I don't want to tap them one by one"
**a:** There's a Clear all button in the missed-dose view.

**Steps**
1. Tap **Reports** → **History**.
2. Switch to the missed-dose view.
3. Tap **Clear all** at the top.
4. This only clears the flags. It doesn't delete anything you actually logged.

**note:** If you have many months of misses, this screen can get very slow to open and respond. If it feels stuck, give it several seconds before tapping again.
**keywords:** clear all, backlog, many, weeks, catch up
**related:** `rep-history-slow`

---

### `miss-false-missed` — "It says I missed doses that I didn't"
**a:** A few situations cause that, and most of them have a setting behind them.

**Steps**
1. Was the person in hospital those days? Log the stay on the **In-Patient** tab — days inside a hospital stay are never flagged as missed.
2. Was the medication paused then? Pausing only stops flags from the moment you pause. It doesn't rewrite the past.
3. Is the medication actually taken every day? Check **Days taken** in the medication editor — if it's only certain days, set that, and the other days stop being flagged.
4. Was it logged, just at a different time? Check **Reports** → **History** for that day.
5. If none of these fit, use **Clear** on each row to dismiss the flag without recording anything.

**keywords:** false, wrong, didn't miss, incorrect, hospital, paused
**related:** `ip-start-end`, `med-days-taken`, `med-pause-resume`

---

### `miss-real-missed` — "A dose was genuinely missed — what should I do?" · **MEDICAL-ADJACENT** ⚕
**a:** **Contact the care team.** Whether to take a missed dose late, skip it, or double up is a medical decision, and it depends on the specific medication. ChemoWell cannot answer that, and it will never suggest an answer.

**Steps**
1. Call the care team, the on-call number, or the pharmacist. If it's a chemotherapy or other treatment medication, do that now rather than waiting for the next appointment.
2. Once you know what they want you to do, come back to the app to record what actually happened.
3. If the dose was given late: **Reports** → **History** → missed-dose view → **Took later**.
4. If it was deliberately skipped: same place, tap **Skipped**.
5. Add a note if there's anything worth remembering — menu → **Notes**.

**note:** ChemoWell records what you tell it. It does not give dosing guidance of any kind.
**keywords:** missed, what do i do, skip, double, catch up, chemo
**related:** `miss-resolve`, `note-add`

---

## E. Treatment days & radiation sessions

### `treat-set-date` — "How do I set a treatment date?"
**a:** On Home, in the Treatment schedule card.

**Steps**
1. Go to **Home** and find the card headed **Treatment schedule**.
2. Tap the row underneath it that says **Pick a date**.
3. A small calendar opens. Tap the day.
4. Tap **Set date** (or **Update** if there was already one).
5. The card now shows the date and a countdown.

**note:** After you set it, the row underneath may still read "Pick a date". That's a known display quirk — the date at the top of the card is the one that counts.
**keywords:** treatment date, chemo date, set, pick, calendar
**related:** `treat-clear`, `med-treatment-availability`

---

### `treat-clear` — "I need to change or remove the treatment date"
**a:** Setting a new date replaces the old one. There's a separate Clear for removing it entirely.

**Steps**
1. On **Home**, find the **Treatment schedule** card.
2. To change it: tap the date row, pick the new day, tap **Update**.
3. To remove it: tap **Clear** in the top right of the card, then tap it again to confirm.
4. Anything set to only appear near your treatment day goes back to showing every day, with an amber **No date set** label.

**keywords:** change, clear, remove, wrong date, reschedule
**related:** `treat-set-date`

---

### `treat-no-card` — "I can't find the Treatment schedule card"
**a:** It's a card you can switch off, and on radiation-only profiles it starts off.

**Steps**
1. Tap the three lines in the top left, then **Settings**.
2. Find **Home screen**.
3. Switch on **Treatment schedule card**.
4. Go back to **Home** — the card is there now.

**keywords:** missing, no card, treatment schedule, radiation, hidden
**related:** `set-card-missing`

---

### `treat-other-profile` — "I picked 'Other' as the treatment type and the wording is different"
**a:** That's deliberate. An "Other" profile talks about *your date* instead of *treatment day*, and the treatment-day availability setting isn't offered at all.

**Steps**
1. You can still use the **Treatment schedule** card on Home for an appointment or any date worth counting down to.
2. In the medication editor, there's no treatment-day availability section for an "Other" profile — that's on purpose, since there's no treatment day in the sense that setting means.
3. If a medication you set up before shows leftover *Days before* / *Days after* boxes, they're being ignored. They're a leftover from an earlier version.

**note:** There's currently no way to change a profile's treatment type after setup. If you picked the wrong one, the only route today is to create a new profile — which means starting that person's history again. That's a known gap.
**keywords:** other, treatment type, wording, your date, not chemo
**related:** `pro-wrong-treatment-type`

---

### `treat-radiation` — "How do I track radiation sessions?"
**a:** The Radiation sessions card on Home, with a one-tap log.

**Steps**
1. Go to **Home** and find the **Radiation sessions** card. It only appears for profiles that include radiation.
2. Tap the button to log today's session.
3. To record how many sessions are planned in total, enter the planned total on that card (1 to 99). The counter then shows something like *3 / 20 sessions completed*.
4. To add a session you forgot, tap the **+** on that card and set the date.
5. The full list is under **Reports** → **Radiation**.

**Branch — "The card isn't there"**
1. Menu → **Settings** → **Home screen** → switch on **Radiation sessions card**.

**keywords:** radiation, sessions, counter, planned, total
**related:** `set-card-missing`

---

## F. Temperature, weight, blood pressure & check-ins

### `vit-temp-log` — "How do I record a temperature?"
**a:** The Temperature card on Home.

**Steps**
1. Go to **Home** and find the **Temperature** card.
2. Type the reading into the box.
3. Tap **Log**.
4. Set the date and time if it wasn't just now, then confirm.
5. The last reading shows at the top right of that card.

**keywords:** temperature, temp, fever, log, record
**related:** `vit-temp-rejected`, `vit-units`

---

### `vit-temp-high` — "The temperature is high — what should I do?" · **MEDICAL-ADJACENT** ⚕
**a:** **Contact the care team now.** For someone on chemotherapy, a fever can be an emergency, and it is not something to look up in an app. Call the number the care team gave you, or the on-call line, straight away.

**Steps**
1. Call the care team, the on-call oncology number, or your local emergency number if the person is very unwell.
2. Do not wait for a reminder, an appointment, or anything in this app.
3. Once the person is being looked after, record the reading in ChemoWell so there's a record of when it happened.
4. Add a note about anything else you noticed — menu → **Notes**.

**note:** ChemoWell shows temperature readings in a different colour when they're high, but the colour is only a visual cue. It is not an assessment, and there is no threshold in this app that means "it's fine".
**⚑ Lead Developer:** this is the entry the Auditor flagged as needing a real clinician/copywriter pass (`AUDIT_full_app_v51.md`, M-6). Do not soften the "call now" wording, and do not add any number or threshold to it.
**keywords:** fever, high temperature, 100.4, 38, hot, emergency
**related:** `vit-temp-log`

---

### `vit-temp-rejected` — "It won't accept the temperature I typed"
**a:** There's a sensible range, and it's checking which unit you're in.

**Steps**
1. If you're in Fahrenheit, it accepts roughly 86 to 113.
2. If you get an error, check whether the app is set to the unit you're reading — menu → **Settings** → **Units**.
3. Check for a stray extra digit — 1014 instead of 101.4 is the usual culprit.
4. Retype it and tap **Log** again.

**keywords:** invalid, won't accept, error, range, celsius, fahrenheit
**related:** `vit-units`

---

### `vit-temp-cant-remove` — "I typed a temperature wrong and there's no Remove button"
**a:** Temperature entries lock after 48 hours, the same as medication doses.

**Steps**
1. Go to **Reports** → **History** and find the entry.
2. If it's less than 48 hours old, tap **Remove** and confirm.
3. If it's older, it can't be removed today. Log the correct reading with the right date and time so the true reading is on record alongside it.
4. Add a note explaining the wrong one — menu → **Notes**.

**note:** This is a known gap. Weight and blood pressure can be corrected at any age; temperature currently can't.
**keywords:** wrong temperature, can't remove, typo, 48 hours, locked
**related:** `log-remove`

---

### `vit-weight-log` — "How do I record a weight, and why does it ask for a reason?"
**a:** The Weight card on Home. The reason is optional, and it exists because weight can move fast for reasons that aren't about eating.

**Steps**
1. Go to **Home** and find the **Weight** card.
2. Type the weight and tap **Log**.
3. A **Reason for change** list appears. It's optional — skip it if nothing applies.
4. Choose from things like fluid drained, fluid retention, poor appetite, nausea, steroid medication, illness, or eating more.
5. If you pick **Paracentesis (fluid drained)**, an extra box appears for how many litres were drained.
6. There's a free-text note too. All of it shows up in the Weight report.

**keywords:** weight, reason, paracentesis, fluid, litres, drained
**related:** `vit-weight-change`, `rep-weight`

---

### `vit-weight-change` — "The weight has changed a lot in a few days" · **MEDICAL-ADJACENT** ⚕
**a:** **Tell the care team.** A fast weight change during treatment is something they want to know about, and what it means depends entirely on the person's situation.

**Steps**
1. Contact the care team and tell them what you're seeing.
2. In the app, record the reading and, if you know it, pick the **Reason for change** — that gives the trend chart context so a drop after fluid was drained doesn't look like the same thing as a drop from not eating.
3. Look at **Reports** → **Weight** for the trend and the list of readings with their reasons.
4. Take that report with you to the next appointment, or export it — menu → **Settings** → **Download CSV**.

**note:** ChemoWell does not interpret weight changes and has no "concerning" threshold.
**keywords:** weight loss, dropping, gaining, fast, worried
**related:** `vit-weight-log`, `exp-csv`

---

### `vit-bp-log` — "How do I record blood pressure?"
**a:** The Blood pressure card on Home. It records straight away with no time screen.

**Steps**
1. Go to **Home** and find the **Blood pressure** card. If it isn't there, switch it on: menu → **Settings** → **Home screen** → **Blood pressure card**.
2. Type the top number, then the bottom number.
3. Tap **Log**.
4. It records immediately, at the current time.
5. See all readings under **Reports** → **Blood Pressure**.

**note:** Unlike temperature and weight, blood pressure can't be backdated from Home — it always records as now. If you need a reading on an earlier day, log it and then remove and re-add it isn't possible either; note the real time in **Notes** instead.
**keywords:** blood pressure, bp, systolic, diastolic, 120 over 80
**related:** `rep-bp`

---

### `vit-checkin-modal` — "What is the Daily check-in?"
**a:** One short screen that asks about today, once a day.

**Steps**
1. On **Home**, tap the **Daily check-in** card when it appears.
2. Answer whichever of appetite, bowel movement, and weight are switched on. Skip anything that doesn't apply.
3. There's a free-text box at the bottom — anything you write there goes into today's **Notes**.
4. Tap **Save**.
5. Once saved, the card stops appearing for the rest of the day.

**keywords:** check-in, daily, appetite, bowel, questions
**related:** `vit-checkin-missing`, `rem-checkin-time`

---

### `vit-checkin-missing` — "The Daily check-in card isn't showing / it's asking the wrong things"
**a:** Each question is a separate switch, and the card only appears if at least one is on.

**Steps**
1. Menu → **Settings** → **Home screen**.
2. Scroll to the **Daily check-in** part.
3. Switch on or off: *Weight in daily check-in*, *Bowel movement in daily check-in*, *Appetite in daily check-in*.
4. If you switch all three off, the card stops appearing entirely.
5. If you've already done today's check-in, the card won't show again until tomorrow.

**keywords:** check-in missing, not showing, questions, turn off
**related:** `vit-checkin-modal`

---

### `vit-units` — "I want pounds instead of kilograms, or Celsius instead of Fahrenheit"
**a:** Menu → Settings → Units.

**Steps**
1. Tap the three lines in the top left, then **Settings**.
2. Find **Units**.
3. Choose °F or °C for temperature, and pounds or kilograms for weight.
4. Every reading you've already logged is shown in the new unit straight away.
5. Nothing you logged is changed — only how it's displayed.

**keywords:** units, kg, lbs, celsius, fahrenheit, metric
**related:** `vit-temp-rejected`

---

### `vit-period` — "How do I track periods?"
**a:** It's an optional setting, and it's off unless you turn it on.

**Steps**
1. Menu → **Settings** → **Home screen** → switch on **Menstrual cycle tracking**.
2. A banner appears on **Home** to log a period start.
3. When it ends, tap **Log Period End** on the same banner.
4. The full record is under **Reports** → **Cycle**.

**note:** This option is only offered on profiles where it applies, based on the answer given during setup.
**keywords:** period, menstrual, cycle, tracking
**related:** `rep-cycle-missing`

---

## G. Symptoms & reactions

### `sym-log` — "How do I record a symptom?"
**a:** The Symptoms tab at the bottom, then the + button.

**Steps**
1. Tap **Symptoms** at the bottom of the screen.
2. Tap the **+** in the top right.
3. Choose the symptom from the list — nausea, vomiting, fatigue, mouth sores, numbness or tingling, headache, dizziness, a skin reaction or rash, diarrhoea, constipation, or Other.
4. Set the date and time if it wasn't just now.
5. Add a note if there's anything worth remembering.
6. Tap **Confirm**.

**keywords:** symptom, side effect, reaction, nausea, log
**related:** `sym-severity`, `sym-severe`

---

### `sym-severity` — "Can I record how bad it was, or where on the body?"
**a:** Yes, for some symptoms — and it's optional.

**Steps**
1. Log the symptom as normal.
2. For a skin reaction or rash you also get **How bad is it?** (mild, moderate, severe) and **Where on the body?**.
3. For pain-type symptoms you get a 1 to 10 scale.
4. All of these are optional — a quick record is better than one you gave up on.
5. Everything you fill in shows in History and in the exported records.

**keywords:** severity, mild, moderate, severe, where, body, pain scale
**related:** `sym-log`

---

### `sym-edit-delete` — "I need to fix or delete a symptom I logged"
**a:** Symptoms can be edited or removed at any time, however old.

**Steps**
1. Tap **Symptoms** at the bottom.
2. Tap the entry you want to change.
3. Change the time, note, severity or site, then confirm.
4. To delete it, use the remove option on that entry and confirm.

**keywords:** edit symptom, delete, fix, wrong
**related:** `log-remove`

---

### `sym-severe` — "The symptom is severe, or something new and frightening is happening" · **MEDICAL-ADJACENT** ⚕
**a:** **Contact the care team, or emergency services if it's urgent.** Do that first. Logging it in the app can wait — this app has no way to judge how serious something is, and it will never try to.

**Steps**
1. If the person is very unwell, struggling to breathe, confused, or you're frightened, call your local emergency number.
2. Otherwise call the care team or the on-call number they gave you.
3. Once they've been contacted, come back and log the symptom with the time it started, so there's an accurate record.
4. Use the note field to write down exactly what you saw, in your own words. That's genuinely useful to the care team later.

**note:** ChemoWell is a record-keeping tool, not medical advice. Never delay care because of anything shown in this app.
**keywords:** severe, bad, worse, emergency, frightened, help
**related:** `sym-log`, `vit-temp-high`

---

### `sym-bowel-confusion` — "Should diarrhoea go in Symptoms or the bowel tracker?"
**a:** Either works, and they're for different things.

**Steps**
1. Use the **Daily check-in** bowel question for the day's overall pattern — normal, very little, none, or diarrhoea.
2. Use the **Symptoms** tab for a specific episode with a time and a note.
3. The Symptoms list does include diarrhoea and constipation for exactly that reason.
4. Both show up in your exported records.

**keywords:** diarrhea, diarrhoea, constipation, bowel, where
**related:** `vit-checkin-modal`, `sym-log`

---

## H. Hospital stays

### `ip-start-end` — "How do I record a hospital stay?"
**a:** The In-Patient tab at the bottom, with a start and an end.

**Steps**
1. Tap **In-Patient** at the bottom of the screen.
2. When the stay begins, tap **Log In-Patient Start**.
3. A banner appears on Home showing which day of the stay you're on.
4. When the person is discharged, tap **Log In-Patient End** — on that banner or on the In-Patient tab.
5. Every past stay is kept in the **In-Patient History** list below.

**keywords:** hospital, admitted, in-patient, stay, discharged
**related:** `ip-meds-restricted`, `ip-forgot-end`

---

### `ip-meds-restricted` — "My medications say 'Restricted' and I can't log them"
**a:** A hospital stay is marked as active. While it is, home logging pauses, because the hospital is giving the medications.

**Steps**
1. If the stay is over, tap **In-Patient** at the bottom and tap **Log In-Patient End**.
2. Medication logging on Home goes back to normal straight away.
3. If the stay really is still active, that's the intended behaviour — the doses are being given and recorded by the hospital, not by you.
4. Days inside a hospital stay are never flagged as missed doses.

**keywords:** restricted, can't log, hospital, paused, greyed
**related:** `ip-start-end`, `log-button-locked`

---

### `ip-forgot-end` — "I forgot to end a hospital stay and it still says Active"
**a:** End it now — the stay keeps its real start date.

**Steps**
1. Tap **In-Patient** at the bottom.
2. Tap **Log In-Patient End**.
3. The stay closes and moves into In-Patient History with its length.
4. The end time is recorded as now. If the real discharge was earlier, add a note — menu → **Notes** — so the record is accurate.

**keywords:** still active, forgot, end, discharge, ongoing
**related:** `ip-start-end`

---

### `ip-past-stay` — "I want to add a hospital stay that already happened"
**a:** There's a separate control for logging a past stay with both dates.

**Steps**
1. Tap **In-Patient** at the bottom.
2. Find the option to log a past stay (Start + End).
3. Set the start date and time, then the end date and time.
4. Confirm. It appears in In-Patient History.

**keywords:** past stay, backdate, previous, add old
**related:** `ip-start-end`

---

### `ip-undo` — "I tapped In-Patient Start by mistake"
**a:** There's an Undo, and it asks twice on purpose.

**Steps**
1. On the **In-Patient** tab, tap the undo option on the active stay.
2. It asks you to tap again to confirm.
3. Tap it again within a few seconds.
4. The entry is removed and home medication logging goes back to normal.

**keywords:** undo, mistake, accidental, remove stay
**related:** `ip-start-end`

---

## I. History & reports

### `rep-where` — "Where do I see everything that's been logged?"
**a:** Reports at the bottom, then History.

**Steps**
1. Tap **Reports** at the bottom of the screen.
2. Tap **History** for the full day-by-day record.
3. The other reports on that screen each focus on one thing — Weight, Blood Pressure, Radiation, Cycle, Bowel Movement, Appetite.
4. Today's entries also appear on Home under **Today's journal**.

**keywords:** history, everything, records, past, where
**related:** `rep-history-read`

---

### `rep-history-read` — "How do I read the History screen?"
**a:** One section per day, newest first, with a summary line under each date.

**Steps**
1. Each day has a heading with the date and a short summary — for example *3 doses · 1 temp · 1 wt*.
2. Under it, every entry for that day in time order.
3. Missed doses appear as red rows with **Took later**, **Skipped** and **Clear** buttons.
4. Doses logged outside the usual rules carry a small **Early** or **Over limit** label.
5. There's a filter at the top to show only missed doses.

**keywords:** read, history, summary, day, understand
**related:** `miss-resolve`

---

### `rep-entry-missing` — "Something I logged isn't in History"
**a:** Check the day it landed on, and which profile you're looking at.

**Steps**
1. If you changed the date on the confirm screen when logging, it's filed under that date, not today.
2. Tap the three lines in the top left and check the name at the top — each profile has its own separate history.
3. Period starts and ends, and hospital stays, don't appear in Today's journal on Home. They're in their own reports and in the exported records.
4. If it's genuinely not anywhere, log it again with the right date and time.

**keywords:** missing entry, not there, disappeared, can't find
**related:** `pro-switch`

---

### `rep-weight` — "How do I see the weight trend?"
**a:** Reports → Weight.

**Steps**
1. Tap **Reports**, then **Weight**.
2. The top shows the current weight, the average, and the overall change.
3. The chart shows the trend. Use the range control to change the period shown.
4. Underneath, every reading is listed with its date and, if you gave one, the reason for the change.

**keywords:** weight, trend, chart, graph, average
**related:** `vit-weight-log`

---

### `rep-cycle-missing` — "The Cycle report isn't in the list"
**a:** It only appears when cycle tracking is switched on, and only on profiles where it applies.

**Steps**
1. Menu → **Settings** → **Home screen**.
2. Switch on **Menstrual cycle tracking**.
3. Go back to **Reports** — the Cycle report is there now.

**keywords:** cycle, period report, missing, not listed
**related:** `vit-period`

---

### `rep-history-slow` — "History is slow or won't respond when I tap"
**a:** This happens when there's a very large backlog of missed doses to draw.

**Steps**
1. Give it a few seconds — on a long backlog the screen genuinely takes a while to build.
2. Don't tap repeatedly; wait, then tap once.
3. Use **Clear all** in the missed-dose view to clear the backlog, which makes the screen light again.
4. Logging regularly, even just clearing misses each week, keeps this from building up.

**note:** This is a known issue with very long backlogs (many months of unlogged days).
**keywords:** slow, frozen, laggy, won't respond, stuck
**related:** `miss-clear-all`

---

## J. Notes & appointments

### `note-add` — "How do I write a note?"
**a:** Menu → Notes.

**Steps**
1. Tap the three lines in the top left, then **Notes**.
2. Tap to add a new note.
3. Pick the date it belongs to, then type.
4. Save.
5. Notes are always editable, and a note logged late lands on the date it happened.

**keywords:** note, journal, write, diary, record
**related:** `note-vs-checkin`

---

### `note-vs-checkin` — "What's the difference between Notes and the check-in's 'Anything else?' box?"
**a:** There isn't one, in the end — the check-in box writes into that day's note.

**Steps**
1. Anything you type in the check-in's *Anything else?* box goes into today's note.
2. You can open it later from menu → **Notes** and change it.
3. Use Notes directly for anything that isn't part of a daily check-in — a question for the doctor, something that happened, how the day went.

**keywords:** notes, check-in, anything else, difference
**related:** `vit-checkin-modal`

---

### `note-edit-delete` — "How do I change or delete a note?"
**a:** Menu → Notes, then tap the note.

**Steps**
1. Tap the three lines in the top left, then **Notes**.
2. Tap the note you want to change and edit the text.
3. Save.
4. To delete it, tap the delete option, then tap again to confirm. It warns you this can't be undone.

**note:** If you tap delete and then leave the screen without confirming, it may still be showing "Delete?" when you come back. Tap elsewhere or leave and return again to clear it.
**keywords:** edit note, delete, change, remove
**related:** `note-add`

---

### `appt-add` — "How do I add an appointment?"
**a:** Menu → Calendar, then Add.

**Steps**
1. Tap the three lines in the top left, then **Calendar**.
2. Tap **Add**.
3. Type a title, pick the date and the time.
4. Choose when you want to be reminded.
5. Pick a colour if you want it to stand out on the month view.
6. Save.

**keywords:** appointment, calendar, add, doctor, visit
**related:** `appt-reminder-choose`

---

### `appt-reminder-choose` — "What are the reminder choices for an appointment?"
**a:** Five preset options plus a custom one.

**Steps**
1. When adding or editing an appointment, open the reminder list.
2. **No reminder** — nothing is sent.
3. **At the scheduled time** — right when it starts.
4. **1 hour before**.
5. **The morning of (9 AM)**.
6. **1 day before**.
7. **Custom** — you set your own lead time, in minutes, hours or days.

**keywords:** reminder, before, lead time, custom, appointment
**related:** `rem-appointment`

---

### `appt-month-view` — "How do I see my appointments on a calendar?"
**a:** Menu → Calendar shows a month grid.

**Steps**
1. Tap the three lines in the top left, then **Calendar**.
2. Days with an appointment show a coloured dot.
3. Tap a day to see everything on it — the title, the time, the reminder setting and any note.
4. Use the arrows at the top to move between months.

**keywords:** calendar, month, view, dots, colours
**related:** `appt-add`

---

### `appt-year` — "I can't tell what year an appointment or note is from"
**a:** Dates on notes and calendar labels show only the month and day today.

**Steps**
1. Open the appointment or note itself — the full date is inside it.
2. For notes, the list badge shows only month and day, so a note from last year can look like a recent one.
3. If two entries look identical, open each one to check.

**note:** Adding the year to those labels is a known improvement that hasn't shipped yet.
**keywords:** year, date, confusing, old, which year
**related:** `note-add`

---

## K. Sharing & exporting

### `exp-csv` — "How do I get everything out of the app?"
**a:** Download CSV. It's free, on every plan.

**Steps**
1. Tap the three lines in the top left, then **Settings** (or **Account** — the export section is on both).
2. Find **Export**.
3. Tap **Download CSV**.
4. Your phone's own share screen opens. Pick where the file should go — email, Drive, Files, a messaging app, whatever's there.
5. The file is named with the patient's name and today's date, so it's easy to find later.

**keywords:** export, csv, download, spreadsheet, excel, get data out
**related:** `exp-where-file`, `exp-printable`

---

### `exp-where-file` — "Where did the exported file go? I can't find a 'save to this phone' option"
**a:** The file is handed to your phone's share screen, and a plain "save to this phone" option doesn't always appear there.

**Steps**
1. When the share screen opens, look for Drive, Files, or your email app — those all work.
2. Emailing it to yourself is the most reliable way to keep a copy you can find later.
3. If you picked something and nothing seems to have happened, check that app (your Drive, your sent mail) rather than your Downloads folder.
4. In the browser version, the file goes to your Downloads folder instead.

**note:** The missing "save straight to this phone" option is a known gap that's being worked on.
**keywords:** where, saved, downloads, file, missing, share sheet
**related:** `exp-csv`

---

### `exp-printable` — "How do I get a report to hand to the doctor?"
**a:** The Printable report. It's part of the Plus plan; CSV is free for everyone.

**Steps**
1. Menu → **Settings** (or **Account**) → **Export**.
2. Tap **Printable report**.
3. It's laid out by day, newest first, ready to print or save as a PDF.
4. On the installed app, your phone's share screen opens — pick a printer app, Drive, or email.
5. In a browser, your print dialog opens, and "Save as PDF" is one of the destinations.

**keywords:** printable, pdf, doctor, report, print, plus
**related:** `exp-csv`, `pro-plans`

---

### `exp-nothing` — "It says there's nothing to export"
**a:** Nothing has been logged on this profile yet.

**Steps**
1. Check which profile you're on — tap the three lines in the top left and look at the name at the top.
2. If it's the wrong one, switch, then try again.
3. If it's the right one, log something first — a dose, a temperature, anything — then export.

**keywords:** nothing to export, empty, no data
**related:** `pro-switch`

---

### `exp-csv-columns` — "What am I looking at in the CSV?"
**a:** One row per thing logged, with the date, the time, what it was, and the details.

**Steps**
1. Open it in any spreadsheet app — Excel, Google Sheets, Numbers.
2. Each row is one logged entry: a dose, a temperature, a weight, a blood pressure, a symptom, a period marker, a hospital start or end.
3. The details column holds the amount, any note, and labels like *Early* or *Over limit*.
4. If a row's details look odd or use an unfamiliar short code, that's a known formatting gap and not something you did wrong.

**keywords:** csv, columns, spreadsheet, understand, reading
**related:** `exp-csv`

---

### `exp-print-blocked` — "The printable report says pop-ups are blocked"
**a:** That's the browser version. Your browser is stopping the report window from opening.

**Steps**
1. Look for a small blocked-pop-up icon in your browser's address bar.
2. Tap it and choose to allow pop-ups for this site.
3. Tap **Printable report** again.
4. If you can't get it to work, use **Download CSV** instead — it carries the same information.

**keywords:** pop-up blocked, print, won't open, browser
**related:** `exp-printable`

---

## L. Profiles & plans

### `pro-add` — "I'm caring for more than one person"
**a:** Give each person their own profile. Their medications and history stay completely separate.

**Steps**
1. Tap the three lines in the top left, then **Settings**.
2. Find **Profiles**.
3. Tap the button to add a profile.
4. Type that person's name and tap **Create**.
5. The new profile starts empty, with its own medications, history and settings.

**note:** The Free plan includes 1 profile. Plus allows up to 3. Pro is unlimited.
**keywords:** profiles, two people, multiple, another person, family
**related:** `pro-switch`, `pro-limit`

---

### `pro-switch` — "How do I switch between people?"
**a:** The name at the top of the menu, or Settings → Profiles.

**Steps**
1. Tap the three lines in the top left.
2. Tap the name at the top to open **Account**, or tap **Settings** then **Profiles**.
3. Tap **Switch** next to the person you want.
4. The whole app changes to that person — Home, medications, history, everything.
5. The name at the top of the menu always tells you who you're currently looking at.

**keywords:** switch, change person, wrong person, profile
**related:** `pro-add`

---

### `pro-limit` — "It won't let me add another profile"
**a:** You've reached your plan's limit.

**Steps**
1. Free includes 1 profile, Plus includes up to 3, Pro is unlimited.
2. When you tap add and you're at the limit, the plans screen opens instead.
3. You can also delete a profile you no longer need to free a slot — but that erases that person's data permanently.

**keywords:** limit, can't add, plan, upgrade, one profile
**related:** `pro-plans`, `pro-delete`

---

### `pro-delete` — "How do I delete a profile?"
**a:** Settings → Profiles → Delete, with a confirm. It cannot be undone.

**Steps**
1. Menu → **Settings** → **Profiles**.
2. Tap **Delete** next to that person.
3. It asks *Delete forever? Can't be undone.* Tap **Delete** to confirm, or **Keep** to back out.
4. Everything for that person — medications, history, notes, appointments — is gone from this device.
5. If you might want any of it later, export it first: **Download CSV**.

**keywords:** delete profile, remove person, erase
**related:** `exp-csv`, `priv-delete`

---

### `pro-wrong-treatment-type` — "I picked the wrong treatment type during setup"
**a:** There's currently no way to change it afterwards. This is a real limitation, not something you're missing.

**Steps**
1. The treatment type — Chemo, Radiation, Both, or Other — is asked once during setup.
2. Today there's no screen to change it later.
3. The only way to change it is to create a new profile and set it up again, which means starting that person's history over.
4. Before you do that, export the existing records so you keep them: menu → **Settings** → **Download CSV**.

**note:** Being able to change treatment type later is a known gap and is on the list.
**keywords:** wrong type, chemo, radiation, change, setup, mistake
**related:** `treat-other-profile`, `exp-csv`

---

### `pro-plans` — "What do Plus and Pro actually add?"
**a:** They're one-time purchases, not subscriptions. The free tracker is complete and stays free.

**Steps**
1. Menu → **Settings** → **Profiles** → **View plans**.
2. **Free** — the full tracker, 1 profile, and CSV export of all your own data.
3. **Plus** — up to 3 profiles, and the printable doctor's report.
4. **Pro** — unlimited profiles, plus features still being built.
5. Anything marked *coming soon* is not built yet, and the plans screen says so.

**keywords:** plans, plus, pro, upgrade, price, cost, free
**related:** `pro-purchases-beta`

---

### `pro-purchases-beta` — "I upgraded but I wasn't charged"
**a:** This is a beta build. Purchases are simulated so the upgrade flow can be tested.

**Steps**
1. The plans screen says so at the bottom: purchases in this build are simulated.
2. Nothing has been charged, and no payment details are involved.
3. The finished version in the app stores will use real App Store and Google Play purchases.
4. If you want to go back to the free tier for testing, there's a reset option on the plans screen.

**keywords:** purchase, charged, payment, beta, simulated, free upgrade
**related:** `pro-plans`

---

## M. Settings & the Home screen

### `set-card-missing` — "A card I want isn't on my Home screen"
**a:** Almost every Home card can be switched on and off.

**Steps**
1. Menu → **Settings** → **Home screen**.
2. Switch on whichever you want: Temperature card, Weight card, Blood pressure card, Treatment schedule card, Radiation sessions card, Menstrual cycle tracking.
3. Go back to **Home** — it's there now.
4. Some cards only appear for profiles they apply to. Radiation sessions only shows for a profile that includes radiation.

**keywords:** card missing, home screen, hidden, turn on, settings
**related:** `treat-no-card`

---

### `set-quicklog-collapsed` — "All my medications vanished from Home"
**a:** The Quick log section is probably just folded shut.

**Steps**
1. On **Home**, look for the heading **Quick log**.
2. If it has a number in brackets next to it, like *Quick log (4)*, it's collapsed.
3. Tap the heading to open it again.
4. Medications in a Morning, Afternoon or Evening group are in their own cards further down, not in Quick log.

**keywords:** vanished, all gone, quick log, collapsed, empty home
**related:** `med-not-on-home`

---

### `set-beta-date-controls` — "There's a 'Beta date controls' box on my screen"
**a:** It's a testing tool for the beta. It lets you pretend it's a different day.

**Steps**
1. Tap it to open it. There's a date picker and −1 Day / +1 Day buttons.
2. While it's set to anything other than today, reminders are switched off on purpose, so your phone doesn't alert at the wrong real time.
3. Tap **Reset** to go back to today and switch reminders back on.
4. If you never want to use it, just leave it closed — it does nothing on its own.

**note:** This box won't be in the finished app.
**keywords:** beta, date controls, test, simulate, what is this
**related:** `rem-paused-sim`

---

### `set-units-quick` — "Change temperature or weight units"
See **`vit-units`** — *"I want pounds instead of kilograms"*. *(Lead Developer: render as a pointer entry, or merge — don't duplicate the copy.)*

---

### `set-erase-all` — "How do I erase everything and start over?"
**a:** Menu → Account → Start over. It's permanent, and there's no way to get anything back.

**Steps**
1. Tap the three lines in the top left, then tap the name at the top to open **Account**.
2. Scroll all the way down to **Start over**.
3. Tap the erase button.
4. A larger warning appears explaining that this permanently deletes everything and can't be undone.
5. Confirm only if you're certain. The app returns to the welcome screen.
6. **Export first if there's any chance you'll want the records** — **Download CSV** in the same screen.

**note:** ChemoWell has no cloud backup. Once this is done, the data is genuinely gone.
**keywords:** erase, start over, reset, delete everything, wipe, factory
**related:** `exp-csv`, `priv-delete`

---

### `set-something-flickering` — "The screen keeps refreshing or flickering"
**a:** Older versions did this while a confirmation box was open. If you're seeing it now, you're probably on an old cached copy.

**Steps**
1. Close ChemoWell completely — swipe it away from your recent apps.
2. Open it again.
3. Check the version: menu → **Settings**, scroll to **About & legal**. The version is on the first line.
4. If it still flickers on the current version, note exactly which screen and what was open at the time — that's the detail that makes it fixable.

**keywords:** flicker, refresh, blinking, jumping, screen
**related:** `app-old-version`

---

## N. The walkthrough guide

### `tour-replay` — "Can I go through the guided walkthrough again?"
**a:** Yes, any time.

**Steps**
1. Tap the three lines in the top left, then **Settings**.
2. Find **How-to guide**.
3. Tap **Replay the walkthrough**.
4. It starts again from the first step.
5. Nothing you've already set up is changed by replaying it.

**keywords:** tour, guide, walkthrough, again, replay, help
**related:** `tour-stuck`

---

### `tour-stuck` — "The guide is waiting for me to do something and I'm stuck"
**a:** Some steps wait for a real tap. The banner tells you which one.

**Steps**
1. Read the small line at the bottom of the guide banner — it says exactly what to tap, for example *Tap Add to continue*.
2. Tap **More** on the banner to see the full explanation of that step.
3. If you'd rather move on, tap **Skip this step**.
4. To leave the guide entirely, tap **Skip guide**.
5. You can restart it later from Settings.

**keywords:** stuck, tour, waiting, can't continue, guide
**related:** `tour-replay`

---

### `tour-blocking` — "The guide banner is covering the top of the screen"
**a:** The banner sits at the very top while the guide is running.

**Steps**
1. Tap **Skip guide** on the banner to close it, and restart it later from Settings if you want.
2. The page underneath is fully usable while the guide is up — you can scroll and tap normally.
3. On the last few steps the guide takes you to each tab automatically, so you don't have to find them.

**keywords:** covering, banner, blocking, top, menu, hidden
**related:** `tour-replay`

---

## O. Your data & privacy

### `priv-server` — "Is my information stored on a server somewhere?"
**a:** No. Everything you enter stays on this device. There's no account, no cloud, and nothing is sent anywhere.

**Steps**
1. There's no sign-up and no login — you may have noticed you were never asked for an email address.
2. Your medication list, your history, your notes and your appointments are stored on this phone only.
3. ChemoWell does not send your information to us or to anyone else. There's no tracking and no analytics.
4. It works with no internet connection at all, which is the plainest proof of the above.
5. The trade-off is real, and worth knowing: because nothing is on a server, nobody can restore it for you. See *"What happens if I lose my phone?"*.

**keywords:** server, cloud, privacy, data, account, tracking, safe
**related:** `priv-lost-phone`, `priv-who-sees`

---

### `priv-who-sees` — "Who can see what I put in?"
**a:** Only whoever can unlock this phone.

**Steps**
1. There's no shared account and no other copy of your data.
2. Nothing is visible to us, to a doctor, or to anyone else unless you export it and send it yourself.
3. If other people use this phone, its own lock screen is what protects the app.
4. When you export a report, that file is yours — where it goes is entirely your choice.

**keywords:** who can see, private, shared, doctor, family
**related:** `priv-server`, `exp-csv`

---

### `priv-lost-phone` — "What happens if I lose my phone or the app is uninstalled?"
**a:** The data goes with it. There's no cloud copy and no way to restore it.

**Steps**
1. Because nothing is stored on a server, there's no backup to pull down onto a new phone.
2. Keep your phone backed up the way you normally would.
3. Export a copy every so often — menu → **Settings** → **Download CSV** — and email it to yourself or save it to your own cloud storage. That's your record.
4. Do that before erasing anything, changing phones, or deleting a profile.

**note:** A proper backup-and-move-to-a-new-phone feature is planned but not built yet. Exporting is the reliable way to keep a copy today.
**keywords:** lost phone, new phone, backup, restore, uninstall, gone
**related:** `exp-csv`, `pro-plans`

---

### `priv-delete` — "How do I make sure my data is really gone?"
**a:** Menu → Account → Start over erases everything on this device.

**Steps**
1. Export anything you want to keep first — **Download CSV**.
2. Menu → tap the name at the top → **Account** → scroll to **Start over**.
3. Erase, and confirm on the larger warning.
4. That clears the patient name, medications, and all logged history from this device.
5. To remove just one person, use Settings → Profiles → Delete instead.

**keywords:** delete, erase, gone, remove data, permanently
**related:** `set-erase-all`, `pro-delete`

---

## P. The app itself

### `app-old-version` — "I was told something was fixed, but I still see the old version"
**a:** Close the app completely and open it again. That's usually all it takes.

**Steps**
1. Swipe ChemoWell away from your recent apps so it's fully closed — not just minimised.
2. Open it again.
3. Check the version: menu → **Settings** → scroll to **About & legal**. The version number is on the first line.
4. If it hasn't changed, make sure you have an internet connection, then close and open it once more.
5. If it still hasn't changed after that, the fix may need a new install of the app rather than just a reopen — that's the case for anything involving notifications or file sharing.

**note:** The app keeps a copy of itself on the phone so it works offline. That copy is refreshed when you open it with a connection.
**keywords:** old version, not updated, still broken, cache, refresh, update
**related:** `app-version`

---

### `app-version` — "How do I check which version I'm on?"
**a:** Settings → About & legal.

**Steps**
1. Tap the three lines in the top left, then **Settings**.
2. Scroll to the bottom, to **About & legal**.
3. The first line shows the version, for example *ChemoWell app-v52 (beta)*.
4. The version is also at the bottom of the menu panel itself.

**keywords:** version, which, number, about, build
**related:** `app-old-version`

---

### `app-offline` — "Does it work without internet?"
**a:** Yes. Everything works offline.

**Steps**
1. Logging, history, reports, notes and appointments all work with no connection.
2. Reminders that were already set still arrive.
3. Connect occasionally so the app can pick up updates, and so new reminders keep being set up ahead of time.

**keywords:** offline, no internet, aeroplane, wifi, data
**related:** `app-old-version`

---

### `app-blank` — "The screen is blank or the app won't load"
**a:** Close it fully and open it again first.

**Steps**
1. Swipe ChemoWell away from your recent apps, then open it again.
2. If it's still blank, restart the phone and open it again.
3. If you're in a browser, pull down to refresh the page.
4. Your data isn't lost by any of this — it's stored on the device separately from the app screen.

**keywords:** blank, white screen, won't load, crash, stuck
**related:** `app-old-version`

---

### `app-back-button` — "The back button closes the whole app"
**a:** That's a known problem. Use the tabs at the bottom instead.

**Steps**
1. To move between screens, use the bar at the bottom — Home, Meds, Reports, In-Patient, Symptoms.
2. For Calendar, Notes, FAQ and Settings, use the three lines in the top left.
3. Avoid the phone's back button while you're inside the app.
4. If it does close the app, nothing is lost — open it again and everything is where you left it.

**note:** Making the back button go up one screen instead of leaving the app is a known fix that hasn't shipped yet.
**keywords:** back button, closes, exits, quits, navigation
**related:** `app-blank`

---

### `app-nothing-happens` — "I tap something and nothing happens"
**a:** A few of these are deliberate, and the rest usually clear with a reopen.

**Steps**
1. Some buttons ask twice on purpose — delete, clear, and undo all need a second tap to confirm. Look for wording that changed to *Delete?* or *Tap to confirm*.
2. If a confirmation is showing and you don't want it, tap somewhere else or wait a few seconds and it clears itself.
3. If nothing at all responds, close the app completely and open it again.
4. If a particular button never works, note exactly which screen and which button — that's what makes it fixable.

**keywords:** nothing happens, unresponsive, button, doesn't work, tap
**related:** `app-blank`, `app-report`

---

### `app-report` — "Something's wrong and it isn't in this list"
**a:** Write down what happened and pass it on — there's no automatic reporting in this build.

**Steps**
1. Note which screen you were on and exactly what you tapped.
2. Note what you expected and what happened instead.
3. Take a screenshot if you can.
4. Check your version: menu → **Settings** → **About & legal**.
5. Send those four things to whoever gave you this app.

**note:** An in-app "report a problem" button is planned but isn't built yet.
**keywords:** report, bug, problem, broken, feedback, tell someone
**related:** `app-version`

---

## 4. Medical-adjacent entries — every one, flagged

These carry `medical: true` and must be checked word by word by the Auditor and read by the PM before this ships. In every one, the answer is *contact the care team*, stated first; the app mechanics come second.

| id | Category | Why it's flagged | What it must never do |
|---|---|---|---|
| `miss-real-missed` | Missed doses | A genuinely missed dose of a real treatment medication is a clinical decision | Never suggest taking, skipping, doubling, or waiting |
| `vit-temp-high` | Vitals | Fever during chemotherapy can be an emergency | Never state a threshold, never say a reading is fine or not fine |
| `vit-weight-change` | Vitals | Rapid weight change is clinically meaningful | Never interpret the change or say what's normal |
| `sym-severe` | Symptoms | Severe or new symptoms need triage this app can't do | Never rank severity or advise waiting |
| `log-anyway-override` | Logging | Overriding a daily limit or a dose gap | Never imply the override is safe; the limit is the user's own number, not clinical guidance |
| `med-daily-limit-locked` | Medications | Sits on the dosing-limit mechanism | Never suggest what a limit should be |
| `med-add-first` | Medications | Where doses are first entered | Keep the "enter exactly what was prescribed" line; never suggest a dose |
| `rem-none` | Reminders | Reminder failure on treatment medication is a safety failure | Never promise reminders will always arrive |
| `ip-meds-restricted` | Hospital | Explains why home logging is paused during a stay | Never imply the app knows whether a dose was given in hospital |

Two more carry `safety: true` but not `medical: true` — `log-button-locked` and `miss-what-counts`. They describe safety mechanisms without touching a clinical decision, but the Auditor's copy check should cover them.

---

## 5. NEEDS-VERIFICATION

Items I could not confirm from the code alone. Each needs a real check before the wording ships as written.

| # | Item | Where it appears | What needs checking |
|---|---|---|---|
| NV-1 | Exact Samsung One UI 8.5 menu labels — *Unrestricted* under Battery, and the exact path to *Alarms & reminders* | `rem-none`, `rem-exact-toggle-missing` | The app's own toasts say *Settings → Apps → ChemoWell → Battery* and *→ Alarms & reminders* (index.html, `setToast` strings). Aaron's device is the only real confirmation available. My copy avoids hard-coding a menu path where it can; confirm the two it does use. |
| NV-2 | Notification sound and vibration per channel | `rem-silent` | Three channels are created (`chemowell_dose_reminders`, `chemowell_appointment_reminders`, `chemowell_daily_checkin`, index.html:6896-6898). I did not verify their importance level or whether they surface separately in Android's per-app notification settings. |
| NV-3 | What tapping a native dose reminder actually does | `rem-tap-notification` | `sw.js` handles `notificationclick` for the web path (focus or open). The native `@capacitor/local-notifications` tap behaviour is not verified. I wrote it as "brings the app to the front, doesn't log the dose" — the second half is certain, the first half is inferred. |
| NV-4 | Printable report on the installed app | `exp-printable` | Aaron confirmed **CSV** reaching the share sheet on device 2026-08-09. The printable report rides the same `nativeShareFile()` path but has never been confirmed on hardware. My copy says the share screen opens — confirm before shipping. |
| NV-5 | Whether any "save to this phone" target ever appears | `exp-where-file` | Open item in REQUESTS.md. My copy says it "doesn't always appear" and steers to Drive/email/Files. Re-word if the underlying fix lands first. |
| NV-6 | Blood pressure genuinely cannot be backdated from anywhere | `vit-bp-log` | `logBloodPressure()` at index.html:1376 writes with `ts = state.now` and no time modal. I found no other entry point. Confirm there is no path I missed before telling users it's impossible. |
| NV-7 | Temperature valid range in Celsius | `vit-temp-rejected` | The Fahrenheit message is verbatim from the app (`86–113`). I did not read the Celsius branch. My copy only states the Fahrenheit range — confirm before adding the Celsius one. |
| NV-8 | Whether force-stop is reachable from the app's own settings screen on One UI 8.5 | `rem-exact-toggle-missing` | Step 3 says "use the app's own force-stop option". Wording is deliberately vague because the button's label and position vary. Tighten it if Aaron confirms what he actually sees. |

---

## 6. How I'd expect the Lead Developer to wire this in

Recommendations, not instructions — the technical decisions are yours.

**Entry point.** Replace the drawer's `{ key: 'faq', label: 'FAQ', … }` (index.html:2467) with a single **Help** item, helper text something like *Find and fix a problem*. Two separate drawer items called "FAQ" and "Help" would make a stressed user pick, and picking wrong is a dead end. Put the 15 existing `FAQ_ITEMS` inside the new Help screen as a category of their own — something like *Common questions* — so nothing is lost and there's one place to look.

**Three levels, one at a time.** Category list → problem list for that category → the walkthrough. Never show all 117 at once. On a phone, a flat list that long is the same as no list.

**Search.** One text box pinned at the top of the category screen. Match against `q`, `a`, and `keywords`, case-insensitively, and show results as a flat list of problems with their category name underneath each. This is what actually makes 117 entries usable — a caregiver types "not getting reminders" or "greyed out", not "Category A". A simple substring match over those three fields is enough; nothing fancier is needed and nothing fancier should be added.

**Back-out.** Every level needs a visible way back that isn't the phone's back button — the hardware Back button currently leaves the app entirely (`AUDIT_full_app_v51.md`, M-7), so a Help screen that depends on it is a trap. A back arrow at the top of the problem view returning to its category, and from the category list back to the drawer.

**State.** `state.faqOpenId` (index.html:790) is a single open-id, which is the right model for the accordion but not for three levels. Consider `state.help = { cat: null, topic: null, query: '' }`, leaving `faqOpenId` alone so the existing FAQ accordion keeps working if you keep it separate.

**The tick guard.** index.html:7321 lists every state that must suppress the 1-second full re-render. This project has hit the same bug at least four times (v11, v22, v27, v45) by adding a new state and forgetting this line. If the Help screen has a search box the user types into, **it must be added to that guard**, or every keystroke will be eaten by the rebuild.

**Rendering the steps.** `steps` should render as a real `<ol>` with generous line spacing — this is being read at 2am. Don't join them into one paragraph. `branches` render after the steps, each with `when` as a small bold sub-heading. `related` renders as tappable chips at the bottom that jump to that topic. Remember the answer div at index.html:5553 has no `whiteSpace: 'pre-line'`, so nothing here can rely on `\n`.

**Medical entries.** A `medical: true` topic should render its care-team callout as a distinct block **above** the steps, using the existing `NOTICE_TONES.urgent` accent (index.html:1875) so it reads with the same weight as the missed-dose banner. Don't bury it in step 1.

**Two things to fix in the same release.** The `reset` FAQ entry (index.html:2044) points at Settings; Start over is in Account (index.html:5933). And `renderFaqView`'s intro line says *"your data, and your plan"* — worth revisiting if FAQ becomes a sub-section of Help.

**What not to do.** Don't add a text input that looks like a chat box. Aaron's framing is a decision tree, and a chat-style prompt sets up an expectation of an answer to anything, which this cannot deliver — a caregiver typing "is 101.4 dangerous" into something that looks like a chatbot and getting no answer is worse than no box at all. A search field labelled *Search help* is a different thing and is fine.
