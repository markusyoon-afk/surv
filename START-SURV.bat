@echo off
title SURV - Live it! SURV it!
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run SURV. Install it from https://nodejs.org
  pause
  exit /b 1
)
echo.
echo  On this PC:      http://localhost:8090
echo  On your iPhone (same Wi-Fi), open one of these:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo    http://%%a:8090
echo.
start "" http://localhost:8090
node "%~dp0scripts\serve-web.js" 8090
