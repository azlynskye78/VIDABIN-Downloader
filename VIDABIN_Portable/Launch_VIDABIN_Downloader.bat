@echo off
title VIDABIN Downloader - Portable Mode
echo ========================================================
echo    Starting VIDABIN Downloader
echo    Please wait... Do not close this window!
echo ========================================================
echo.

:: Ensure we are running in the correct directory
cd /d "%~dp0"

:: Start the local server
bin\node.exe app\server.js

pause
