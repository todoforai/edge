---
name: android-phone
description: "Control the user's own Android phone over ADB when an ANDROID machine is listed (`adb connect \"<name>\"` in its entry). Screenshots, taps, typing, app launch, UI tree, logs, file push/pull — all via stock adb from any bridge shell."
metadata:
  short-description: "Drive the user's Android phone with adb through the TODOforAI relay."
---
# android-phone — the user's phone over ADB

An `### <name> (type: ANDROID)` machine means the user turned on *Let the agent control this phone* in the
TODOforAI app. Its adbd is relayed through the backend; the bridge rewrites `adb connect "<name>"` to a local
port, so everything after that is stock adb. Works from any bridge shell (not from the phone itself).

## Connect (once per shell host)
```sh
adb connect "Marcell's S24"        # name exactly as in the machine entry; prints connected to 127.0.0.1:<port>
S=$(adb devices | awk '/^127\.0\.0\.1:/{print $1}')   # serial for -s (or export ANDROID_SERIAL=$S)
adb -s $S shell getprop ro.product.model
```
Errors: *phone "…" is not online* → the toggle is off / app killed / no Wi-Fi — ask the user. *wireless debugging OFF*
in the entry → ask them to enable Settings → Developer options → Wireless debugging (also after every reboot).
First time on a new host adbd asks the user to approve the host key on the phone — tell them to tap Allow.

## Look
```sh
adb -s $S exec-out screencap -p > shot.png          # then: tfa-cli show shot.png
adb -s $S exec-out uiautomator dump /dev/tty | head -c 200000   # UI tree with bounds + resource-ids
adb -s $S shell dumpsys window | grep mCurrentFocus  # foreground activity
```
Prefer `agent-device snapshot -i --platform android` (if installed) for a compact, indexed UI tree.

## Act
```sh
adb -s $S shell input tap 540 1200
adb -s $S shell input swipe 540 1600 540 400 300
adb -s $S shell input text 'hello%sworld'           # %s = space; no unicode — use the clipboard/IME for that
adb -s $S shell input keyevent KEYCODE_ENTER         # KEYCODE_HOME, KEYCODE_BACK, KEYCODE_WAKEUP
adb -s $S shell am start -a android.intent.action.VIEW -d 'geo:0,0?q=Budafoki+út+64'
adb -s $S shell monkey -p com.spotify.music 1       # launch an app by package
adb -s $S shell pm list packages | grep -i maps
adb -s $S push file.pdf /sdcard/Download/           # pull works the same way
adb -s $S logcat -d -t 200
```

## Rules
- Shell uid only (`shell`, not root): no reading other apps' private data, no settings that need `WRITE_SECURE_SETTINGS`.
- Anything the user would see or that changes state (sending a message, payments, deleting, installing APKs,
  `settings put`, `reboot`) — say what you're about to do and get a yes first. Screenshots and reads are fine.
- Keep the screen awake while driving: `adb shell input keyevent KEYCODE_WAKEUP`; don't change the lock settings.
- Slow or dropping? It's the phone's Wi-Fi; retry rather than re-pairing. `adb disconnect "<name>"` when done.
