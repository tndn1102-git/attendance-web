@echo off
REM ASCII ONLY. All Korean text and logic live in _plum_ep10_comment.py (UTF-8).
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_plum_ep10_comment.log"
py -3 "tools\_plum_ep10_comment.py" >> "tools\_plum_ep10_comment.log" 2>&1
set PYEXIT=%ERRORLEVEL%
echo comment exit=%PYEXIT% >> "tools\_plum_ep10_comment.log"
if %PYEXIT% NEQ 0 goto :eof
node "tools\yt_pin_switch.js" I8SIwCZeuOc "plum music" "@plumplaylist" >> "tools\_plum_ep10_comment.log" 2>&1
echo pin exit=%ERRORLEVEL% >> "tools\_plum_ep10_comment.log"
