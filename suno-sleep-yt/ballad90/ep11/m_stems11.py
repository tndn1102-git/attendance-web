# -*- coding: utf-8 -*-
"""EP07 스템 계측 — 벨팅(마지막 후렴 보컬 리프트) · 보컬 음절 밀도 · 보컬/반주 비
   창 2개만 분리(비용 절감): MID = 곡 40% 지점 +20s / TAIL = song_end-40 ~ song_end-10
"""
import io, os, sys, json, subprocess
import numpy as np, torch, librosa
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
SRC = r'D:\test3\suno-sleep-yt\ballad90\ep11\music'
OUT = sys.argv[1]
from demucs.pretrained import get_model
from demucs.apply import apply_model
model = get_model('htdemucs'); model.eval()
DEV = 'cuda' if torch.cuda.is_available() else 'cpu'   # 2026-09-10: GTX 1660 SUPER — CPU 대비 수십 배
model.to(DEV)
SR = model.samplerate; SOURCES = model.sources

def dec(p, s, d):
    c = ['ffmpeg','-v','error','-ss',str(s),'-t',str(d),'-i',p,'-f','f32le',
         '-acodec','pcm_f32le','-ac','2','-ar',str(SR),'-']
    a = np.frombuffer(subprocess.run(c, capture_output=True).stdout, dtype='<f4')
    return a.reshape(-1,2).T.copy()

def sep(w):
    t = torch.from_numpy(w).float().unsqueeze(0)
    ref = t.mean(0); t = (t-ref.mean())/(ref.std()+1e-8)
    with torch.no_grad():
        st = apply_model(model, t, device=DEV, split=True, overlap=0.1, progress=False)[0]
    st = st*ref.std()+ref.mean()
    return {n: st[i].numpy() for i,n in enumerate(SOURCES)}

def env(x, hop=0.05):
    n = int(SR*hop); y = x.mean(0); k = len(y)//n
    return np.sqrt((y[:k*n].reshape(k,n)**2).mean(1)+1e-20)

def db(v): return 20*np.log10(np.maximum(v,1e-9))

def dur(p):
    r = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
                        '-of','default=nw=1:nk=1',p],capture_output=True,text=True)
    return float(r.stdout.strip())

def song_end(p):
    # 22050 모노로 꼬리 무음 제거 지점
    c = ['ffmpeg','-v','error','-i',p,'-f','f32le','-acodec','pcm_f32le','-ac','1','-ar','22050','-']
    y = np.frombuffer(subprocess.run(c,capture_output=True).stdout, dtype='<f4')
    n = 2205; k = len(y)//n
    r = np.sqrt((y[:k*n].reshape(k,n)**2).mean(1)+1e-20)
    thr = np.percentile(r,80)*0.01
    idx = np.where(r>thr)[0]
    return (idx[-1]+1)*0.1 if len(idx) else len(y)/22050.0

res = {}
files = sorted(x for x in os.listdir(SRC) if x.lower().endswith('.mp3'))
for f in files:
    p = os.path.join(SRC,f)
    D = dur(p); E = song_end(p)
    wins = {'mid': (D*0.40, 20.0), 'tail': (max(0,E-40), 30.0)}
    row = {'dur':D,'song_end':E}
    for name,(s,d) in wins.items():
        st = sep(dec(p,s,d))
        v = st['vocals']; acc = st['drums']+st['bass']+st['other']
        ev, ea = env(v), env(acc)
        act = ev > np.percentile(ev,60)          # 보컬 활성 프레임만
        row[name] = {
            'voc_db': float(db(ev[act]).mean()),
            'voc_p90': float(np.percentile(db(ev[act]),90)),
            'acc_db': float(db(ea).mean()),
            'voc_minus_acc': float(db(ev[act]).mean()-db(ea).mean()),
            'voc_active_frac': float(act.mean()),
        }
        if name=='mid':
            vm = v.mean(0)
            o = librosa.onset.onset_detect(y=vm, sr=SR, units='time', backtrack=False,
                                           delta=0.06, wait=2)
            # 보컬이 실제 울리는 시간으로 정규화
            sing = float(act.mean()*d)
            row['onset_per_s'] = float(len(o)/max(sing,1e-6))
            row['onset_n'] = len(o)
    row['belt_avg'] = row['tail']['voc_db']-row['mid']['voc_db']
    row['belt_p90'] = row['tail']['voc_p90']-row['mid']['voc_p90']
    row['acc_lift'] = row['tail']['acc_db']-row['mid']['acc_db']
    res[f] = row
    print(f"{f}: belt_avg {row['belt_avg']:+.2f} belt_p90 {row['belt_p90']:+.2f} "
          f"acc {row['acc_lift']:+.2f} onset/s {row['onset_per_s']:.2f} "
          f"v-a {row['mid']['voc_minus_acc']:+.1f}", flush=True)
json.dump(res, io.open(OUT,'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print('DONE')
