# -*- coding: utf-8 -*-
r"""EP17 풀 — 신곡 1~6(V9.5 원본 2테이크씩) + 재활용 4곡(2026-09-29 사용자 제안 "이전 곡 4개 재활용").
Mureka 잔량 20 Gold 로 #7~#10 제출 실패 → 10월치 크레딧을 당겨 쓰지 않으려고 과거 편 곡을 재사용.
선정 = 쇼츠 미사용 · V9.5 · 두 테이크 CLAP 양호 · 자리 결(밝음2·여운2) 맞춤.
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
REUSE = [(7, 'ep14', 'one thought at a time'), (8, 'ep15', 'i follow it in'),
         (9, 'ep12', 'i will be back before i mean to'), (10, 'ep13', 'something in me unclenched')]
dur = lambda p: float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p],capture_output=True,text=True).stdout)
pool = []
for s in range(1, 7):
    for k in range(2):
        nn = s*2-1+k
        src = [f for f in os.listdir(os.path.join(HERE,'music_v95')) if f.startswith('%02d_' % nn)][0]
        shutil.copy(os.path.join(HERE,'music_v95',src), os.path.join(OUT, src))
        pool.append(dict(song=s, take='ab'[k], title=src[3:-4], file=src, model='V9.5', src='plum/ep17/music_v95/'+src,
                         clap=clap.get(src), _regen=False, dur=round(dur(os.path.join(OUT,src)),1)))
for s, ep, title in REUSE:
    old = json.load(io.open(os.path.join(ROOT,'plum',ep,'music_final','_pool.json'),encoding='utf-8'))
    ts = [t for t in old if t['title'] == title]; assert len(ts) == 2, title
    for k, t in enumerate(ts):
        fn = '%02d_%s.mp3' % (s*2-1+k, title)
        shutil.copy(os.path.join(ROOT,'plum',ep,'music_final',t['file']), os.path.join(OUT, fn))
        pool.append(dict(song=s, take='ab'[k], title=title, file=fn, model='V9.5', src='plum/%s/music_final/%s' % (ep, t['file']),
                         clap=t.get('clap'), _regen=False, _reuse=ep, dur=round(dur(os.path.join(OUT,fn)),1)))
json.dump(pool, io.open(os.path.join(OUT,'_pool.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
for p in pool: print(p['file'], p['clap'], p.get('_reuse',''), p['dur'])
print('20트랙 · 유니크 %.1f분' % (sum(p['dur'] for p in pool)/60))
