#!/bin/sh
# plum EP14 가을 배경 4안(외관2·실내2) — 실사(Gemini) → 과슈 재도색(가을판 프롬프트). EP12 _gen_all.sh 방식.
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
    echo "=== $out try $i $(date +%H:%M:%S) ==="
    node auto_gemini_bg.js "$@" --out "$out" 2>&1 | tail -1
    [ -f "$out" ] && { echo "OK $out"; return 0; }
  done
  echo "FAIL $out"; return 1
}
S="A_grass_pavilion B_ginkgo_folding C_valley_lounge D_birch_counter"
for s in $S; do gen "plum/ep14/bg/real/${s}.png" --prompt-file "plum/ep14/bg/real/${s}.txt"; done
for s in $S; do
  [ -f "plum/ep14/bg/real/${s}.png" ] || continue
  gen "plum/ep14/bg/${s}.png" --image "plum/ep14/bg/real/${s}.png" --prompt-file "plum/ep13/bg/repaint_gouache_autumn.txt"
done
kill_chrome
echo "=== ALL DONE $(date +%H:%M:%S) ==="
