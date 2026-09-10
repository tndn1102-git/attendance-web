@echo off
REM ASCII ONLY. Do not put Korean here.
REM cmd.exe reads batch files in the ANSI codepage (CP949 on this box).
REM A UTF-8 batch with Korean breaks line parsing - verified 2026-08-08.
REM All Korean text and paths live in _ep10_comment.py (UTF-8).
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_ep10_comment.log"
py -3 "tools\_ep10_comment.py" >> "tools\_ep10_comment.log" 2>&1
echo exit=%ERRORLEVEL% >> "tools\_ep10_comment.log"
