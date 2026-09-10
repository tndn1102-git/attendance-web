# -*- coding: utf-8 -*-
r"""EP10 쇼츠 2편 업로드 계획 — py -3 ballad90\ep10\_make_shorts_plan.py <본편ID>
쇼츠13 = 09-25(금) 19:00 곡1「바통」 · 쇼츠14 = 09-27(일) 19:00 곡6「가만있어 봐」 (둘 다 본편 발췌)"""
import io, json, sys, os
MAIN = sys.argv[1]
R = r'D:\test3\suno-sleep-yt\ballad90\shorts'
def desc(hook, song, sec):
    return (f"{hook} — VOL.10 전곡 듣기\n▶ https://youtu.be/{MAIN}\n\n「{song}」 후렴 {sec}초.\n"
            "가사는 직접 쓰고, 그 시절의 소리로 만든 창작곡입니다.\n\n"
            "▶ 구독 https://youtube.com/@chueokgamsung?sub_confirmation=1\n\n"
            "#감성가요 #추억의노래 #2000년대가요 #발라드 #플레이리스트 #설렘 #가을노래 #체육대회 #korean_ballad #2000s #shorts")
plan = [
 {'file': os.path.join(R, 'short_ep10a.mp4'), 'title': '바통 넘겨받는데 네 손이 닿았어 🏃 2000년대 감성 가요 #감성가요 #2000년대 #설렘',
  'description': desc('계주 바통을 넘겨받던 순간 손이 닿았던 그날', '바통', 45), 'publishAt': '2026-09-25T10:00:00Z'},
 {'file': os.path.join(R, 'short_ep10b.mp4'), 'title': '가만있어 봐, 머리에 종이꽃 붙었어 🍂 2000년대 감성 가요 #감성가요 #2000년대 #설렘',
  'description': desc('박이 터지고 네 앞머리에 붙은 종이꽃을 떼어 주던 날', '가만있어 봐', 45), 'publishAt': '2026-09-27T10:00:00Z'},
]
json.dump(plan, io.open(os.path.join(R, '_upload_plan_ep10.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('plan ->', os.path.join(R, '_upload_plan_ep10.json'))
