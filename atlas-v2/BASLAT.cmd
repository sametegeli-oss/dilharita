@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python bulunamadi. Uygulamayi bir yerel web sunucusuyla acman gerekiyor.
  pause
  exit /b 1
)
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://127.0.0.1:8765/'"
echo Dil Harita Atlas V2 aciliyor...
echo Bu pencere acik kaldigi surece uygulama calisir.
python -m http.server 8765 --bind 127.0.0.1
