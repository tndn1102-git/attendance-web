@echo off
REM ASCII ONLY. Links EP10 shorts to main video after it goes public (09-07 08:00).
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
echo ===== %DATE% %TIME% ===== >> "tools\_related_ep10.log"
node "tools\yt_studio_related.js" UfNGVEVyBps I8SIwCZeuOc >> "tools\_related_ep10.log" 2>&1
node "tools\yt_studio_related.js" 52mZjA_b1iI I8SIwCZeuOc >> "tools\_related_ep10.log" 2>&1
node "tools\yt_studio_related.js" FIjHKKOF0T4 I8SIwCZeuOc >> "tools\_related_ep10.log" 2>&1
node "tools\yt_verify_related.js" UfNGVEVyBps 52mZjA_b1iI FIjHKKOF0T4 >> "tools\_related_ep10.log" 2>&1
echo exit=%ERRORLEVEL% >> "tools\_related_ep10.log"
