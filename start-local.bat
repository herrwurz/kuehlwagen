@echo off
REM ============================================================
REM  start-local.bat
REM  Startet die lokale PocketBase und oeffnet die App im Browser.
REM  Voraussetzung: pocketbase.exe liegt in diesem Ordner.
REM ============================================================

setlocal
cd /d "%~dp0"

if not exist "pocketbase.exe" (
  echo.
  echo FEHLER: pocketbase.exe wurde in diesem Ordner nicht gefunden.
  echo Bitte pocketbase.exe in den Ordner "kuehlwagen" legen.
  echo.
  pause
  exit /b 1
)

REM pb_public sicherstellen (falls update-local.bat noch nicht lief)
if not exist "pb_public\start.html" (
  echo.
  echo Hinweis: pb_public\start.html fehlt noch.
  echo Fuehre zuerst update-local.bat aus, damit die Dateien vorhanden sind.
  echo.
)

echo.
echo === Lokale PocketBase wird gestartet ===
echo   Admin:   http://127.0.0.1:8090/_/
echo   Start:   http://127.0.0.1:8090/start.html
echo.
echo   Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
echo.

REM Browser nach kurzer Wartezeit oeffnen (PocketBase braucht ~2s zum Hochfahren)
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8090/start.html"

REM PocketBase starten (blockiert dieses Fenster, solange der Server laeuft)
pocketbase.exe serve
