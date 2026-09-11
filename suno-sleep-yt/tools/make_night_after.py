# -*- coding: utf-8 -*-
r"""밤 채널 발행후 자동화(.cmd) 생성 + 작업 스케줄러 등록 — 편마다 손으로 짜던 것을 도구화.

  py -3 tools\make_night_after.py 17 <본편ID> <쇼츠1ID> <쇼츠2ID> "2026-10-01 21:10"
  py -3 tools\make_night_after.py 17 ... --apply     :: 스케줄러 등록까지

하는 일 = ①트랙리스트 댓글 달기 ②그 댓글 고정 ③쇼츠 2편에 본편을 관련 동영상으로 걸기
  (셋 다 API 가 없어 Studio 자동화로 돈다. 본편이 공개된 뒤라야 관련 동영상이 걸린다.)

🐞 .cmd 는 **ASCII 전용**이어야 한다 — cmd.exe 가 ANSI(CP949)로 읽어 한글이 깨진 채 실행된다.
   채널명은 `yt_pin_switch.js` 가 `new RegExp()` 으로 받으므로 \uXXXX 이스케이프로 넘긴다.
"""
import io, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# 달빛국악 (ASCII 이스케이프로 .cmd 에 넣는다)
CH_ESC = '\\uB2EC\\uBE5B\\uAD6D\\uC545'
HANDLE = '@dalbitgugak'

args = [a for a in sys.argv[1:] if not a.startswith('--')]
APPLY = '--apply' in sys.argv
if len(args) < 5:
    sys.exit(__doc__)
ep, main_id, s1, s2, when = args[0], args[1], args[2], args[3], args[4]

name = 'night-ep%s-after' % ep
cmd_path = os.path.join(HERE, '_night_ep%s_after.cmd' % ep)
log = 'tools\\_night_ep%s_after.log' % ep
comment = 'tools\\_night_ep%s_comment.txt' % ep
if not os.path.exists(os.path.join(HERE, '_night_ep%s_comment.txt' % ep)):
    sys.exit('먼저 고정댓글 본문을 만들 것: %s' % comment)

body = f"""@echo off
REM ASCII ONLY. cmd.exe reads batch files in ANSI (CP949) - Korean here would break.
REM Runs after EP{ep} main goes public ({when} KST).
REM 1) tracklist comment  2) pin it  3) link shorts1/2 to the main video.
REM Main = {main_id} / shorts1 = {s1} / shorts2 = {s2}
chcp 65001 >nul
cd /d "{ROOT}"
echo ===== %DATE% %TIME% ===== >> "{log}"

py -3 "tools\\yt_comment.py" {main_id} "{comment}" yt_token_night.json >> "{log}" 2>&1
set PYEXIT=%ERRORLEVEL%
echo comment exit=%PYEXIT% >> "{log}"

if %PYEXIT% EQU 0 (
  node "tools\\yt_pin_switch.js" {main_id} "{CH_ESC}" "{HANDLE}" >> "{log}" 2>&1
  echo pin exit=%ERRORLEVEL% >> "{log}"
)

node "tools\\yt_studio_related.js" {s1} {main_id} >> "{log}" 2>&1
echo related1 exit=%ERRORLEVEL% >> "{log}"

node "tools\\yt_studio_related.js" {s2} {main_id} >> "{log}" 2>&1
echo related2 exit=%ERRORLEVEL% >> "{log}"

echo done >> "{log}"
"""

body.encode('ascii')                      # 비ASCII 가 섞이면 여기서 터진다 (의도된 가드)
io.open(cmd_path, 'w', encoding='ascii', newline='\r\n').write(body)
print('작성:', cmd_path, '(ASCII 전용 · CRLF)')

d, t = when.split()
sched = ['schtasks', '/Create', '/TN', name, '/TR', '"%s"' % cmd_path,
         '/SC', 'ONCE', '/SD', '/'.join(reversed(d.split('-'))) if False else d.replace('-', '/'),
         '/ST', t, '/F']
print('등록 명령:', ' '.join(sched))
if not APPLY:
    print('\n실제 등록하려면 --apply')
    sys.exit(0)
r = subprocess.run(sched, capture_output=True, text=True)
print(r.stdout or r.stderr)
if r.returncode == 0:
    # 🔴 2026-09-11: 창 없이 실행(run_hidden.vbs) — 보이는 콘솔을 닫으면 작업이 0xC000013A 로 끊긴다(plum-ep11 사고)
    VBS = os.path.join(HERE, 'run_hidden.vbs')
    ps_act = ("$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '\"%s\" \"%s\"'; "
              "Set-ScheduledTask -TaskName '%s' -Action $a | Out-Null" % (VBS, cmd_path, name))
    subprocess.run(['powershell', '-NoProfile', '-Command', ps_act], capture_output=True, text=True)
print('✅ 등록됨' if r.returncode == 0 else '⚠️ 실패 rc=%d' % r.returncode)
