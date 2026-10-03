#!/bin/sh
cd /d/test3/suno-sleep-yt || exit 1
kill_mine() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -match 'pw-profile(?!-)' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  sleep 3; rm -f .pw-profile/lockfile 2>/dev/null
}
for s in wide terrace meadow; do
  out="plum/shorts/bg/ep18_${s}_vert.png"
  [ -f "$out" ] && { echo "skip $out"; continue; }
  for i in 1 2 3 4 5; do
    kill_mine
    echo "=== $out try $i $(date +%H:%M:%S) ==="
    node auto_gemini_bg.js --image plum/ep18/bg/bg_ep18_final.png \
      --prompt-file "plum/shorts/bg/ep18_${s}_vert.txt" --out "$out" --no-prefix 2>&1 | tail -1
    [ -f "$out" ] && { echo "OK $out"; break; }
    sleep 15
  done
done
kill_mine
echo "=== ALL DONE $(date +%H:%M:%S) ==="
