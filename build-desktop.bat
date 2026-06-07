@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === ATOMLAB: сборка Windows-приложения ===
echo.
call npm run desktop:build
if errorlevel 1 (
  echo.
  echo Ошибка сборки. Проверьте, что установлен Node.js и выполнен npm install.
  pause
  exit /b 1
)
echo.
echo Готово! Файлы лежат в папке release\
echo   - ATOMLAB-*-portable.exe  — один файл, можно на флешку / в Telegram
echo   - ATOMLAB-*-win-x64.zip   — архив с папкой программы
echo.
pause
