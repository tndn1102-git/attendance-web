# -*- coding: utf-8 -*-
r"""EP18 채택 풀 — 신곡 V9.5 18테이크 + 재활용 1곡 2테이크 = 20트랙.
  py -3 plum\ep18\_build_pool.py
10월 상한(10생성·다시 뽑기 없음): 보컬 6축 탈락 테이크(11 F0 339Hz · 14 멜리스마 2.39)는 빼고,
그 두 자리를 쇼츠 미사용 예전 곡 1곡(EP16 the quiet holds it for me, CLAP 0.065/0.067)으로 채운다.
CLAP ❌인 남성 #9(0.125/0.118)는 EP14 전례(0.13대 채택) 안이라 유지. 베이스 점유 X 는 V9.5 공통이라 판정 제외.
"""
import io, json, os, re, shutil, subprocess, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(HERE, 'music_final'); os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.mp3'): os.remove(os.path.join(OUT, f))
clap = {}
for ln in io.open(os.path.join(HERE, '_clap_v95.txt'), encoding='utf-8'):
    m = re.match(r'^\S+\s+([0-9.]+)\s+\(.*?\)\s+\S+\s+[-0-9.]+\s+(\d{2}_.+\.mp3)\s*$', ln.strip())
    if m: clap[m.group(2)] = float(m.group(1))
DROP = {'11_arms out wide.mp3', '14_no edges in here.mp3'}
REUSE = (11, 'ep16', 'the quiet holds it for me')
dur = lambda p: float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p],capture_output=True,text=True).stdout)
pool = []
src_dir = os.path.join(HERE, 'music_v95')
for f in sorted(os.listdir(src_dir)):
    if not f.endswith('.mp3') or f in DROP: continue
    nn = int(f[:2]); s = (nn + 1) // 2
    shutil.copy(os.path.join(src_dir, f), os.path.join(OUT, f))
    pool.append(dict(song=s, take='ab'[(nn + 1) % 2], title=f[3:-4], file=f, model='V9.5', src='plum/ep18/music_v95/' + f,
                     clap=clap.get(f), _regen=False, dur=round(dur(os.path.join(OUT, f)), 1)))
s, ep, title = REUSE
old = json.load(io.open(os.path.join(ROOT, 'plum', ep, 'music_final', '_pool.json'), encoding='utf-8'))
ts = [t for t in old if t['title'] == title]; assert len(ts) == 2, title
for k, t in enumerate(ts):
    fn = '%02d_%s.mp3' % (s * 2 - 1 + k, title)
    shutil.copy(os.path.join(ROOT, 'plum', ep, 'music_final', t['file']), os.path.join(OUT, fn))
    pool.append(dict(song=s, take='ab'[k], title=title, file=fn, model='V9.5', src='plum/%s/music_final/%s' % (ep, t['file']),
                     clap=t.get('clap'), _regen=False, _reuse=ep, dur=round(dur(os.path.join(OUT, fn)), 1)))
json.dump(pool, io.open(os.path.join(OUT, '_pool.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for p in pool: print(p['file'], p['clap'], p.get('_reuse', ''), p['dur'])
print('%d트랙 · 곡 %d · 유니크 %.1f분' % (len(pool), len({p['title'] for p in pool}), sum(p['dur'] for p in pool) / 60))
