# -*- coding: utf-8 -*-
r"""EP16 채택 풀 — 곡마다 (원본 2 + 재생성 2) 중 CLAP 거리가 가장 작은 2테이크를 music_final 로.
  py -3 plum\ep16\_build_pool.py
입력 = _clap_v95.txt · _clap_regen.txt (clap_gate.py 출력) · 보컬축은 두 게이트 모두 통과(원본 20/20 · 재생성은 _vocal_regen.txt 로 눈으로 확인)
채택 기준 = EP11·EP12 와 같다: 보컬축 통과 + CLAP 거리 작은 순. (믹스축 베이스 점유 X 는 V9.5 공통 패턴이라 판정 제외 — EP11 사용자 통과 전례)
출력 = music_final/NN_<제목>.mp3 (NN = 곡번호*2-1, *2) + music_final/_pool.json (EP12 형식)
"""
import io, json, os, re, shutil, subprocess, sys
if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'music_final')

def parse(txt, folder, regen):
    rows = []
    for ln in io.open(os.path.join(HERE, txt), encoding='utf-8'):
        m = re.match(r'^\S+\s+([0-9.]+)\s+\(.*?\)\s+\S+\s+[-0-9.]+\s+(r?)(\d{2})_(.+\.mp3)\s*$', ln.strip())
        if not m:
            continue
        clap, r, nn, title = float(m.group(1)), m.group(2), int(m.group(3)), m.group(4)
        song = (nn + 1) // 2
        fn = '%s%02d_%s' % (r, nn, title)
        rows.append(dict(song=song, title=title[:-4], clap=clap, _regen=regen,
                         src=os.path.join(folder, fn).replace('\\', '/')))
    return rows

cands = parse('_clap_v95.txt', 'plum/ep16/music_v95', False)
if os.path.exists(os.path.join(HERE, '_clap_regen.txt')):
    cands += parse('_clap_regen.txt', 'plum/ep16/_regen', True)
assert len({c['song'] for c in cands}) == 10, '곡 10개가 안 잡혔다 — clap 출력 파싱 확인'

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.mp3'):
        os.remove(os.path.join(OUT, f))
pool = []
for s in range(1, 11):
    best = sorted([c for c in cands if c['song'] == s], key=lambda c: c['clap'])[:2]
    for k, c in enumerate(best):
        nn = s * 2 - 1 + k
        fn = '%02d_%s.mp3' % (nn, c['title'])
        shutil.copy(os.path.join(HERE, '..', '..', c['src']), os.path.join(OUT, fn))
        d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                                  os.path.join(OUT, fn)], capture_output=True, text=True).stdout)
        pool.append(dict(song=s, take='ab'[k], title=c['title'], file=fn, model='V9.5', src=c['src'],
                         clap=c['clap'], _regen=c['_regen'], dur=round(d, 1)))
        mark = '✅' if c['clap'] <= 0.084 else ('△' if c['clap'] <= 0.12 else '❌')
        print('%2d%s %s %.3f %s %s' % (s, 'ab'[k], mark, c['clap'], 'R' if c['_regen'] else ' ', fn))
json.dump(pool, io.open(os.path.join(OUT, '_pool.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
tot = sum(p['dur'] for p in pool)
cnt = {m: sum(1 for p in pool if (p['clap'] <= 0.084) == (m == '✅') and (m != '△' or 0.084 < p['clap'] <= 0.12)) for m in ('✅',)}
print('\n20트랙 · 유니크 %.1f분 · ✅%d △%d ❌%d' % (tot / 60, sum(p['clap'] <= 0.084 for p in pool),
      sum(0.084 < p['clap'] <= 0.12 for p in pool), sum(p['clap'] > 0.12 for p in pool)))
