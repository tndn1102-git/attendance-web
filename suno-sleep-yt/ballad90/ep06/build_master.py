# -*- coding: utf-8 -*-
r"""
EP06 마스터 빌드 — 채택 테이크 8곡을 하나로 잇는다.

스펙(NEXT-90년대가요채널.md / CLAUDE.md 믹스 규칙):
  · 곡 간 이음 = **크로스페이드 금지. 무음 1.6초 하드컷.**
    발라드는 리타르단도로 끝나서 겹치면 앞 곡 종지가 죽는다.
  · 라우드니스 = I −14 LUFS / TP −1.5 / 곡 간 편차 1 LU 이내

🔴 **꼬리 트림 안 함.** EP02에서 "꼬리 24~77초" 판정이 나왔지만 사용자 청취로 뒤집혔다
   ("노래가 끝까지 나오네 자를 필요 없어"). 원인은 뒤쪽 35% 안 **20초 고정 창** 방식이었고,
   보컬 대역(300~3400Hz)으로 다시 재니 실제 꼬리는 0.0~2.4초였다.
   📏 오디오의 "끝"을 고정 시간 창으로 재지 말 것 — 창 길이가 곧 답이 된다.
   자를 곡이 있으면 `tools\find_tail.py` 실측값으로만 판단한다.

방법: 곡별 실측 I 를 재서 선형 게인으로 −14 에 정렬 → 무음 넣어 concat → 트루피크 리미팅.
  ⚠ loudnorm 을 두 번 걸지 않는다(펌핑). 정렬은 게인, 안전은 리미터가 맡는다.
"""
import io, os, sys, json, re, subprocess

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
MUSIC = os.path.join(HERE, 'pick')   # 채택본만 01_~08_ 순번 붙여 복사해둔 폴더
WORK = os.path.join(HERE, 'audio')
os.makedirs(WORK, exist_ok=True)

GAP = 1.6
TARGET_I = -14.0

# 🔊 [2026-08-19 사용자 청취 확정 "보정이 더 낫다"] 고역 셸빙 = **음색 교정의 본체**
#   왜 = 옥탑방 210곡 실측 대비 우리 보컬이 air(8~16k) +2.42dB · pres(4~8k) +2.74dB 밝았다.
#        STYLE 의 `highs rolled off above seven kilohertz` 는 **EP04·EP06 두 편 연속 한 번도 안 먹었다.**
#        → 프롬프트를 더 미는 대신 **여기서 결정론적으로** 건다.
#   값  = g=-3 이 레퍼 중앙값에 안착(air -8.55/목표 -8.96 · pres -7.71/목표 -8.16). g=-2 는 부족, -4 는 과함.
#   ⚠️ 셸빙이 I 를 0.2~0.4dB 낮추므로 **게인 정렬보다 먼저** 걸고, 정렬은 셸빙 후 값으로 다시 잰다.
SHELF = 'highshelf=f=4500:g=-3:t=q:w=0.7'

TARGET_TP = -1.5

# 채택 = 음악감독 에이전트 판정 + Claude 교차검토 (CLAUDE.md §🎚). 근거 = `_테이크선택.md`
PICKS = sorted(f for f in os.listdir(MUSIC) if f.lower().endswith('.mp3'))
if len(PICKS) != 8:
    sys.exit('채택본이 8개가 아니다: %d개 (%s)' % (len(PICKS), MUSIC))


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True,
                          encoding='utf-8', errors='replace')


def measure(path):
    r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', path,
             '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'])
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S)
    return float(json.loads(m.group(0))['input_i'])


def dur(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=nw=1:nk=1', path])
    return float(r.stdout.strip())


print('■ 곡별 셸빙(%s) + 정렬 (목표 I = %.1f)' % (SHELF, TARGET_I))
print('%-24s %8s %8s %8s' % ('곡', '실측 I', '게인', '길이'))
print('-' * 54)
parts, total = [], 0.0
for i, fn in enumerate(PICKS, 1):
    src = os.path.join(MUSIC, fn)
    d = dur(src); total += d
    out = os.path.join(WORK, '%02d.wav' % i)
    # ① 셸빙 먼저 -> ② 그 결과를 재서 게인 정렬. 순서를 바꾸면 I 가 목표에서 밀린다.
    pre = os.path.join(WORK, '_pre%02d.wav' % i)
    run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src,
         '-af', SHELF, '-ar', '48000', '-ac', '2', pre])
    i_in = measure(pre)
    gain = TARGET_I - i_in
    run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', pre,
         '-af', 'volume=%.2fdB' % gain, '-ar', '48000', '-ac', '2', out])
    os.remove(pre)
    parts.append(out)
    print('%-24s %8.1f %+8.2f %5d:%02d' % (fn[:24], i_in, gain, int(d) // 60, int(d) % 60))

sil = os.path.join(WORK, '_gap.wav')
run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
     '-i', 'anullsrc=r=48000:cl=stereo', '-t', str(GAP), sil])

lst = os.path.join(WORK, '_concat.txt')
with open(lst, 'w', encoding='utf-8') as f:
    for i, p in enumerate(parts):
        f.write("file '%s'\n" % p.replace('\\', '/'))
        if i < len(parts) - 1:
            f.write("file '%s'\n" % sil.replace('\\', '/'))

master = os.path.join(WORK, 'ep06_master.wav')
run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
     '-i', lst, '-af', 'alimiter=limit=%fdB:level=disabled' % TARGET_TP, '-ar', '48000', master])

md = dur(master)
r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', master,
         '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'])
d = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S).group(0))

print('\n■ 마스터')
print('   %s' % master)
print('   길이 %d:%02d:%02d  (곡 %d개 + 무음 %.1fs × %d)'
      % (int(md) // 3600, int(md) % 3600 // 60, int(md) % 60, len(parts), GAP, len(parts) - 1))
print('   I %.2f LUFS / TP %.2f dBTP / LRA %.2f'
      % (float(d['input_i']), float(d['input_tp']), float(d['input_lra'])))
print('   곡 순수 합계 %d:%02d' % (int(total) // 60, int(total) % 60))
