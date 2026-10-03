@echo off
REM ASCII ONLY. cmd.exe reads batch files in ANSI (CP949) - Korean here would break.
REM plum EP18 after-publish (2026-10-05 08:05 KST): 1) tracklist comment 2) pin it. Main = LJI8DI1d30o
REM Shorts are handled daily by plum-shorts-daily. The pin target must equal VID in the .py (EP10 bug).
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_plum_ep18_after.log"
py -3 "tools\_plum_ep18_comment.py" >> "tools\_plum_ep18_after.log" 2>&1
echo comment exit=%ERRORLEVEL% >> "tools\_plum_ep18_after.log"
REM Two missed tasks can fire in the same second and both pass the "already posted"
REM check, so the comment lands twice (gayo EP09, 2026-09-16). This sweeps up my own duplicate.
py -3 "tools\yt_dedupe_comment.py" LJI8DI1d30o yt_token.json --apply >> "tools\_plum_ep18_after.log" 2>&1
echo dedupe exit=%ERRORLEVEL% >> "tools\_plum_ep18_after.log"
node "tools\yt_pin_switch.js" LJI8DI1d30o "plum music" "@plumplaylist" >> "tools\_plum_ep18_after.log" 2>&1
echo pin exit=%ERRORLEVEL% >> "tools\_plum_ep18_after.log"
echo done >> "tools\_plum_ep18_after.log"
