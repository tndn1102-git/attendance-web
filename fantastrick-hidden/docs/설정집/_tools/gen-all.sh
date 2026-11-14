#!/bin/bash
# 설정집 그림 일괄 생성 (제미나이 웹, GeminiAuto 크롬 CDP 9225)
# 사용: bash gen-all.sh [키...]   (키 없으면 raw/에 없는 것 전부)
cd "$(dirname "$0")"
RAW=../raw; mkdir -p "$RAW"
KEYS="$@"
if [ -z "$KEYS" ]; then KEYS=$(node -e "const p=require('./prompts.json');console.log(p.items.map(i=>i[0]).join(' '))"); fi
for k in $KEYS; do
  [ -f "$RAW/$k.png" ] && { echo "SKIP $k"; continue; }
  P=$(node -e "const p=require('./prompts.json');const it=p.items.find(i=>i[0]==='$k');console.log(it[1]+' '+p.style)")
  for try in 1 2; do
    echo "== $k (try $try)"
    node D:/test2/naver-blog-family/_tools/gemini-image.js "$RAW/$k.png" "$P" && break
  done
done
echo ALLDONE
