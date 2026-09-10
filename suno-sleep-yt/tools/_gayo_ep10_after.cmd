@echo off
REM ASCII ONLY. cmd.exe reads batch files in ANSI (CP949) - Korean here would break.
REM Gayo EP10 after-publish (2026-09-23 07:15 KST): 1) tracklist comment 2) pin 3) link shorts to main.
REM Main = T90kutQGAgc / shorts1 = cGZQpcBoebA / shorts2 = Ge3QV_sbGJs
REM One task on purpose: EP08 comment task was refused when two missed tasks fired together.
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_gayo_ep10_after.log"

py -3 "tools\_ep10_comment.py" >> "tools\_gayo_ep10_after.log" 2>&1
echo comment exit=%ERRORLEVEL% >> "tools\_gayo_ep10_after.log"

node "tools\yt_pin_switch.js" T90kutQGAgc >> "tools\_gayo_ep10_after.log" 2>&1
echo pin exit=%ERRORLEVEL% >> "tools\_gayo_ep10_after.log"

node "tools\yt_studio_related.js" cGZQpcBoebA T90kutQGAgc >> "tools\_gayo_ep10_after.log" 2>&1
echo related1 exit=%ERRORLEVEL% >> "tools\_gayo_ep10_after.log"

node "tools\yt_studio_related.js" Ge3QV_sbGJs T90kutQGAgc >> "tools\_gayo_ep10_after.log" 2>&1
echo related2 exit=%ERRORLEVEL% >> "tools\_gayo_ep10_after.log"

node "tools\yt_verify_related.js" cGZQpcBoebA Ge3QV_sbGJs >> "tools\_gayo_ep10_after.log" 2>&1
echo verify exit=%ERRORLEVEL% >> "tools\_gayo_ep10_after.log"
echo done >> "tools\_gayo_ep10_after.log"
