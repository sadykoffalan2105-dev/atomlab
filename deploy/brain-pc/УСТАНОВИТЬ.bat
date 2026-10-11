@echo off
rem ATOMLAB brain server installer. Content is ASCII on purpose; messages are printed by install.ps1.
chcp 65001 >nul
setlocal
if not exist "%~dp0install.ps1" (
  echo.
  echo   Snachala raspakujte arhiv: pravaya knopka myshi - "Izvlech vse", zatem zapustite etot fajl snova.
  echo   First extract the archive ^(right click - Extract All^), then run this file again.
  echo.
  pause
  exit /b 1
)
rem Admin rights: fltmc works only in an elevated prompt; otherwise ask Windows (UAC) and restart elevated.
fltmc >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
