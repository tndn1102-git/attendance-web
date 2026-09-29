import json,io
p='plum/_assets/thumb_colors.json'
d=json.load(io.open(p,encoding='utf-8'))
d['episodes']['EP17']={"color":"#3A1E40","name":"딥 그레이프",
 "why":"씬의 보라 포도송이(테이블 접시·창밖 포도밭)를 잉크처럼 눌렀다(접시 포도 실측 중앙 #2F1A33 → 한 단 밝힘). 텍스트 자리는 흰 벽·창틀·하늘이라 어두운 보라가 분리된다. 직전 EP16 번트 탠저린(주황)과 색상각이 멀고, 같은 보라 계열 EP01 플럼(#58244E)과는 16편 떨어져 있다",
 "bg":"와이너리 카페 창가 자리 · 앉은 1인칭 비정면 시점 · 전경 카푸치노+포도 · 열린 코너 창 너머 보라 포도밭 · 잠든 고양이 · 가을 5편째 · 음미 테마",
 "contrast":None}
io.open(p,'w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=1))
