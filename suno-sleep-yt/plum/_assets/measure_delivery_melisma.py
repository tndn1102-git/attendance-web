# -*- coding: utf-8 -*-
"""
발성 세기(딜리버리) + 멜리스마("아~ 아~ 아~") 3군 비교 계측기
================================================================
발단 = 2026-09-07 사용자 청취 기각:
  "찬송가 같은 건 없어졌는데 보컬이 너무 힘있고 '아~ 아~ 아~' 이런 게 너무 많아 늘어진다.
   Suno 에 있을 때는 cherry 와 비슷하게 잘 나왔는데, Mureka 라서 자꾸 문제가 생기는 건가?"

3군 = CHERRY(벤치마크) · SUNO(EP07·EP08) · MUREKA(EP09·EP10)

■ 축 1 — 발성 세기 : research/cherry/az3/analyze_delivery.py 를 그대로 재사용(새로 짜지 않았다)
  h1_h2(클수록 숨결·부드러움) · alpha_ratio(고역비, 세게 부르면 커짐) · cpp ·
  onset_str_mean/p90 · onset_rate · attack_time · voc_crest_db · rms_var_db · cons_ratio_db

■ 축 2 — 멜리스마/보칼리제 : 이 파일에서 새로 정의(기존 계측기에 없던 축)
  보컬 스템에서 Praat 피치(10ms)로 유성 구간(voiced segment)을 뽑고, 보컬 온셋(=음절 어택)과 대조한다.

  voiced_ratio        유성 시간 / 분석 시간
  sec_per_onset       유성 시간 / 보컬 온셋 수      ← "한 음절을 몇 초나 끄는가"
  long_voiced_ratio   2초 이상 끊김 없이 이어진 유성 구간이 분석 시간에서 차지하는 비율
  seg_p90_s/seg_max_s 유성 구간 길이 p90 / 최대(초)
  notes_per_onset     유성 구간 안의 음(반음 격자) 수 / 온셋 수
  melisma_per_onset   ★온셋 없이 음정만 바뀐 횟수 / 온셋 수  ← 멜리스마의 직접 정의
  melisma_per_sec     같은 것을 유성 1초당으로
  vocalise_ratio      ★자음이 거의 없는 채로 1.5초 이상 이어진 유성 구간의 시간 비율
                      (자음 = 2~8kHz 순간 상승 피크. 가사 없이 "아~"만 부르면 이게 없다)
  worst               보칼리제 의심 구간 상위 3개 [시작초, 길이초, 자음피크/초]

■ 표본 = 곡 전체(앞뒤 3초 제외, 최대 180초). az3 는 30초 1창이었는데
  멜리스마는 짧은 창에서 왜곡되므로 늘렸다. 3군을 전부 같은 방법으로 잰다.

■ 스템 분리 = demucs htdemucs, GPU(cuda). CPU 30초 클립 28초 → GPU 1.8초(실측 15배).

사용:
  py -3 measure_delivery_melisma.py            # 전체
  py -3 measure_delivery_melisma.py CHERRY     # 군 지정 (CHERRY/EP07/EP08/EP09/EP10)
출력 = plum/_assets/_delivery_ep0710.jsonl (이어쓰기, 이미 잰 것은 건너뜀)
"""
import sys, os, json, glob, subprocess, tempfile, warnings
if getattr(sys.stdout, 'encoding', '').lower() not in ('utf-8', 'utf8'):
    sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore')
import numpy as np, librosa, soundfile as sf

ROOT = r'D:\test3\suno-sleep-yt'
sys.path.insert(0, os.path.join(ROOT, r'research\cherry\az2'))
sys.path.insert(0, os.path.join(ROOT, r'research\cherry\az3'))
import analyze_tracks as A2          # 스템 분리 · vibrato
import analyze_delivery as D         # 발성 세기 지표 (축 1)

SR = 44100
HOP = 512
STEP = 0.01                          # 피치 프레임 간격(초)
MAX_ANA = 260.0                      # 분석 상한(초) — 최장 곡(221s)까지 통째로 들어간다
EDGE = 2.0                           # 앞뒤 잘라낼 초(cherry 곡 경계 무음 p50 0.75s 를 넘기는 값)
OUT = os.path.join(ROOT, r'plum\_assets\_delivery_ep0710.jsonl')

_DEV = None

# 🐞 CPP(Praat PowerCepstrogram)만 곡 전체로 재면 한 곡에 32초가 걸려 전체의 절반을 먹는다.
#    CPP 는 정상 상태 음질 지표라 30초 표본으로 충분하고, az3 원본도 30초 창이었다.
#    → 곡 한복판 30초로 잘라 잰다. 3군을 전부 같은 방법으로 재므로 비교 일관성은 유지된다.
_CPP_FULL = D.cpp


def _cpp_fast(voc, sr=SR):
    if len(voc) > 30 * sr:
        m = len(voc) // 2
        voc = voc[m - 15 * sr:m + 15 * sr]
    return _CPP_FULL(voc, sr)


D.cpp = _cpp_fast


def dev():
    global _DEV
    if _DEV is None:
        import torch
        _DEV = 'cuda' if torch.cuda.is_available() else 'cpu'
        print('[demucs device] ' + _DEV)
    return _DEV


def separate_gpu(wav_path):
    import torch
    from demucs.apply import apply_model
    model = A2._model()
    y, sr = sf.read(wav_path, dtype='float32', always_2d=True)
    x = torch.from_numpy(y.T)
    if x.shape[0] == 1:
        x = x.repeat(2, 1)
    ref = x.mean(0)
    xn = (x - ref.mean()) / (ref.std() + 1e-9)
    with torch.no_grad():
        out = apply_model(model, xn[None], device=dev(), progress=False)[0].cpu()
    out = out * (ref.std() + 1e-9) + ref.mean()
    return dict((n, out[i].mean(dim=0).numpy().astype(np.float32))
                for i, n in enumerate(model.sources))


# ────────────────────────────────── 축 2 — 멜리스마
def _segments(mask, bridge, min_len):
    """True 구간 묶기. bridge 프레임 이하의 구멍은 메운다."""
    idx = np.flatnonzero(mask)
    if len(idx) == 0:
        return []
    segs, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p <= bridge:
            p = i
        else:
            segs.append((s, p))
            s = p = i
    segs.append((s, p))
    return [(a, b) for a, b in segs if (b - a + 1) >= min_len]


def melisma(voc, sr=SR):
    """유성 지속 · 멜리스마 · 보칼리제. 값이 클수록 '아~ 아~ 아~' 쪽."""
    o = {}
    dur = len(voc) / sr
    if dur < 10:
        return o

    # 1) Praat 피치(10ms). pyin 은 수십 초 걸려 못 쓴다(az2 주석과 같은 이유)
    import parselmouth
    snd = parselmouth.Sound(voc.astype(np.float64), sampling_frequency=sr)
    f0 = snd.to_pitch(time_step=STEP, pitch_floor=70,
                      pitch_ceiling=900).selected_array['frequency']
    n = len(f0)
    if n < 200:
        return o

    # 2) 에너지 게이트 — demucs 누설(반주 잔향)을 유성으로 세지 않게
    rms = librosa.feature.rms(y=voc, frame_length=2048,
                              hop_length=int(SR * STEP))[0]
    n = min(n, len(rms))
    f0 = f0[:n]
    rms = rms[:n]
    rdb = 20 * np.log10(rms + 1e-9)
    thr = np.percentile(rdb, 95) - 30.0
    voiced = (f0 > 0) & (rdb > thr)
    o['voiced_ratio'] = float(voiced.mean())

    segs = _segments(voiced, bridge=5, min_len=12)      # 구멍 <=50ms, 최소 120ms
    if not segs:
        return o
    seg_dur = np.array([(b - a + 1) * STEP for a, b in segs])
    voiced_sec = float(seg_dur.sum())
    o['n_voiced_seg'] = len(segs)
    o['seg_mean_s'] = float(seg_dur.mean())
    o['seg_p90_s'] = float(np.percentile(seg_dur, 90))
    o['seg_max_s'] = float(seg_dur.max())
    o['long_voiced_ratio'] = float(seg_dur[seg_dur >= 2.0].sum() / dur)

    # 2-b) 무보컬(간주) 구간 — "가사 밀도가 떨어진 33초가 어디로 갔나"를 가르는 축
    #      vocal_occupancy = 유성 구간 총합 / 곡 길이 (voiced_ratio 는 프레임 단위, 이쪽이 구간 단위)
    gaps = []
    prev_end = 0.0
    for a, b in segs:
        gaps.append(a * STEP - prev_end)
        prev_end = (b + 1) * STEP
    gaps.append(dur - prev_end)
    gaps = np.array([g for g in gaps if g > 0.0])
    o['vocal_occupancy'] = float(voiced_sec / dur)
    o['nonvocal_ratio'] = float(1.0 - voiced_sec / dur)
    if len(gaps):
        o['max_gap_s'] = float(gaps.max())
        o['gap_p90_s'] = float(np.percentile(gaps, 90))
        o['gap_ge5_sec'] = float(gaps[gaps >= 5.0].sum())
        o['gap_ge5_ratio'] = float(gaps[gaps >= 5.0].sum() / dur)
        o['intro_s'] = float(segs[0][0] * STEP)
        o['outro_s'] = float(dur - (segs[-1][1] + 1) * STEP)

    # 3) 보컬 온셋 = 음절 어택
    env = librosa.onset.onset_strength(y=voc, sr=sr, hop_length=HOP)
    on_t = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=HOP,
                                      units='time', backtrack=False)
    vt = np.zeros(n, bool)
    for a, b in segs:
        vt[a:b + 1] = True
    keep = []
    for t in on_t:
        i = int(round(t / STEP))
        lo, hi = max(0, i - 6), min(n, i + 7)
        if hi > lo and vt[lo:hi].any():
            keep.append(t)
    on_t = np.array(keep)
    o['voc_onset_n'] = int(len(on_t))
    o['voc_onset_rate'] = float(len(on_t) / dur)
    o['sec_per_onset'] = float(voiced_sec / max(1, len(on_t)))

    # 4) 음(note) 세기 — 반음 격자 + 중앙값 평활
    from scipy.signal import medfilt
    st = np.full(n, np.nan)
    ok = f0 > 0
    st[ok] = 12 * np.log2(f0[ok] / 440.0)
    notes_total = 0
    changes = []
    for a, b in segs:
        s = st[a:b + 1].copy()
        idx = np.arange(len(s))
        good = ~np.isnan(s)
        if good.sum() < 8:
            continue
        s = np.interp(idx, idx[good], s[good])
        w = 11 if len(s) >= 11 else (len(s) // 2 * 2 - 1)
        if w >= 3:
            s = medfilt(s, w)
        q = np.round(s)
        notes_total += 1
        for i in range(1, len(q)):
            if q[i] != q[i - 1]:
                nxt = q[i:i + 6]          # 바뀐 뒤 60ms 이상 유지될 때만 음 변화
                if len(nxt) >= 6 and np.all(nxt == q[i]):
                    notes_total += 1
                    changes.append((a + i) * STEP)
    changes = np.array(changes)
    o['notes_total'] = int(notes_total)
    o['notes_per_onset'] = float(notes_total / max(1, len(on_t)))
    if len(changes) and len(on_t):
        d = np.abs(changes[:, None] - on_t[None, :]).min(axis=1)
        mel = changes[d > 0.08]
    else:
        mel = changes
    o['melisma_n'] = int(len(mel))
    o['melisma_per_onset'] = float(len(mel) / max(1, len(on_t)))
    o['melisma_per_sec'] = float(len(mel) / max(1e-9, voiced_sec))

    # 5) 보칼리제 = 자음(2~8kHz 순간 상승)이 거의 없는 긴 유성 구간
    S = np.abs(librosa.stft(voc, n_fft=1024, hop_length=HOP))
    fr = librosa.fft_frequencies(sr=sr, n_fft=1024)
    cons = S[(fr >= 2000) & (fr <= 8000)].sum(axis=0)
    flux = np.maximum(0.0, np.diff(cons, prepend=cons[0]))
    med = np.median(flux)
    mad = np.median(np.abs(flux - med)) + 1e-9
    zt = (flux - med) / mad
    cp = librosa.util.peak_pick(zt, pre_max=3, post_max=3, pre_avg=10, post_avg=10,
                                delta=3.0, wait=int(0.08 * sr / HOP))
    cp_t = np.asarray(cp) * HOP / sr
    worst = []
    voc_sec = 0.0
    for (a, b), dsec in zip(segs, seg_dur):
        if dsec < 1.5:
            continue
        t0, t1 = a * STEP, (b + 1) * STEP
        k = int(((cp_t >= t0) & (cp_t <= t1)).sum())
        rate = k / dsec
        if rate < 1.0:
            voc_sec += dsec
            worst.append([round(t0, 2), round(dsec, 2), round(rate, 2)])
    o['vocalise_ratio'] = float(voc_sec / dur)
    worst.sort(key=lambda w: -w[1])
    o['worst'] = worst[:3]
    return o


# ────────────────────────────────── 한 곡 처리
def analyze(path, start=None, dur=None):
    with tempfile.TemporaryDirectory() as td:
        seg = os.path.join(td, 's.wav')
        cmd = ['ffmpeg', '-v', 'error', '-y']
        if start is not None:
            cmd += ['-ss', '%.3f' % start]
        if dur is not None:
            cmd += ['-t', '%.3f' % dur]
        cmd += ['-i', path, '-ac', '2', '-ar', str(SR), seg]
        subprocess.run(cmd, check=True)
        stems = separate_gpu(seg)
    voc = stems['vocals']
    r = {'ana_dur': round(len(voc) / SR, 2)}
    vb = A2.vibrato(voc)
    r.update(vb)
    r.update(D.delivery(voc, vb.get('f0_med')))
    r.update(melisma(voc))
    return r


def ffdur(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                                 'format=duration', '-of', 'csv=p=0', p],
                                capture_output=True, text=True).stdout.strip())


# ────────────────────────────────── 작업 목록
def jobs_cherry():
    az2 = os.path.join(ROOT, r'research\cherry\az2')
    az3 = os.path.join(ROOT, r'research\cherry\az3')
    out = []
    for vid, n in [('rfEWQxUSRjw', 21), ('UeQqhYRPr0g', 20)]:   # az3 와 동일한 유니크 구간
        wav = os.path.join(az3, 'raw', vid + '.wav')
        tj = os.path.join(az2, 'tracks_' + vid + '.json')
        if not (os.path.exists(wav) and os.path.exists(tj)):
            continue
        for t in json.load(open(tj, encoding='utf-8'))['tracks'][:n]:
            if t['dur'] < 40:
                continue
            out.append(dict(group='CHERRY', ep=vid, label='cherry_' + vid, track=t['i'],
                            file=vid + '.wav', title='track%02d' % t['i'], take='',
                            song=t['i'], path=wav, start=t['start'] + EDGE,
                            dur=min(t['dur'] - 2 * EDGE, MAX_ANA), full=t['dur']))
    return out


def jobs_ours(group, ep, folder):
    out = []
    for k, mp3 in enumerate(sorted(glob.glob(os.path.join(ROOT, folder, '*.mp3'))), 1):
        fn = os.path.basename(mp3)
        d = ffdur(mp3)
        base = os.path.splitext(fn)[0]
        if base[:2].isdigit() and len(base) > 3 and base[2] in 'ab':
            song, take, title = int(base[:2]), base[2], base[4:]
        elif base.endswith('_1'):
            song, take, title = 0, 'b', base[:-2]
        else:
            song, take, title = 0, 'a', base
        out.append(dict(group=group, ep=ep, label=group + '_' + ep, track=k, file=fn,
                        title=title, take=take, song=song, path=mp3,
                        start=EDGE, dur=min(d - 2 * EDGE, MAX_ANA), full=round(d, 2)))
    return out


ALL = {
    'CHERRY': jobs_cherry,
    'EP07': lambda: jobs_ours('SUNO', 'EP07', r'plum\ep07\music'),
    'EP08': lambda: jobs_ours('SUNO', 'EP08', r'plum\ep08\music'),
    'EP09': lambda: jobs_ours('MUREKA', 'EP09', r'plum\ep09\music_final'),
    'EP10': lambda: jobs_ours('MUREKA', 'EP10', r'plum\ep10\music_final'),
    'EP11': lambda: jobs_ours('MUREKA', 'EP11', r'plum\ep11\music_final'),
    'EP12': lambda: jobs_ours('MUREKA', 'EP12', r'plum\ep12\music_final'),
    'EP13': lambda: jobs_ours('MUREKA', 'EP13', r'plum\ep13\music_final'),
}


def main(which=None):
    keys = [which] if which else list(ALL)
    done = set()
    if os.path.exists(OUT):
        for l in open(OUT, encoding='utf-8'):
            try:
                r = json.loads(l)
                done.add((r['label'], r['file'], r.get('track')))
            except Exception:
                pass
        print('기존 %d건 — 이어서' % len(done))
    fh = open(OUT, 'a', encoding='utf-8')
    for k in keys:
        js = ALL[k]()
        print('\n[%s] %d곡' % (k, len(js)))
        for j in js:
            key = (j['label'], j['file'], j['track'])
            if key in done:
                continue
            try:
                r = analyze(j['path'], j['start'], j['dur'])
            except Exception as e:
                print('  %-40s 실패 %s %s' % (j['file'][:40], type(e).__name__, e))
                continue
            r.update(dict((kk, v) for kk, v in j.items() if kk != 'path'))
            print('  %-32s%-2s H1H2 %6.2f  a %6.2f  초/음절 %5.2f  긴유성 %5.1f%%  '
                  '멜리스마/음절 %5.2f  보칼리제 %5.1f%%'
                  % (j['title'][:32], j['take'], r.get('h1_h2') or 0,
                     r.get('alpha_ratio') or 0, r.get('sec_per_onset') or 0,
                     100 * (r.get('long_voiced_ratio') or 0),
                     r.get('melisma_per_onset') or 0,
                     100 * (r.get('vocalise_ratio') or 0)))
            fh.write(json.dumps(r, ensure_ascii=False) + '\n')
            fh.flush()
    fh.close()
    print('\n완료 ->', OUT)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
