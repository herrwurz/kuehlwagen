@echo off
REM ============================================================
REM  update-local.bat
REM  Kopiert die aktuellen DC-Dateien + support.js in das lokale
REM  pb_public und benennt sie so um, wie sie auch am Server heissen.
REM  Danach im Browser: http://127.0.0.1:8090/start.html
REM ============================================================

setlocal
cd /d "%~dp0"

REM Ziel-Ordner sicherstellen
if not exist "pb_public" mkdir "pb_public"
if not exist "pb_public\uploads" mkdir "pb_public\uploads"

echo.
echo === Lokales pb_public aktualisieren ===
echo.

REM --- Hauptdateien (umbenannt wie am Server) ---
copy /Y "Kuehlwagen-Verwaltung.dc.html" "pb_public\index.html"   >nul 2>&1
if errorlevel 1 copy /Y "K*hlwagen-Verwaltung.dc.html" "pb_public\index.html" >nul
if exist "pb_public\index.html" (echo   OK  index.html) else (echo   FEHLER  Verwaltung .dc.html nicht gefunden)

copy /Y "Buchungsanfrage.dc.html" "pb_public\buchung.html"       >nul
if exist "pb_public\buchung.html" (echo   OK  buchung.html) else (echo   FEHLER  Buchungsanfrage.dc.html nicht gefunden)

copy /Y "Startseite.dc.html" "pb_public\start.html"              >nul
if exist "pb_public\start.html" (echo   OK  start.html) else (echo   FEHLER  Startseite.dc.html nicht gefunden)

REM --- support.js (zwingend noetig) ---
copy /Y "support.js" "pb_public\support.js"                      >nul
if exist "pb_public\support.js" (echo   OK  support.js) else (echo   FEHLER  support.js nicht gefunden)

REM --- Logo (optional) ---
if exist "uploads\logo-weiss-transparent-1000.gif" (
  copy /Y "uploads\logo-weiss-transparent-1000.gif" "pb_public\uploads\logo-weiss-transparent-1000.gif" >nul
  echo   OK  Logo (weiss)
)
if exist "uploads\stvalentin-logo-blau.png" (
  copy /Y "uploads\stvalentin-logo-blau.png" "pb_public\uploads\stvalentin-logo-blau.png" >nul
  echo   OK  Logo (blau, Rechnung/Angebot)
)

echo.
echo Fertig. Browser neu laden:
echo   http://127.0.0.1:8090/start.html
echo.
pause
