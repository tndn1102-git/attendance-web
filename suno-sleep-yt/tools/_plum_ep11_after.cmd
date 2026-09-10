@echo off
REM ASCII ONLY. cmd.exe reads batch files in ANSI (CP949) - Korean here would break.
REM plum EP11 after-publish (2026-09-11 08:05 KST): 1) tracklist comment 2) pin it. Main = UhOAdLxVSHg
REM Shorts are handled daily by plum-shorts-daily. The pin target must equal VID in the .py (EP10 bug).
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_plum_ep11_after.log"
py -3 "tools\_plum_ep11_comment.py" >> "tools\_plum_ep11_after.log" 2>&1
echo comment exit=%ERRORLEVEL% >> "tools\_plum_ep11_after.log"
node "tools\yt_pin_switch.js" UhOAdLxVSHg "plum music" "@plumplaylist" >> "tools\_plum_ep11_after.log" 2>&1
echo pin exit=%ERRORLEVEL% >> "tools\_plum_ep11_after.log"
echo done >> "tools\_plum_ep11_after.log"
