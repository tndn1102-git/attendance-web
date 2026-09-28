# -*- coding: utf-8 -*-
r"""
찬송가(교회음악) 혼입 탐지 — CLAP 텍스트 대조.

왜:
  2026-09-05 사용자 청취 지적 — "Mureka 곡이 대체로 괜찮은데 중간에 가끔 찬송가 느낌이 섞인다".
  기존 clap_gate.py 는 cherry 중심과의 '거리'만 재서 **어느 방향으로 벗어났는지** 를 말해주지 못한다.
  이 스크립트는 방향을 잡는다: 곡을 통째로 창 단위로 훑어 hymn-쪽 유사도가 튀는 구간을 찍는다.

사용:
  py -3 plum\_assets\hymn_scan.py <폴더|파일...> [--hop 10] [--win 10]

출력: 곡별 최대 hymn 마진 + 그 구간 타임코드. 마진 = mean(hymn텍스트 유사도) - mean(cafe텍스트 유사도).
"""
import io, sys, os, glob, json
import numpy as np

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HYMN = [
    "a christian church hymn sung by a choir",
    "sacred worship music with pipe organ",
    "a solemn religious chorale in a cathedral",
    "gospel hymn with organ and congregation singing",
    "reverent sacred choral music in a church",
]
CAFE = [
    "a relaxing bossa nova song in a cafe",
    "mellow soul pop for a coffee shop playlist",
    "chill lounge music with electric piano and soft drums",
    "laid back summer cafe music with light percussion",
    "smooth easy listening pop with a groove",
]

WIN = 10.0
HOP = 10.0
args = [a for a in sys.argv[1:]]
if '--hop' in args:
    i = args.index('--hop'); HOP = float(args[i+1]); del args[i:i+2]
if '--win' in args:
    i = args.index('--win'); WIN = float(args[i+1]); del args[i:i+2]

targets = []
for a in args:
    if os.path.isdir(a):
        targets += sorted(glob.glob(os.path.join(a, '*.mp3')) + glob.glob(os.path.join(a, '*.wav')))
    elif os.path.exists(a):
        targets.append(a)
if not targets:
    sys.exit(__doc__)

import warnings; warnings.filterwarnings('ignore')
import torch, librosa
from transformers import ClapModel, ClapProcessor

def _feat(o):
    """transformers 새 판(2026-09)은 get_*_features 가 출력 객체를 돌려준다 → pooler_output(투영 임베딩)."""
    return (o.pooler_output if hasattr(o, 'pooler_output') else o).numpy()


def _proc_audio(proc, segs):
    try:
        return proc(audio=segs, sampling_rate=48000, return_tensors='pt', padding=True)   # 새 판
    except (TypeError, ValueError):
        return proc(audios=segs, sampling_rate=48000, return_tensors='pt', padding=True)  # 옛 판

M = ClapModel.from_pretrained('laion/clap-htsat-unfused').eval()
P = ClapProcessor.from_pretrained('laion/clap-htsat-unfused')

def temb(texts):
    inp = P(text=texts, return_tensors='pt', padding=True)
    with torch.no_grad():
        e = _feat(M.get_text_features(**inp))
    return e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-9)

TH, TC = temb(HYMN), temb(CAFE)

out = []
for f in targets:
    y, sr = librosa.load(f, sr=48000, mono=True)
    dur = len(y) / sr
    starts = list(np.arange(0, max(0.0, dur - WIN), HOP))
    segs = []
    for st in starts:
        seg = y[int(st*sr):int((st+WIN)*sr)]
        if len(seg) < sr*3: continue
        segs.append((st, seg))
    if not segs: continue
    inp = _proc_audio(P, [s for _, s in segs])
    with torch.no_grad():
        A = _feat(M.get_audio_features(**inp))
    A = A / (np.linalg.norm(A, axis=1, keepdims=True) + 1e-9)
    marg = (A @ TH.T).mean(1) - (A @ TC.T).mean(1)
    k = int(np.argmax(marg))
    out.append(dict(f=os.path.basename(f), dur=dur, mx=float(marg[k]),
                    at=float(segs[k][0]), med=float(np.median(marg)),
                    hi=[[float(s), float(m)] for (s, _), m in zip(segs, marg) if m > 0]))
    print('  ...%s  max=%+.4f @%d:%02d  med=%+.4f' % (os.path.basename(f)[:44], out[-1]['mx'],
          int(out[-1]['at'])//60, int(out[-1]['at'])%60, out[-1]['med']), flush=True)

out.sort(key=lambda d: -d['mx'])
print('\n===== 찬송가 마진 순위 (높을수록 교회음악 쪽) =====')
print('마진      중앙값    최고구간   곡')
for d in out:
    print('%+.4f  %+.4f  %2d:%02d    %s' % (d['mx'], d['med'], int(d['at'])//60, int(d['at'])%60, d['f']))
json.dump(out, open(os.path.join(os.path.dirname(targets[0]), '_hymn_scan.json'), 'w'), indent=1)
print('\n저장 -> _hymn_scan.json')
