@echo off
REM Deploy MIT Hook-Update und Container-Neustart
REM Nur nötig wenn pb_hooks/kw_anfragen.pb.js geändert wurde
powershell -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" -Hooks
pause
