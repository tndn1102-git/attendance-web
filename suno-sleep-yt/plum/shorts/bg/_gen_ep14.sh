#!/bin/sh
cd /d/test3/suno-sleep-yt || exit 1
kill_chrome() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*pw-profile*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  sleep 3
}
for s in wide close garden; do
  out="plum/shorts/bg/ep14_${s}_vert.png"
  [ -f "$out" ] && { echo "skip $out"; continue; }
  for i in 1 2 3 4; do
    kill_chrome
    echo "=== $out try $i $(date +%H:%M:%S) ==="
    node auto_gemini_bg.js --image plum/ep14/bg/bg_ep14_final.png \
      --prompt-file "plum/shorts/bg/ep14_${s}_vert.txt" --out "$out" --no-prefix 2>&1 | tail -1
    [ -f "$out" ] && { echo "OK $out"; break; }
  done
done
kill_chrome
echo "=== ALL DONE $(date +%H:%M:%S) ==="
