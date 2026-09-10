# -*- coding: utf-8 -*-
r"""추억 감성가요 발행후 자동화(.cmd) 생성 + 작업 스케줄러 등록 — make_night_after.py 의 감성가요판.

  py -3 tools\make_gayo_after.py 10 <본편ID> <쇼츠1ID> <쇼츠2ID> "2026-09-23 07:15"
  py -3 tools\make_gayo_after.py 10 ... --apply     :: 스케줄러 등록까지

하는 일 (본편 공개 뒤라야 셋 다 된다)
  ① 트랙리스트 댓글 (tools\_epNN_comment.py — VID 가 채워져 있어야 한다. 이미 달려 있으면 건너뛴다)
  ② 그 댓글 고정 (yt_pin_switch.js — 활성 채널 전환도 겸한다. 이미 고정이면 아무것도 안 누른다)
  ③ 쇼츠 2편에 본편을 관련 동영상으로 걸기 + verify

🔴 왜 댓글·고정·관련영상을 **작업 하나**로 묶나 (2026-09-10)
   EP08 은 댓글 작업(07:10)과 발행후 작업(07:25)을 따로 등록했다. PC 가 09:43 에 켜지자 밀린 두 작업이
   동시에 뜨면서 댓글 작업만 0x800710E0(거부)로 실행되지 않았고, **본편이 30시간 댓글 0개**로 방치됐다.
   → 한 작업 안에서 순서대로 돌린다. 댓글이 먼저 달려야 고정도 된다.

🐞 .cmd 는 **ASCII 전용** — cmd.exe 가 ANSI(CP949)로 읽어 한글이 깨진 채 실행된다. 한글은 전부 .py 쪽에.
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
if len(args) < 5:
    sys.exit(__doc__)
ep, main_id, s1, s2, when = args[0], args[1], args[2], args[3], args[4]
ep = '%02d' % int(ep)

name = 'gayo-ep%s-after' % ep
cmd_path = os.path.join(HERE, '_gayo_ep%s_after.cmd' % ep)
log = 'tools\\_gayo_ep%s_after.log' % ep
cpy = os.path.join(HERE, '_ep%s_comment.py' % ep)
if not os.path.exists(cpy):
    sys.exit('먼저 댓글 스크립트를 만들 것: %s' % cpy)
src = io.open(cpy, encoding='utf-8').read()
if ("VID = '%s'" % main_id) not in src:
    sys.exit('🚨 %s 의 VID 가 %s 로 채워져 있지 않다 — 먼저 채울 것' % (os.path.basename(cpy), main_id))

body = f"""@echo off
REM ASCII ONLY. cmd.exe reads batch files in ANSI (CP949) - Korean here would break.
REM Gayo EP{ep} after-publish ({when} KST): 1) tracklist comment 2) pin 3) link shorts to main.
REM Main = {main_id} / shorts1 = {s1} / shorts2 = {s2}
REM One task on purpose: EP08 comment task was refused when two missed tasks fired together.
chcp 65001 >nul
cd /d "{ROOT}"
echo ===== %DATE% %TIME% ===== >> "{log}"

py -3 "tools\\_ep{ep}_comment.py" >> "{log}" 2>&1
echo comment exit=%ERRORLEVEL% >> "{log}"

node "tools\\yt_pin_switch.js" {main_id} >> "{log}" 2>&1
echo pin exit=%ERRORLEVEL% >> "{log}"

node "tools\\yt_studio_related.js" {s1} {main_id} >> "{log}" 2>&1
echo related1 exit=%ERRORLEVEL% >> "{log}"

node "tools\\yt_studio_related.js" {s2} {main_id} >> "{log}" 2>&1
echo related2 exit=%ERRORLEVEL% >> "{log}"

node "tools\\yt_verify_related.js" {s1} {s2} >> "{log}" 2>&1
echo verify exit=%ERRORLEVEL% >> "{log}"
echo done >> "{log}"
"""

body.encode('ascii')                      # 비ASCII 가 섞이면 여기서 터진다 (의도된 가드)
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
# 밀린 작업이 PC 켜질 때 돌도록 (EP09 작업과 같은 설정)
ps = ("$s = (Get-ScheduledTask -TaskName '%s').Settings; $s.StartWhenAvailable = $true; "
      "$s.DisallowStartIfOnBatteries = $false; $s.StopIfGoingOnBatteries = $false; "
      "Set-ScheduledTask -TaskName '%s' -Settings $s | Out-Null; 'StartWhenAvailable=' + "
      "(Get-ScheduledTask -TaskName '%s').Settings.StartWhenAvailable" % (name, name, name))
r2 = subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True, text=True)
print((r2.stdout or r2.stderr).strip())
print('✅ 등록됨:', name)
