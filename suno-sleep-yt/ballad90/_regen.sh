#!/bin/sh
# 감성가요 한 곡 재생성 + 다운로드.  sh ballad90/_regen.sh ep11 5 V9.5 5   (ep · 곡번호 · 모델 · 남성곡번호 또는 -)
cd /d/test3/suno-sleep-yt || exit 1
EP=$1; I=$2; MODEL=$3; MALE=$4
P=ballad90/$EP/mureka-prompts-ballad90-$EP.txt; D=ballad90/$EP
TAG=${MODEL}_$I; OUT=$D/_regen_$TAG
kill_chrome() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*pw-profile*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
  sleep 3
}
if ! grep -q "제출 완료" "$D/_regen_$TAG.log" 2>/dev/null; then
  kill_chrome
  if [ "$MALE" = "-" ]; then
    node tools/mureka_generate.js "$P" --model "$MODEL" --start "$I" --end "$I" > "$D/_regen_$TAG.log" 2>&1
  else
    node tools/mureka_generate.js "$P" --model "$MODEL" --start "$I" --end "$I" --male-songs "$MALE" > "$D/_regen_$TAG.log" 2>&1
  fi
  grep "제출\|rror\|모델" "$D/_regen_$TAG.log"
  grep -q "제출 완료" "$D/_regen_$TAG.log" || { echo "SUBMIT FAIL $TAG"; exit 2; }
fi
NA=$(printf %02d $((I*2-1))); NB=$(printf %02d $((I*2)))
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 75; kill_chrome
  echo "=== $TAG dl try $i $(date +%H:%M:%S) ==="
  node tools/_mureka_lib_click.js "$D/_feed_regen_$TAG.json" 2>&1 | tail -1
  rm -rf "$OUT"
  py -3 tools/mureka_fetch_dl.py "$D/_feed_regen_$TAG.json" "$P" "$OUT" --model "$MODEL" > /dev/null 2>&1
  a=$(ls "$OUT"/${NA}_*.mp3 2>/dev/null | head -1); b=$(ls "$OUT"/${NB}_*.mp3 2>/dev/null | head -1)
  if [ -n "$a" ] && [ -n "$b" ]; then
    t=$(basename "$a" .mp3); t=${t#*_}
    sa=$(stat -c %s "$a"); o1=$(stat -c %s "$D/music/$t.mp3" 2>/dev/null); o2=$(stat -c %s "$D/music/${t}_1.mp3" 2>/dev/null)
    if [ "$sa" != "$o1" ] && [ "$sa" != "$o2" ]; then
      mkdir -p "$D/_regen"
      cp "$a" "$D/_regen/${t}_${MODEL}a.mp3"; cp "$b" "$D/_regen/${t}_${MODEL}b.mp3"
      echo "REGEN OK $TAG -> $D/_regen/${t}_${MODEL}a/b.mp3"; kill_chrome; exit 0
    fi
  fi
  echo "not yet"
done
kill_chrome; echo "INCOMPLETE $TAG"; exit 1
