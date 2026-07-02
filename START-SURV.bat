@echo off
title SURV - Live it! SURV it!
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run SURV. Install it from https://nodejs.org
  pause
  exit /b 1
)
start "" http://localhost:8090
node "%~dp0scripts\serve-web.js" 8090
