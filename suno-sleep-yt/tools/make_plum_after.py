# -*- coding: utf-8 -*-
r"""plum 본편 발행후 자동화(.cmd) 생성 + 작업 스케줄러 등록 — 트랙리스트 댓글 → 고정.
  py -3 tools\make_plum_after.py 13 <본편ID> "2026-09-18 08:05"
  py -3 tools\make_plum_after.py 13 <본편ID> "2026-09-18 08:05" --apply   :: 작업 `plum-epNN-comment` 등록(덮어쓰기)

(쇼츠의 댓글·고정·관련동영상은 매일 도는 `plum-shorts-daily` 가 맡는다. 이건 본편 전용.)

🔴 왜 만들었나 (2026-09-10 발견)
  · EP10: `.cmd` 가 **재업로드 전 옛 ID(I8SIwCZeuOc)** 로 고정을 시도해 실패 — 본편 댓글이 고정 안 된 채 방치.
  · EP11·EP12: 작업이 `.py` 를 직접 불러 **댓글만 달고 고정 단계가 아예 없었다**(.py 주석엔 ".cmd 가 고정한다"고 적힌 채).
  → .py 의 VID 와 .cmd 의 고정 대상 ID 가 **같은지 여기서 강제**한다. 다르면 만들지 않는다.
🐞 .cmd 는 **ASCII 전용** — cmd.exe 가 ANSI(CP949)로 읽는다. 한글은 .py 쪽에.
"""
import io, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

args = [a for a in sys.argv[1:] if not a.startswith('--')]
APPLY = '--apply' in sys.argv
if len(args) < 3:
    sys.exit(__doc__)
ep, main_id, when = '%02d' % int(args[0]), args[1], args[2]

name = 'plum-ep%s-comment' % ep
cmd_path = os.path.join(HERE, '_plum_ep%s_after.cmd' % ep)
log = 'tools\\_plum_ep%s_after.log' % ep
cpy = os.path.join(HERE, '_plum_ep%s_comment.py' % ep)
if not os.path.exists(cpy):
    sys.exit('먼저 댓글 스크립트를 만들 것: %s' % cpy)
if ("VID = '%s'" % main_id) not in io.open(cpy, encoding='utf-8').read():
    sys.exit('🚨 %s 의 VID 가 %s 가 아니다 — 고정 대상과 댓글 대상이 어긋난다(EP10 사고). 먼저 맞출 것' % (os.path.basename(cpy), main_id))

body = f"""@echo off
REM ASCII ONLY. cmd.exe reads batch files in ANSI (CP949) - Korean here would break.
REM plum EP{ep} after-publish ({when} KST): 1) tracklist comment 2) pin it. Main = {main_id}
REM Shorts are handled daily by plum-shorts-daily. The pin target must equal VID in the .py (EP10 bug).
chcp 65001 >nul
cd /d "{ROOT}"
echo ===== %DATE% %TIME% ===== >> "{log}"
py -3 "tools\\_plum_ep{ep}_comment.py" >> "{log}" 2>&1
echo comment exit=%ERRORLEVEL% >> "{log}"
node "tools\\yt_pin_switch.js" {main_id} "plum music" "@plumplaylist" >> "{log}" 2>&1
echo pin exit=%ERRORLEVEL% >> "{log}"
echo done >> "{log}"
"""
body.encode('ascii')
io.open(cmd_path, 'w', encoding='ascii', newline='\r\n').write(body)
print('작성:', cmd_path, '(ASCII 전용 · CRLF)')

d, t = when.split()
sched = ['schtasks', '/Create', '/TN', name, '/TR', '"%s"' % cmd_path,
         '/SC', 'ONCE', '/SD', d.replace('-', '/'), '/ST', t, '/F']
print('등록 명령:', ' '.join(sched))
if not APPLY:
    print('\n실제 등록하려면 --apply')
    sys.exit(0)
r = subprocess.run(sched, capture_output=True, text=True)
print(r.stdout or r.stderr)
if r.returncode != 0:
    sys.exit('⚠️ 실패 rc=%d' % r.returncode)
ps = ("$s = (Get-ScheduledTask -TaskName '%s').Settings; $s.StartWhenAvailable = $true; "
      "$s.DisallowStartIfOnBatteries = $false; $s.StopIfGoingOnBatteries = $false; "
      "Set-ScheduledTask -TaskName '%s' -Settings $s | Out-Null; 'StartWhenAvailable=' + "
      "(Get-ScheduledTask -TaskName '%s').Settings.StartWhenAvailable" % (name, name, name))
r2 = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True)
print((r2.stdout or r2.stderr).strip())
print('✅ 등록됨:', name)
