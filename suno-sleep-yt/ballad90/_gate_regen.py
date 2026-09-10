# -*- coding: utf-8 -*-
r"""재생성 클립(<ep>\_regen\*.mp3)에 G1~G6 게이트 적용. 먼저 _m_lite_regen.py·_m_stems_regen.py 를 돌려 둘 것.
  py -3 ballad90\_gate_regen.py ep11
"""
import io, json, os, re, subprocess, sys
if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
EP = sys.argv[1]
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), EP, '_regen')
li = json.load(io.open(os.path.join(R, '_lite_regen.json'), encoding='utf-8'))
st = json.load(io.open(os.path.join(R, '_stems_regen.json'), encoding='utf-8'))


def tp(p):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'loudnorm=print_format=json',
                        '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    return float(json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', e, re.S).group(0))['input_tp'])


print('%-22s %6s %6s %6s %6s %6s %5s %7s  %s' % ('클립', 'p90', 'avg', 'liftF', 'tailVA', 'TP', '길이', 'hf7', '위반'))
for fn in sorted(st):
    s, l = st[fn], li[fn]
    t = tp(os.path.join(R, fn))
    g = {'G1': s['belt_p90'] <= 2.0, 'G2': s['belt_avg'] >= -1.5, 'G3': l['lift_full'] <= 2.0,
         'G4': s['tail']['voc_minus_acc'] >= 2.0, 'G5': t <= -0.3, 'G6': l['dur'] >= 180}
    bad = ','.join(k for k, v in g.items() if not v) or '✅'
    print('%-22s %+6.2f %+6.2f %+6.2f %+6.1f %6.2f %5.0f %7.2f  %s' % (fn, s['belt_p90'], s['belt_avg'],
          l['lift_full'], s['tail']['voc_minus_acc'], t, l['dur'], l['hf7'], bad))
