#!/bin/sh
# plum EP17 한 곡 V9.5 재생성 + 다운로드.  sh plum/ep17/_regen.sh 4
cd /d/test3/suno-sleep-yt || exit 1
I=$1; P=plum/ep17/mureka-prompts-plum-ep17.txt; D=plum/ep17; OUT=$D/_regen_dl_$I
kill_chrome() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*pw-profile*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  sleep 3
}
MALE=""; [ "$I" = "5" ] && MALE="--male-songs 5"
if ! grep -q "제출 완료" "$D/_regen_$I.log" 2>/dev/null; then
  kill_chrome
  node tools/mureka_generate.js "$P" --model V9.5 --start "$I" --end "$I" $MALE > "$D/_regen_$I.log" 2>&1
  grep "제출\|rror" "$D/_regen_$I.log"; grep -q "제출 완료" "$D/_regen_$I.log" || { echo "SUBMIT FAIL $I"; exit 2; }
fi
NA=$(printf %02d $((I*2-1))); NB=$(printf %02d $((I*2)))
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 75; kill_chrome
  echo "=== regen $I dl try $i $(date +%H:%M:%S) ==="
  node tools/_mureka_lib_click.js "$D/_feed_regen_$I.json" 2>&1 | tail -1
  rm -rf "$OUT"; py -3 tools/mureka_fetch_dl.py "$D/_feed_regen_$I.json" "$P" "$OUT" --model V9.5 > /dev/null 2>&1
  a=$(ls "$OUT"/${NA}_*.mp3 2>/dev/null | head -1); b=$(ls "$OUT"/${NB}_*.mp3 2>/dev/null | head -1)
  if [ -n "$a" ] && [ -n "$b" ]; then
    oa=$(ls "$D"/music_v95/${NA}_*.mp3 | head -1)
    if [ "$(stat -c %s "$a")" != "$(stat -c %s "$oa")" ]; then
      mkdir -p "$D/_regen"; cp "$a" "$D/_regen/r${NA}_$(basename "$a" | cut -d_ -f2-)"; cp "$b" "$D/_regen/r${NB}_$(basename "$b" | cut -d_ -f2-)"
      echo "REGEN OK $I"; kill_chrome; exit 0
    fi
  fi
  echo "not yet"
done
kill_chrome; echo "INCOMPLETE $I"; exit 1
