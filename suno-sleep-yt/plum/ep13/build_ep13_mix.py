# -*- coding: utf-8 -*-
r"""
plum music EP13 오디오 믹스 — EP12 빌더 복제 (2026-09-10 · 가을 전환 첫 편 · 곡 축 EP11·12 동일)

  py -3 build_ep13_mix.py [곡폴더] [출력wav]

⚠️ EP10 복제본. 복제 시 문구·파일명 전수 대조했다.
   🔴 채택 = V9.5 20트랙 전량(2026-09-07 사용자 청취 확정 "9.5는 통과 7.6은 사용하면 안됨").
   V7.6 20트랙은 처방을 다 적용하고도 EP10 을 재현해 전량 폐기했다(2초+유성 0.396 vs V9.5 0.000).
🔧 EP12 변경점: 곡 파일명이 Suno식 'title.mp3/title_1.mp3'가 아니라
   **mureka_download.js 식 'NN_title.mp3'**(NN=01~20, 홀=테이크A·짝=테이크B)다.
   base_name 은 앞 번호를 떼고 제목으로 짝을 짓는다.

■ 구조 (CLAUDE.md §1-6)  유니크 20트랙 -> 정수배 4회
■ 곡 간 이음 (§1-7)  크로스페이드 금지 · 꼬리 무가공 · 무음 0.3~1.2s 랜덤
■ 라우드니스 (§1-8)  I -14 / TP -1.5 / LRA 5, 2-pass · 측정 패스 -v error 금지 · -ac 2 필수
"""
import os, sys, io, json, math, random, subprocess, tempfile, glob

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'music')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'audio', 'ep13_mix.wav')
LOOPS = 3   # 유니크 72.1분(V9.5 20트랙) × 3회 = 3.60h — cherry 현행 중앙 3.43h·p75 3.86h 사이. 4회면 4.81h 로 p90 초과
EXCLUDE = set()
GAP_LO, GAP_HI = 0.30, 1.20
SEED = 20260918080
SR, LUFS, TP, LRA = 44100, -14.0, -1.5, 5.0

os.makedirs(os.path.dirname(OUT), exist_ok=True)
random.seed(SEED)


def dur(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                 '-of', 'csv=p=0', p], capture_output=True, text=True).stdout or 0)


def base_name(p):
    """'02a_i can see out from anywhere.mp3' -> 'i can see out from anywhere' (테이크 짝 찾기용)
    접두 = 곡번호 2자리 + 테이크 문자(a/b). music_final 풀 명명 규칙."""
    n = os.path.splitext(os.path.basename(p))[0]
    head = n.split('_', 1)[0] if '_' in n else ''
    return n.split('_', 1)[1] if head and head[:2].isdigit() else n


files = sorted(glob.glob(os.path.join(SRC, '*.mp3')))
if not files:
    sys.exit(f'mp3 없음: {SRC}')
dropped = [f for f in files if os.path.splitext(os.path.basename(f))[0] in EXCLUDE]
files = [f for f in files if f not in dropped]
for f in dropped:
    print(f'제외 {os.path.basename(f)}')
groups = {}
for f in files:
    groups.setdefault(base_name(f), []).append(f)
print(f'곡 {len(groups)}개 · 트랙 {len(files)}개 · 유니크 {sum(dur(f) for f in files)/60:.1f}분')
assert len(groups) == 10 and len(files) == 20, '⛔ 곡/트랙 수가 10/20 이 아니다 — 파일명 짝짓기 확인'


def order_round(rnd):
    keys = list(groups.keys())
    rnd.shuffle(keys)
    first = [groups[k][0] for k in keys]
    second = [groups[k][-1] for k in keys if len(groups[k]) > 1]
    rnd.shuffle(second)
    return first + second


rounds = []
for i in range(LOOPS):
    rnd = random.Random(SEED + i * 977)
    rounds.append(order_round(rnd))
seq = [f for r in rounds for f in r]

gaps = [round(random.uniform(GAP_LO, GAP_HI), 3) for _ in range(len(seq) - 1)]
total = sum(dur(f) for f in seq) + sum(gaps)
print(f'루프 {LOOPS}회 · 총 {len(seq)}트랙 · 예상 {total/3600:.2f}시간')
print(f'무음 평균 {sum(gaps)/len(gaps)*1000:.0f}ms (범위 {GAP_LO*1000:.0f}~{GAP_HI*1000:.0f}ms)')

import shutil
TMPDIR = os.path.join(os.path.dirname(os.path.abspath(OUT)), '_tmp')
os.makedirs(TMPDIR, exist_ok=True)
_free = shutil.disk_usage(TMPDIR).free / 1e9
print('임시 폴더 %s · 여유 %.1fGB (필요 약 6GB)' % (TMPDIR, _free))
if _free < 7.0:
    sys.exit('⛔ 디스크 여유 부족: %.1fGB. 7GB 이상 확보 후 다시 실행하라.' % _free)

with tempfile.TemporaryDirectory(dir=TMPDIR) as td:
    parts = []
    for i, f in enumerate(seq):
        w = os.path.join(td, f'{i:04d}.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f,
                        '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_s16le', w], check=True)
        parts.append(w)
        if i < len(gaps):
            g = os.path.join(td, f'{i:04d}_gap.wav')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi',
                            '-i', f'anullsrc=r={SR}:cl=stereo', '-t', str(gaps[i]),
                            '-c:a', 'pcm_s16le', g], check=True)
            parts.append(g)
    lst = os.path.join(td, 'list.txt')
    with open(lst, 'w', encoding='utf-8') as fp:
        for p in parts:
            fp.write("file '" + p.replace('\\', '/') + "'\n")
    raw = os.path.join(td, 'raw.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0',
                    '-i', lst, '-c', 'copy', raw], check=True)
    print(f'이어붙임 완료 {dur(raw)/3600:.2f}시간')

    print('라우드니스 측정 중...')
    p = subprocess.run(['ffmpeg', '-hide_banner', '-i', raw, '-ac', '2',
                        '-af', f'loudnorm=I={LUFS}:TP={TP}:LRA={LRA}:print_format=json',
                        '-f', 'null', '-'], capture_output=True, text=True, errors='ignore')
    s = p.stderr
    j = json.loads(s[s.rindex('{'):s.rindex('}') + 1])
    print(f'  측정 I={j["input_i"]} TP={j["input_tp"]} LRA={j["input_lra"]}')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-ac', '2', '-ar', str(SR),
                    '-af', (f'loudnorm=I={LUFS}:TP={TP}:LRA={LRA}'
                            f':measured_I={j["input_i"]}:measured_TP={j["input_tp"]}'
                            f':measured_LRA={j["input_lra"]}:measured_thresh={j["input_thresh"]}'
                            f':offset={j["target_offset"]}:linear=true:print_format=summary'),
                    '-c:a', 'pcm_s16le', OUT], check=True)

tl, t = [], 0.0
for i, f in enumerate(seq):
    tl.append({'i': i + 1, 'at': round(t, 2),
               'ts': f'{int(t//3600)}:{int(t%3600//60):02d}:{int(t%60):02d}' if t >= 3600
                     else f'{int(t//60)}:{int(t%60):02d}',
               'title': base_name(f)})
    t += dur(f) + (gaps[i] if i < len(gaps) else 0)
json.dump({'loops': LOOPS, 'seed': SEED, 'total_sec': round(t, 1), 'tracks': tl},
          open(os.path.join(HERE, 'tracklist_ep13.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

print(f'\n완료 → {OUT}  ({dur(OUT)/3600:.2f}시간, {os.path.getsize(OUT)/1e9:.2f}GB)')
print(f'트랙리스트 → tracklist_ep13.json')
print('\n첫 바퀴 순서 (고정댓글은 1바퀴만 쓴다):')
for r in tl[:len(rounds[0])]:
    print(f'  {r["ts"]:>7}  {r["title"]}')
