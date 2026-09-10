#!/bin/sh
# EP10·EP11 배경 일괄 생성 (Gemini 웹 자동화). 크롬이 간헐 크래시하므로 재시도 4회.
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
    node auto_gemini_bg.js "$@" --out "$out" 2>&1 | tail -2
    [ -f "$out" ] && { echo "OK $out"; return 0; }
  done
  echo "FAIL $out"; return 1
}
E10=ballad90/ep10/bg_film; E11=ballad90/ep11/bg_film
gen $E10/c1.png  --prompt-file $E10/scenes/c1.txt
gen $E11/c1.png  --prompt-file $E11/scenes/c1.txt
gen $E10/v1_stand.png  --prompt-file $E10/scenes/v1_stand.txt  --aspect "vertical 9:16 portrait"
gen $E10/v2_finish.png --prompt-file $E10/scenes/v2_finish.txt --aspect "vertical 9:16 portrait"
gen $E11/v1_window.png --prompt-file $E11/scenes/v1_window.txt --aspect "vertical 9:16 portrait"
gen $E11/v2_guitar.png --prompt-file $E11/scenes/v2_guitar.txt --aspect "vertical 9:16 portrait"
gen $E10/c1b.png --prompt-file $E10/scenes/c1.txt
gen $E11/c1b.png --prompt-file $E11/scenes/c1.txt
kill_chrome
echo "=== ALL DONE $(date +%H:%M:%S) ==="
