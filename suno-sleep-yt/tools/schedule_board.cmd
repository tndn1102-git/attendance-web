@echo off
REM ASCII ONLY. cmd.exe reads batch files in ANSI (CP949) - Korean here would break.
REM 4-channel upload schedule board refresh. Task Scheduler "yt-schedule-board" runs this
REM once at logon through run_hidden.vbs (no window), then the task ends by itself.
REM Right after boot the network may not be up yet -> retry up to 3 times, 60s apart.
REM yt_schedule_board.py exit: 0 = ok / 1 = some channel failed / 2 = all failed (old page kept)
chcp 65001 >nul
cd /d "D:\test3\suno-sleep-yt"
set LOG=tools\_schedule_board.log
echo ===== %DATE% %TIME% ===== >> "%LOG%"
for /L %%i in (1,1,3) do (
  py -3 "tools\yt_schedule_board.py" >> "%LOG%" 2>&1
  if not errorlevel 1 (
    echo try %%i ok >> "%LOG%"
    exit /b 0
  )
  echo try %%i failed, wait 60s >> "%LOG%"
  ping -n 61 127.0.0.1 >nul
)
echo giving up >> "%LOG%"
exit /b 1
