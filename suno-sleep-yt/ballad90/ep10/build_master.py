# -*- coding: utf-8 -*-
r"""
EP10 마스터 빌드 — 채택 테이크 8곡을 하나로 잇는다.

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

# 🔊 [2026-09-02 EP08 실측으로 **셸빙 미적용**] — 옛 셸빙(-3dB)은 Suno 보컬 교정값이었다.
#   Suno 실측(EP05~07) = 레퍼(옥탑방 air 중앙 -8.96) 대비 +2.4dB 밝음 → g=-3 이 정답이었다.
#   **Mureka V7.6 실측(EP08 채택 8곡, _air08.json) = air -12.2 ~ -19.5 = 레퍼보다 이미 3~10dB 어둡다.**
#   여기에 -3dB 를 더 걸면 반대 방향 과교정 + 사용자가 승인한 "밝고 산뜻" 소리를 죽인다 → OFF.
#   ⚠️ 플랫폼이 바뀌면 셸빙 여부는 반드시 m_air 재실측으로 정할 것 (Suno 로 돌아가면 -3 복원).
SHELF = None  # Mureka = 미적용 (Suno 시절 값: 'highshelf=f=4500:g=-3:t=q:w=0.7')

TARGET_TP = -1.5

# 채택 = 음악감독 에이전트 판정 + Claude 교차검토 (CLAUDE.md §🎚). 근거 = `_테이크선택.md`
PICKS = sorted(f for f in os.listdir(MUSIC) if f.lower().endswith('.mp3'))
# 💳 편당 생성 상한(12)에 걸리면 그 곡을 빼고 7곡으로 편성한다(CLAUDE.md §💳🔝🔴 2026-09-10)
if len(PICKS) not in (7, 8):
    sys.exit('채택본이 7~8개가 아니다: %d개 (%s)' % (len(PICKS), MUSIC))


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


print('■ 곡별 %s + 정렬 (목표 I = %.1f)' % ('셸빙(%s)' % SHELF if SHELF else '셸빙 없음(Mureka)', TARGET_I))
print('%-24s %8s %8s %8s' % ('곡', '실측 I', '게인', '길이'))
print('-' * 54)
parts, total = [], 0.0
for i, fn in enumerate(PICKS, 1):
    src = os.path.join(MUSIC, fn)
    d = dur(src); total += d
    out = os.path.join(WORK, '%02d.wav' % i)
    # ① (셸빙이 있으면) 먼저 -> ② 그 결과를 재서 게인 정렬. 순서를 바꾸면 I 가 목표에서 밀린다.
    if SHELF:
        pre = os.path.join(WORK, '_pre%02d.wav' % i)
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src,
             '-af', SHELF, '-ar', '48000', '-ac', '2', pre])
        i_in = measure(pre)
        gain = TARGET_I - i_in
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', pre,
             '-af', 'volume=%.2fdB' % gain, '-ar', '48000', '-ac', '2', out])
        os.remove(pre)
    else:
        i_in = measure(src)
        gain = TARGET_I - i_in
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src,
             '-af', 'volume=%.2fdB' % gain, '-ar', '48000', '-ac', '2', out])
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

master = os.path.join(WORK, 'ep10_master.wav')
run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
     '-i', lst, '-af', 'alimiter=limit=%fdB:level=disabled' % TARGET_TP, '-ar', '48000', master])

# 🔴 트루피크 트림 (EP08·EP09 두 편 연속 alimiter 가 인터샘플 피크를 +0.28dB 놓쳤다 → 상수로 박음)
#   재서 TP 가 목표(-1.5)보다 높으면 목표-0.1 로 볼륨만 내린다. 트림 전 파일은 _pretrim 으로 보존.
TRIM_TO = -1.6
def tp_of(path):
    rr = run(['ffmpeg', '-hide_banner', '-nostats', '-i', path,
              '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'])
    return float(json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', rr.stderr, re.S).group(0))['input_tp'])
tp0 = tp_of(master)
if tp0 > TARGET_TP:
    pre = master.replace('_master.wav', '_master_pretrim.wav')
    os.replace(master, pre)
    trim = TRIM_TO - tp0
    run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', pre,
         '-af', 'volume=%.2fdB' % trim, '-ar', '48000', '-c:a', 'pcm_s16le', master])
    print('   🔧 트루피크 트림: TP %.2f -> 볼륨 %+.2fdB (원본 %s)' % (tp0, trim, os.path.basename(pre)))

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
