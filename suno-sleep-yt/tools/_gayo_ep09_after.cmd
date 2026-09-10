@echo off
REM ASCII ONLY. Gayo EP09 after-publish: tracklist comment + pin + link 2 shorts to main. Runs 09-16 07:25.
REM 2026-09-10: comment step added here too. EP08 comment task was refused (0x800710E0) when the PC
REM woke late and both tasks fired together, so EP08 went 30h with no comment. _ep09_comment.py skips
REM if the tracklist comment already exists, so running it twice is safe.
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_gayo_ep09_after.log"
py -3 "tools\_ep09_comment.py" >> "tools\_gayo_ep09_after.log" 2>&1
echo comment exit=%ERRORLEVEL% >> "tools\_gayo_ep09_after.log"
node "tools\yt_pin_switch.js" tNJhOL9gbOE >> "tools\_gayo_ep09_after.log" 2>&1
node "tools\yt_studio_related.js" S-N08Q3PWKI tNJhOL9gbOE >> "tools\_gayo_ep09_after.log" 2>&1
node "tools\yt_studio_related.js" W2TpPdabXfc tNJhOL9gbOE >> "tools\_gayo_ep09_after.log" 2>&1
node "tools\yt_verify_related.js" S-N08Q3PWKI W2TpPdabXfc >> "tools\_gayo_ep09_after.log" 2>&1
echo exit=%ERRORLEVEL% >> "tools\_gayo_ep09_after.log"
