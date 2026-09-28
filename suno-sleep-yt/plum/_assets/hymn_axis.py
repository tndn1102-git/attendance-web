# -*- coding: utf-8 -*-
r"""
찬송가(교회음악) 방향축 — 게이트 편입용 모듈. clap_gate.py 가 이걸 같이 부른다.

■ 왜 축이 하나 더 필요한가 (2026-09-05)
  기존 clap_gate.py 는 cherry 중심과의 **거리**만 잰다. 어느 **방향**으로 벗어났는지는 안 본다.
  실제로 사용자가 귀로 잡아낸 "찬송가 느낌" 3곡 중 최악(EP09 곡2b)이 거리 0.077 로 **✅ 통과**해
  EP09 본편에 그대로 실렸다. 거리축과 이 축의 상관 = r=+0.011 (사실상 무관).

■ 축 정의
  margin = mean(교회음악 텍스트 유사도) − mean(카페음악 텍스트 유사도)
  곡 전체를 10초 창(hop 10초)으로 훑어 **최댓값**을 쓴다. 문제는 곡 전체가 아니라 한 구간에서 난다.

■ 임계값 근거 (실측)
  | 표본 | n | 최대 마진 | 사용자 판정 |
  |---|---|---|---|
  | Suno EP08 (대조군) | 20 | −0.132 | 불만 0 — 전량 통과해야 정상 |
  | Mureka EP09+EP10 정상분 | 37 | −0.022 | 불만 0 |
  | Mureka 문제 3곡 | 3 | +0.002 ~ +0.047 | **"셋 다 맞다" 확정** |
  → ❌ = margin ≥ 0.00 (확정 불량 3곡이 전부 여기) · ⚠️ = margin ≥ −0.05 (여유선)
  ⚠️ Suno 20곡 전량이 −0.13 이하라 이 게이트로 **알려진 정상품을 하나도 안 떨군다**(승자 검증 통과).
  ⚠️ 실제 찬송가 음원을 넣은 절대 눈금 검증은 아직 없다. 축의 **순위**는 사용자 귀 3/3 과 일치했다.
"""
import numpy as np

def _feat(o):
    """transformers 새 판(2026-09)은 get_*_features 가 출력 객체를 돌려준다 → pooler_output(투영 임베딩)."""
    return (o.pooler_output if hasattr(o, 'pooler_output') else o).numpy()


def _proc_audio(proc, segs):
    try:
        return proc(audio=segs, sampling_rate=48000, return_tensors='pt', padding=True)   # 새 판
    except (TypeError, ValueError):
        return proc(audios=segs, sampling_rate=48000, return_tensors='pt', padding=True)  # 옛 판


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
FAIL, WARN = 0.00, -0.05
WIN = HOP = 10.0
_T = None


def _text():
    global _T
    if _T is None:
        import torch
        from clap_window import _clap
        m, p = _clap()
        out = []
        for txts in (HYMN, CAFE):
            inp = p(text=txts, return_tensors='pt', padding=True)
            with torch.no_grad():
                e = _feat(m.get_text_features(**inp))
            out.append(e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-9))
        _T = out
    return _T


def margin(path):
    """곡 하나 → (최대마진, 그 구간 시작초, 중앙값). 높을수록 교회음악 쪽."""
    import torch, librosa
    from clap_window import _clap
    m, p = _clap()
    TH, TC = _text()
    y, sr = librosa.load(path, sr=48000, mono=True)
    dur = len(y) / sr
    segs = []
    for st in np.arange(0, max(0.0, dur - WIN), HOP):
        seg = y[int(st*sr):int((st+WIN)*sr)]
        if len(seg) >= sr * 3:
            segs.append((float(st), seg))
    if not segs:
        raise ValueError('창을 못 땄다: %s' % path)
    inp = _proc_audio(p, [s for _, s in segs])
    with torch.no_grad():
        A = _feat(m.get_audio_features(**inp))
    A = A / (np.linalg.norm(A, axis=1, keepdims=True) + 1e-9)
    mg = (A @ TH.T).mean(1) - (A @ TC.T).mean(1)
    k = int(np.argmax(mg))
    return float(mg[k]), segs[k][0], float(np.median(mg))


def verdict(mg):
    return '❌찬송가' if mg >= FAIL else ('⚠️경계' if mg >= WARN else '✅')
