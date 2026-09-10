#!/bin/sh
# 감성가요 한 편 Mureka V7.6 생성 + feed 직다운로드 (EP09 _dl_loop.sh 방식)
#   sh ballad90/_mureka_ep.sh ep10 2,4,7
cd /d/test3/suno-sleep-yt || exit 1
EP=$1; MALE=$2
P=ballad90/$EP/mureka-prompts-ballad90-$EP.txt
D=ballad90/$EP
kill_chrome() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*pw-profile*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  sleep 3
}
[ -f "$P" ] || { echo "no prompt file $P"; exit 1; }
if [ ! -f "$D/_gen_v76.log" ] || ! grep -q "제출 완료" "$D/_gen_v76.log"; then
  kill_chrome
  echo "=== submit $EP male=$MALE $(date +%H:%M:%S) ==="
  node tools/mureka_generate.js "$P" --model V7.6 --male-songs "$MALE" > "$D/_gen_v76.log" 2>&1
  cat "$D/_gen_v76.log" | grep "제출\|rror\|모델"
  grep -q "제출 완료" "$D/_gen_v76.log" || { echo "SUBMIT FAIL"; exit 2; }
fi
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  sleep 75; kill_chrome
  echo "=== dl try $i $(date +%H:%M:%S) ==="
  node tools/_mureka_lib_click.js "$D/_feed_v76.json" 2>&1 | tail -1
  py -3 tools/mureka_fetch_dl.py "$D/_feed_v76.json" "$P" "$D/music" --model V7.6 2>&1 | tail -3
  n=$(ls "$D"/music/*.mp3 2>/dev/null | wc -l)
  echo "downloaded: $n"
  [ "$n" -ge 16 ] && { echo "ALL 16 OK"; kill_chrome; exit 0; }
done
kill_chrome
echo "INCOMPLETE"; exit 1
