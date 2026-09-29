#!/bin/sh
# plum EP17 — Mureka V9.5 10곡 제출 + feed 직다운로드 (EP12 _dl_loop.sh 방식). 남성곡 = #5
cd /d/test3/suno-sleep-yt || exit 1
P=plum/ep17/mureka-prompts-plum-ep17.txt
kill_chrome() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*pw-profile*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  sleep 3
}
if ! grep -q "제출 완료" plum/ep17/_gen_v95.log 2>/dev/null; then
  kill_chrome
  node tools/mureka_generate.js "$P" --model V9.5 --male-songs 5 > plum/ep17/_gen_v95.log 2>&1
  grep "제출\|rror\|모델" plum/ep17/_gen_v95.log
  grep -q "제출 완료" plum/ep17/_gen_v95.log || { echo "SUBMIT FAIL"; exit 2; }
fi
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  sleep 75; kill_chrome
  echo "=== dl try $i $(date +%H:%M:%S) ==="
  node tools/_mureka_lib_click.js plum/ep17/_feed.json 2>&1 | tail -1
  py -3 tools/mureka_fetch_dl.py plum/ep17/_feed.json "$P" plum/ep17/music_v95 --model V9.5 2>&1 | tail -2
  n=$(ls plum/ep17/music_v95/*.mp3 2>/dev/null | wc -l)
  echo "downloaded: $n"
  [ "$n" -ge 20 ] && { echo "ALL 20 OK"; kill_chrome; exit 0; }
done
kill_chrome; echo "INCOMPLETE"; exit 1
