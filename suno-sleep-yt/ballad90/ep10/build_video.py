# -*- coding: utf-8 -*-
r"""
EP10 본편 렌더 — 정지 이미지 1장 + 마스터 (씬 = 가을 체육대회 끝난 운동장 스탠드 · 한낮).

컨셉 =「첫차 기다리는 정류장 · 이른 아침」· 밤을 넘긴 사람 · 끝내 못 보낸 말 (2026-08-18 사용자 확정)
배경 = 씬「PC방 새벽」(신규 j 계열) · 2000년대 초 한국 PC방 · CRT 사이안 발광 · 건조한 연기
  화풍 = 만료 코닥 필름 실사(EP01 라인). 후보 h1~h3(90년대판·이력)→i1~i3(2000년대판) · 확정 = **i1**(kt 부스 + PC방·노래방·GS25·실외기)
         선정 근거 = h1과 같은 원근 구도(부제 정합) + 2000년대 결정타가 가장 풍부하고 간판 한글이 대부분 정상.
  신선도 = 발행분 대비 밤·젖은반사·원근 축 상이(§🔄 규칙, NEXT 문서 이력표 갱신됨)
  연대 결정타(2000년대) = kt 공중전화 · PC방·노래방 채널사인 · 편의점 · 벽면 에어컨 실외기

니치 실측: 본편 배경은 정지 1장이 표준(28%) + 미세모션(26%). 루프 영상 불필요.
GPU(NVENC) 사용 — 전역 CLAUDE.md 규칙에 따라 ffenc 헬퍼로 자동 선택.
"""
import io, os, sys, subprocess

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'C:\Users\tndn1\.claude\tools')
from ffenc import venc  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
# HERE = ballad90\ep01 이므로 프로젝트 루트까지 두 번 올라간다
ROOT = os.path.dirname(os.path.dirname(HERE))
BRAND = os.path.join(ROOT, 'gayo90', 'brand')
AUDIO = os.path.join(HERE, 'audio', 'ep10_master.wav')
# ⚠ ✦ 워터마크는 **칠하지 않고 잘라냈다** — 메우면 얼룩이 워터마크보다 눈에 띈다(2026-08-08 실측).
#   Gemini 1024×572 출력을 900×506 으로 크롭(✦ 는 x>=912) 후 1920×1080 업스케일한 것.
BG = os.path.join(HERE, 'upload', 'bg_vol10_1920.jpg')
OUTD = os.path.join(HERE, 'upload')
os.makedirs(OUTD, exist_ok=True)
OUT = os.path.join(OUTD, 'ChueokGamsung_VOL10_Sports_Day.mp4')

for p in (AUDIO, BG):
    if not os.path.exists(p):
        sys.exit('없음: %s' % p)

# 오디오 길이 = 출력 길이 (⚠ -loop 1 은 무한입력이라 -t 로 끊지 않으면 렌더가 폭주한다)
r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                    '-of', 'default=nw=1:nk=1', AUDIO],
                   capture_output=True, text=True, encoding='utf-8', errors='replace')
dur = float(r.stdout.strip())
print('오디오 %d:%02d:%02d' % (int(dur) // 3600, int(dur) % 3600 // 60, int(dur) % 60))
print('배경   %s' % os.path.basename(BG))

# 오버레이 — plum 방식(미리 렌더한 EQ PNG 시퀀스를 stream_loop 로 반복 + 로고 PNG)
EQ = os.path.join(BRAND, 'overlay', 'eq', 'eq_%03d.png')
LOGO = os.path.join(BRAND, 'overlay', 'logo_cassette.png')
for p in (LOGO,):
    if not os.path.exists(p):
        sys.exit('오버레이 없음: %s (make_overlays.py 먼저)' % p)

# 곡별 자막 카드 (사용자 확정: 5안 배치 + 4안 영문 부제)
#   EQ·로고를 y=800 으로 올려 하단중앙을 자막에 내준다.
#   카드는 곡 시작~다음 곡 직전까지 **지속** 표시(실측 88%가 지속).
import json  # noqa: E402
CARDS = json.load(open(os.path.join(HERE, 'titlecards', 'cards.json'), encoding='utf-8'))

filt = (
    '[0:v]scale=1920:1080:force_original_aspect_ratio=increase,'
    'crop=1920:1080,setsar=1[bg];'
    '[2:v]scale=76:-1[lg];'
    '[1:v]scale=200:-1[eqs];'
    '[bg][lg]overlay=(W-w)/2:800-h[b1];'
    '[b1][eqs]overlay=(W-w)/2:800[b2]'
)
# 카드 입력은 4번부터 (0 배경 · 1 EQ · 2 로고 · 3 오디오)
card_inputs = []
prev = 'b2'
for i, c in enumerate(CARDS):
    idx = 4 + i
    card_inputs += ['-loop', '1', '-framerate', '30', '-i', c['file']]
    tag = 'c%d' % i
    nxt = 'v' if i == len(CARDS) - 1 else 'cc%d' % i
    filt += (";[%s][%d:v]overlay=0:0:enable='between(t,%.3f,%.3f)'[%s]"
             % (prev, idx, c['start'], c['end'], nxt))
    prev = nxt

cmd = (['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-stats',
        '-loop', '1', '-framerate', '30', '-i', BG,
        '-framerate', '30', '-stream_loop', '-1', '-i', EQ,
        '-i', LOGO, '-i', AUDIO]
       + card_inputs
       + ['-filter_complex', filt, '-map', '[v]', '-map', '3:a']
       + venc('still')
       + ['-r', '30', '-vsync', 'cfr',          # ⚠ VFR 이면 유튜브 처리가 멈춘다(밤채널 사고)
          '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
          # ⚠ 무한 입력이 2개(-loop 1, -stream_loop -1) → 출력 -t 로 반드시 끊는다. 없으면 렌더 폭주.
          '-t', '%.3f' % dur, '-movflags', '+faststart', OUT])
print('\n렌더 시작...')
subprocess.run(cmd)

if os.path.exists(OUT):
    mb = os.path.getsize(OUT) / 1048576
    v = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                        '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
                        '-show_entries', 'format=duration', '-of', 'default=nw=1', OUT],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    print('\n✅ %s (%.0f MB)' % (OUT, mb))
    print(v.stdout.strip())
else:
    print('✗ 렌더 실패')
