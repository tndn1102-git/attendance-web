# -*- coding: utf-8 -*-
r"""EP11 쇼츠 2편 업로드 계획 — py -3 ballad90\ep11\_make_shorts_plan.py <본편ID>
쇼츠15 = 10-02(금) 19:00 곡4「들켰어」 · 쇼츠16 = 10-04(일) 19:00 곡3「양보」 (둘 다 본편 발췌)"""
import io, json, sys, os
MAIN = sys.argv[1]
R = r'D:\test3\suno-sleep-yt\ballad90\shorts'
def desc(hook, song, sec):
    return (f"{hook} — VOL.11 전곡 듣기\n▶ https://youtu.be/{MAIN}\n\n「{song}」 후렴 {sec}초.\n"
            "가사는 직접 쓰고, 그 시절의 소리로 만든 창작곡입니다.\n\n"
            "▶ 구독 https://youtube.com/@chueokgamsung?sub_confirmation=1\n\n"
            "#감성가요 #추억의노래 #2000년대가요 #발라드 #플레이리스트 #설렘 #가을노래 #기차여행 #korean_ballad #2000s #shorts")
plan = [
 {'file': os.path.join(R, 'short_ep11a.mp4'), 'title': '터널에 들어서자 창에 비친 눈이 마주쳤어 🚃 2000년대 감성 가요 #감성가요 #2000년대 #설렘',
  'description': desc('터널 속 기차 창에 비친 눈이 너와 마주쳤던 순간', '들켰어', 45), 'publishAt': '2026-10-02T10:00:00Z'},
 {'file': os.path.join(R, 'short_ep11b.mp4'), 'title': '창가는 양보하고 창밖 보는 너를 봤어 🍂 2000년대 감성 가요 #감성가요 #2000년대 #설렘',
  'description': desc('창가 자리를 양보하고 창밖 보는 너만 보던 가을 기차', '양보', 45), 'publishAt': '2026-10-04T10:00:00Z'},
]
json.dump(plan, io.open(os.path.join(R, '_upload_plan_ep11.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('plan ->', os.path.join(R, '_upload_plan_ep11.json'))
