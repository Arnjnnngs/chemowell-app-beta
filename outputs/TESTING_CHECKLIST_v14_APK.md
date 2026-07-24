# app-v14 native APK — device testing checklist (Aaron)

Why this exists: this build cannot be run on a real Android device from the cloud sandbox this
project is developed in, and the GitHub Actions CI environment that compiles it has no Android
emulator either. Everything below the actual Gradle compile — real notification delivery, real
native look/feel, real touch behavior — can only be verified on your phone. Per our process (Lead
Developer standing rule): when something can't be tested from this end, it gets a specific
checklist instead of being skipped. This is that checklist.

## 1. Installing it

1. On your Android phone, open the debug APK file I sent you (or download it from the GitHub
   Actions run if I sent you that link instead).
2. Android will likely block the install the first time and show "blocked by Play Protect" or
   similar — tap "Install anyway" / "More details" → "Install anyway". This is expected and normal
   for a debug build not distributed through the Play Store; it is not a sign anything is wrong.
3. If nothing happens when you tap the file, Settings → Apps → look for a toggle like "Install
   unknown apps" for whichever app you opened the file with (Files, Chrome, etc.) and allow it.
4. The app should install with the real ChemoWell icon (green rounded square with a white cross) —
   **not** the generic default Android/Capacitor icon. If you see a plain blue/generic icon, flag
   that back to me — it means the icon step didn't take.

## 2. First launch — look and feel

- [ ] App opens to the same ChemoWell interface you're used to from the browser/PWA version — no
      broken layout, no blank white screen stuck for more than a couple seconds.
- [ ] Status bar area (top of phone) looks correct — not a jarring mismatched color.
- [ ] Navigating between tabs (Home, Meds, Reports, etc.) feels smooth, no stutter or flash that
      you haven't already seen in the browser version.
- [ ] Rotate the phone / check both portrait orientations if you normally would — layout should
      hold up the same as the PWA.
- [ ] Compare side-by-side with the installed PWA (Add to Home Screen version) if you still have
      it — they should look and behave identically, since the native app loads the same live page.
      Any difference between the two is worth reporting.

## 3. Notifications — the main reason for this build

- [ ] On first launch (or shortly after), Android should show a system permission prompt asking
      to allow ChemoWell to send notifications. **Tap Allow.** If you don't see this prompt at all,
      that's a real finding — flag it, don't just assume it's fine.
- [ ] Go to Settings (gear icon) → Notifications section in the app. It should say notifications
      "are on for this app" (not the old "arrives with the phone-app version" web copy — if you
      still see that older wording, the app is somehow not detecting it's running natively, which
      is itself a bug worth reporting).
- [ ] Log a medication that's on a schedule (or use the existing test/demo data) and let the app
      sit — either wait for a real scheduled reminder time, or if the app's TEST_MODE date controls
      let you fast-forward the simulated clock, use that to reach a reminder window.
- [ ] When a reminder should fire, confirm you get a real Android system notification (appears in
      the notification shade / lock screen, not just something inside the app). Check:
      - [ ] Notification shows the ChemoWell icon (a small white cross/plus mark), not a generic
            Android icon.
      - [ ] Tapping the notification opens the app.
      - [ ] The notification text makes sense (medication name, "available" / reminder wording).
- [ ] Missed-dose alert: let a scheduled dose window pass without logging it, confirm a "missed
      dose" style notification arrives the same way.
- [ ] Put the app in the background (press home button, don't force-close it) and confirm a
      notification still arrives while it's backgrounded — this is the real test of native delivery
      vs. the old web-only approach, which generally could NOT do this reliably.
- [ ] Force-close the app entirely (swipe it away from recent apps) and see whether a still-pending
      notification arrives anyway. It's fine if this doesn't work yet — Android is very restrictive
      about closed-app notifications and this may need a follow-up "exact alarm" permission we
      haven't wired in — just note whether it worked or not, don't assume either way.

## 4. General regression pass (should behave exactly like the browser/PWA version)

- [ ] Add a new medication, save it, confirm it appears correctly.
- [ ] Log a dose from Home.
- [ ] Open Reports, confirm charts/history render.
- [ ] Try the "Replay the walkthrough" guide from Settings — should look and work the same as on
      the PWA.
- [ ] Confirm nothing about data/storage seems different — this build reads/writes the exact same
      on-device storage the PWA uses, so if you've been using the PWA, your existing data should
      already be there (same browser storage). If it looks empty/different, tell me — that would be
      unexpected and worth digging into.

## 5. What to send back

For anything that fails or looks off: a screenshot if possible, plus which checklist item it was.
For notifications specifically, even "it worked" is useful to hear — that's the one thing I
genuinely cannot verify from my end.

## Known, expected, NOT bugs

- Android's install warning on first install (see step 1) — expected for any debug/sideloaded APK.
- The app currently only works with the internet reachable (it loads the live site, same as the
  PWA) — full offline bundling is a deliberate later step, not part of this test build.
- No real subscription/billing yet — the Plans sheet is still the same TEST_MODE simulation as the
  browser version. Real store billing is a separate future item.
