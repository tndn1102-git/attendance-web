@echo off
REM ASCII ONLY. cmd.exe reads batch files in ANSI (CP949) - Korean here would break.
REM Gayo EP11 after-publish (2026-09-30 07:15 KST): 1) tracklist comment 2) pin 3) link shorts to main.
REM Main = WQimetUBqok / shorts1 = 6orbE0If2W0 / shorts2 = HOl7hnbdruw
REM One task on purpose: EP08 comment task was refused when two missed tasks fired together.
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_gayo_ep11_after.log"

py -3 "tools\_ep11_comment.py" >> "tools\_gayo_ep11_after.log" 2>&1
echo comment exit=%ERRORLEVEL% >> "tools\_gayo_ep11_after.log"

node "tools\yt_pin_switch.js" WQimetUBqok >> "tools\_gayo_ep11_after.log" 2>&1
echo pin exit=%ERRORLEVEL% >> "tools\_gayo_ep11_after.log"

node "tools\yt_studio_related.js" 6orbE0If2W0 WQimetUBqok >> "tools\_gayo_ep11_after.log" 2>&1
echo related1 exit=%ERRORLEVEL% >> "tools\_gayo_ep11_after.log"

node "tools\yt_studio_related.js" HOl7hnbdruw WQimetUBqok >> "tools\_gayo_ep11_after.log" 2>&1
echo related2 exit=%ERRORLEVEL% >> "tools\_gayo_ep11_after.log"

node "tools\yt_verify_related.js" 6orbE0If2W0 HOl7hnbdruw >> "tools\_gayo_ep11_after.log" 2>&1
echo verify exit=%ERRORLEVEL% >> "tools\_gayo_ep11_after.log"
echo done >> "tools\_gayo_ep11_after.log"
