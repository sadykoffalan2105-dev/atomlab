@echo off
rem ATOMLAB brain server uninstaller. Content is ASCII on purpose; messages are printed by uninstall.ps1.
chcp 65001 >nul
setlocal
if not exist "%~dp0uninstall.ps1" (
  echo   Snachala raspakujte arhiv / First extract the archive.
  pause
  exit /b 1
)
fltmc >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
echo.
pause
