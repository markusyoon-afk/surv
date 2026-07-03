@echo off
title SURV - Share online
cd /d "%~dp0"
if not exist dist\index.html (
  echo No web build found. Building first...
  call npm run build:web
)
if not exist tools\cloudflared.exe (
  echo Downloading Cloudflare Tunnel - one time, about 60 MB...
  if not exist tools mkdir tools
  curl -L -o tools\cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)
echo.
echo Starting SURV server...
start "SURV server" /min node scripts\serve-web.js 8090
echo.
echo ============================================================
echo  Look below for your PUBLIC URL, it ends in trycloudflare.com
echo  Open it on your iPhone, then Share button - Add to Home Screen.
echo  Send the same URL to friends so they can join your Nest.
echo  Keep this window open while sharing. Ctrl+C to stop.
echo ============================================================
echo.
tools\cloudflared.exe tunnel --url http://localhost:8090
