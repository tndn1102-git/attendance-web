# -*- coding: utf-8 -*-
r"""feed/list JSON에서 곡을 골라 mp3 직다운로드 (static-cos = 무인증 · 2026-09-02 실측)
  py -3 tools\mureka_fetch_dl.py <feed.json> <mureka-prompts.txt> <출력폴더> [--model V9.5]
곡당 클립 2개(피드 songs[0]=A·songs[1]=B), 파일명 NN_제목.mp3 (NN=곡순서*2-1, *2)
"""
import io, json, re, os, sys, subprocess, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
feedp, promptp, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
model = sys.argv[sys.argv.index('--model')+1] if '--model' in sys.argv else None
tmp = os.path.join(os.environ.get('TEMP','/tmp'), 'mureka_fetch_songs.json')
subprocess.run(['py','-3','tools/mureka_gen.py',promptp,'--emit-json',tmp], check=True, capture_output=True)
d = json.load(io.open(tmp, encoding='utf-8'))
order = [s['title'] for s in (d['songs'] if isinstance(d,dict) and 'songs' in d else d)]
feed = json.load(io.open(feedp, encoding='utf-8'))['data']['list']
norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())
by_title = {}
for f in feed:
    songs = f.get('songs') or []
    if not songs: continue
    if model and f.get('model') != model: continue
    t = norm(songs[0].get('title',''))
    if t not in by_title:                     # 최신 피드 우선 (리스트가 최신순)
        by_title[t] = (songs, f.get('state'))
os.makedirs(outdir, exist_ok=True)
mani, ok = [], 0
for si, title in enumerate(order):
    entry = by_title.get(norm(title))
    if not entry or len(entry[0]) < 2:
        print(f'⚠️ {title}: 피드에 없음/클립 부족 (state={entry[1] if entry else None})'); continue
    for k, s in enumerate(entry[0][:2]):
        if not s.get('mp3_url'): print(f'⚠️ {title} take{k+1}: mp3_url 없음(생성 중?)'); continue
        no = si*2 + k + 1
        safe = re.sub(r'[\/:*?"<>|]', '_', title)
        out = os.path.join(outdir, f'{no:02d}_{safe}.mp3')
        urllib.request.urlretrieve('https://static-cos.mureka.ai/' + s['mp3_url'], out)
        print(f'받음 {no:02d} {title} take{k+1} {s["duration_milliseconds"]/1000:.0f}s')
        mani.append({'index': no, 'title': title, 'take': k+1, 'dur_sec': round(s['duration_milliseconds']/1000,1),
                     'song_id': s['song_id'], 'model': model, 'mp3_url': s['mp3_url'], 'file': out})
        ok += 1
json.dump(mani, io.open(os.path.join(outdir,'_mureka_web_manifest.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'완료: {ok}/{len(order)*2}')
sys.exit(0 if ok == len(order)*2 else 1)
