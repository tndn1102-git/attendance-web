#!/bin/sh
# EP18 배경 — 내 프로필(.pw-profile)만 정리. .pw-profile-b(다른 세션)는 건드리지 않는다.
cd /d/test3/suno-sleep-yt || exit 1
kill_mine() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -match 'pw-profile(?!-)' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  sleep 3
  rm -f .pw-profile/lockfile .pw-profile/SingletonLock 2>/dev/null
}
wait_node() {  # 내 프로필을 쓰는 node(이전 시도)가 끝날 때까지
  while powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*plum/ep18/bg*' }) { exit 0 } else { exit 1 }"; do sleep 10; done
}
gen() {
  out=$1; shift
  [ -f "$out" ] && { echo "skip $out"; return 0; }
  for i in 1 2 3 4 5; do
    wait_node; kill_mine
    echo "=== $out try $i $(date +%H:%M:%S) ==="
    node auto_gemini_bg.js "$@" --out "$out" 2>&1 | grep -v "^ *'" | tail -2
    [ -f "$out" ] && { echo "OK $out"; return 0; }
    sleep 20
  done
  echo "FAIL $out"; return 1
}
S="A_front_cosmos B_corner_birchlake C_ridge_silvergrass D_lounge_teafield"
for s in $S; do gen "plum/ep18/bg/real/${s}.png" --prompt-file "plum/ep18/bg/real/${s}.txt"; done
for s in $S; do
  [ -f "plum/ep18/bg/real/${s}.png" ] || continue
  gen "plum/ep18/bg/${s}.png" --image "plum/ep18/bg/real/${s}.png" --prompt-file "plum/ep18/bg/repaint_gouache_ep18.txt"
done
kill_mine
echo "=== ALL DONE $(date +%H:%M:%S) ==="
