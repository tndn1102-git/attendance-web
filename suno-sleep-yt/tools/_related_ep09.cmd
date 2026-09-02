@echo off
REM ASCII ONLY. Links EP09 shorts to main video after it goes public (09-04 08:00).
REM Runs at 08:20 - after the 08:05 pin task which switches the profile to plum music.
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_related_ep09.log"
node "tools\yt_studio_related.js" EAOPdG5wYek jTWRk9367LE >> "tools\_related_ep09.log" 2>&1
node "tools\yt_studio_related.js" U9s2CxT_ai8 jTWRk9367LE >> "tools\_related_ep09.log" 2>&1
node "tools\yt_studio_related.js" TXGYIB_OyEg jTWRk9367LE >> "tools\_related_ep09.log" 2>&1
node "tools\yt_verify_related.js" EAOPdG5wYek U9s2CxT_ai8 TXGYIB_OyEg >> "tools\_related_ep09.log" 2>&1
echo exit=%ERRORLEVEL% >> "tools\_related_ep09.log"
