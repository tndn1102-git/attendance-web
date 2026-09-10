# -*- coding: utf-8 -*-
r"""감성가요 테이크 채택 게이트 G1~G7 (EP08 `_테이크선택.md` 밝은 팝용) 을 계측 JSON 3개에 기계 적용한다.
  py -3 ballad90\_gate_takes.py ep10

입력 = <ep>\music\_takes.json (pick_takes: TP·I·길이) · _liteNN.json (lift_full·hf7) · _stemsNN.json (belt·tail v−a)
G1 belt_p90 ≤ +2.0 · G2 belt_avg ≥ −1.5 · G3 lift_full ≤ +2.0 · G4 tail v−a ≥ +2.0 · G5 TP ≤ −0.3 · G6 길이 ≥ 180s
G7 = 둘 다 통과면 밝은 쪽(hf7 큰 쪽). ⚠️ 계측은 불량 걸러내기다 — "마음이 움직이는가·발음"은 못 잰다.
⚠️ intro·onset_dens(lite)·liftV·acc_lift 는 판정에 쓰지 않는다(EP07·EP08 에서 고장 확인).
"""
import io, json, os, sys
if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
EP = sys.argv[1]; NN = EP[2:]
M = os.path.join(os.path.dirname(os.path.abspath(__file__)), EP, 'music')
tk = json.load(io.open(os.path.join(M, '_takes.json'), encoding='utf-8'))['rows']
li = json.load(io.open(os.path.join(M, '_lite%s.json' % NN), encoding='utf-8'))
st = json.load(io.open(os.path.join(M, '_stems%s.json' % NN), encoding='utf-8'))

songs = {}
for r in tk:
    fn = r['song'] + ('.mp3' if r['take'] == 'A' else '_1.mp3')
    s, l = st[fn], li[fn]
    g = {
        'G1': s['belt_p90'] <= 2.0,
        'G2': s['belt_avg'] >= -1.5,
        'G3': l['lift_full'] <= 2.0,
        'G4': s['tail']['voc_minus_acc'] >= 2.0,
        'G5': r['TP'] <= -0.3,
        'G6': r['dur'] >= 180.0,
    }
    songs.setdefault(r['song'], []).append(dict(take=r['take'], fn=fn, g=g, ok=all(g.values()),
        p90=s['belt_p90'], avg=s['belt_avg'], lf=l['lift_full'], tva=s['tail']['voc_minus_acc'],
        tp=r['TP'], dur=r['dur'], hf7=l['hf7'], nfail=sum(not v for v in g.values())))

print('%-10s %s %6s %6s %6s %6s %6s %6s %7s  %s' % ('곡', 'T', 'p90', 'avg', 'liftF', 'tailVA', 'TP', '길이', 'hf7', '위반'))
print('-' * 92)
picks, regen = {}, []
for song, ts in songs.items():
    for t in ts:
        bad = ','.join(k for k, v in t['g'].items() if not v) or '-'
        print('%-10s %s %+6.2f %+6.2f %+6.2f %+6.1f %6.2f %6.0f %7.2f  %s'
              % (song[:10], t['take'], t['p90'], t['avg'], t['lf'], t['tva'], t['tp'], t['dur'], t['hf7'], bad))
    ok = [t for t in ts if t['ok']]
    if ok:
        best = max(ok, key=lambda t: t['hf7'])            # G7: 둘 다 통과면 밝은 쪽
        picks[song] = (best['fn'], '통과 %d/2 · G7 밝은 쪽' % len(ok) if len(ok) == 2 else '통과 1/2')
    else:
        best = min(ts, key=lambda t: (t['nfail'], -t['hf7']))
        picks[song] = (best['fn'], '⚠️ 둘 다 위반 — 위반 적은 쪽(%d개)' % best['nfail'])
        regen.append(song)
print('\n[게이트 추천]')
for song, (fn, why) in picks.items():
    print('  %-12s -> %-22s %s' % (song, fn, why))
print('\n재생성 후보 (두 테이크 모두 위반):', ', '.join(regen) if regen else '없음')
json.dump({s: fn for s, (fn, _) in picks.items()}, io.open(os.path.join(M, '_gate_picks.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
