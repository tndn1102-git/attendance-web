#!/bin/sh
cd /d/test3/suno-sleep-yt || exit 1
kill_chrome() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*pw-profile*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  sleep 3
}
gen() {
  out=$1; shift
  [ -f "$out" ] && { echo "skip $out"; return 0; }
  for i in 1 2 3 4; do
    kill_chrome
    echo "=== $out try $i ==="
    node auto_gemini_bg.js "$@" --out "$out" && [ -f "$out" ] && { echo "OK $out"; return 0; }
  done
  echo "FAIL $out"; return 1
}
for s in A_awning B_arcade; do
  gen "plum/ep10/bg/real/${s}.png" --prompt-file "plum/ep10/bg/real/${s}.txt"
done
for s in A_awning B_arcade; do
  [ -f "plum/ep10/bg/real/${s}.png" ] || continue
  gen "plum/ep10/bg/${s}.png" --image "plum/ep10/bg/real/${s}.png" --prompt-file "plum/_assets/repaint_gouache.txt"
done
echo "=== ALL DONE ==="
