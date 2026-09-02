@echo off
REM ASCII ONLY. cmd.exe reads batch files in the ANSI codepage (CP949 on this box).
REM All Korean text and logic live in _plum_ep09_comment.py (UTF-8).
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_plum_ep09_comment.log"
py -3 "tools\_plum_ep09_comment.py" >> "tools\_plum_ep09_comment.log" 2>&1
set PYEXIT=%ERRORLEVEL%
echo comment exit=%PYEXIT% >> "tools\_plum_ep09_comment.log"
if %PYEXIT% NEQ 0 goto :eof
REM pin: MUST pass channel name + handle (2026-08-18 incident).
node "tools\yt_pin_switch.js" jTWRk9367LE "plum music" "@plumplaylist" >> "tools\_plum_ep09_comment.log" 2>&1
echo pin exit=%ERRORLEVEL% >> "tools\_plum_ep09_comment.log"
