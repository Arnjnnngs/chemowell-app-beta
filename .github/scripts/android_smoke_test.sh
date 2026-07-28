#!/bin/bash
# Runs INSIDE the booted GitHub Actions Android emulator (see android-build.yml's
# `emulator-smoke` job). Installs the exact debug APK this same CI run just built, launches the
# REAL native app on a REAL Android system image, confirms it doesn't crash, and captures
# screenshots + the full device log so a human (or Claude, reading the uploaded artifact) can see
# what actually rendered — not what we assume rendered. This is the on-device verification step
# the native/Capacitor branch of the app has never had before (the Auditor flagged this exact gap
# in AUDIT_v24.md: "I could not exercise the actual native/Capacitor branch in this sandbox").
set -euo pipefail

PKG="com.chemowell.app"
ACT="$PKG/.MainActivity"
APK_PATH="artifacts/app-debug.apk"
OUT="screenshots"
mkdir -p "$OUT"

echo "== Waiting for device =="
adb wait-for-device
adb shell input keyevent 82   # wake/dismiss keyguard, in case the AVD boots locked

echo "== Installing the APK this run just built =="
adb install -r "$APK_PATH"

echo "== Launching the real app (native shell, not the website) =="
adb shell am start -W -n "$ACT"

echo "== Giving the WebView time to load the live remote site over the emulator's network =="
sleep 15

echo "== Screenshot 1: initial load =="
adb exec-out screencap -p > "$OUT/01_launch.png"

echo "== Confirming the app process is still alive (a crash on launch would kill it) =="
if ! adb shell "pidof $PKG" > /dev/null; then
  echo "APP CRASHED: process $PKG not found after launch" >&2
  adb logcat -d > "$OUT/crash_logcat.txt"
  exit 1
fi

echo "== Screenshot 2: after a further beat, to catch late JS errors or a blank/stuck screen =="
sleep 5
adb exec-out screencap -p > "$OUT/02_settled.png"

echo "== Full device log, for anything the screenshots alone wouldn't show =="
adb logcat -d > "$OUT/logcat_full.txt"

echo "== Pulling out anything that looks like a WebView/JS console error =="
if grep -iE "error|uncaught|exception" "$OUT/logcat_full.txt" | grep -i "console\|chromium\|capacitor" > "$OUT/console_errors.txt"; then
  echo "Found lines worth a human/Claude look — see console_errors.txt"
else
  echo "No console-tagged error lines found." > "$OUT/console_errors.txt"
fi

echo "Smoke test complete — see $OUT/ for screenshots and logs."
