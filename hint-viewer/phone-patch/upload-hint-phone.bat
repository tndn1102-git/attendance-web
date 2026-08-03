@echo off
chcp 65001 > nul
echo.
echo [힌트폰 v141 업로드 시작...]
echo.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0upload-hint-phone.ps1"
echo.
echo [PowerShell exited with code: %ERRORLEVEL%]
echo.
pause
