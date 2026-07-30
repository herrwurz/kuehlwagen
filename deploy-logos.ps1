# deploy-logos.ps1 — nur Logos nach /pb_public/uploads/ (fixiert fehlende Logos / indexFallback)
# Voraussetzung: SSH-Zugang zu root@116.203.141.156 (Passwort oder Key)

param(
    [string]$Server = "116.203.141.156",
    [string]$User   = "root"
)

$ErrorActionPreference = "Stop"
$repo = $PSScriptRoot
$weiss = Join-Path $repo "uploads\logo-weiss-transparent-1000.gif"
$blau  = Join-Path $repo "uploads\stvalentin-logo-blau.png"

if (-not (Test-Path $weiss)) { Write-Host "FEHLER: $weiss fehlt"; Read-Host "Enter"; exit 1 }
if (-not (Test-Path $blau))  { Write-Host "FEHLER: $blau fehlt";  Read-Host "Enter"; exit 1 }

Write-Host ">>> Logos hochladen..." -ForegroundColor Cyan
scp $weiss "${User}@${Server}:/root/logo-weiss-transparent-1000.gif"
if ($LASTEXITCODE -ne 0) { Write-Host "SCP weiss fehlgeschlagen"; Read-Host "Enter"; exit 1 }
scp $blau  "${User}@${Server}:/root/stvalentin-logo-blau.png"
if ($LASTEXITCODE -ne 0) { Write-Host "SCP blau fehlgeschlagen"; Read-Host "Enter"; exit 1 }

Write-Host ">>> In Container kopieren..." -ForegroundColor Cyan
$cmd = @'
CONTAINER=$(docker ps --format '{{.ID}} {{.Image}}' | grep pocketbase | awk '{print $1}' | head -1)
if [ -z "$CONTAINER" ]; then echo "FEHLER: kein pocketbase container"; exit 1; fi
echo "Container: $CONTAINER"
docker exec $CONTAINER mkdir -p /pb_public/uploads
docker cp /root/logo-weiss-transparent-1000.gif $CONTAINER:/pb_public/uploads/logo-weiss-transparent-1000.gif
docker cp /root/stvalentin-logo-blau.png $CONTAINER:/pb_public/uploads/stvalentin-logo-blau.png
docker exec $CONTAINER ls -la /pb_public/uploads/
echo DONE
'@
$cmd = $cmd -replace "`r`n", "`n"
$result = ssh "${User}@${Server}" $cmd
Write-Host $result
if ($LASTEXITCODE -ne 0 -or $result -notmatch "DONE") {
    Write-Host "FEHLER beim Container-Copy" -ForegroundColor Red
    Read-Host "Enter"
    exit 1
}

Write-Host "`nOK — Logos deployt. Pruefe:" -ForegroundColor Green
Write-Host "  https://kw.hofreither.at/uploads/logo-weiss-transparent-1000.gif  (ca. 7 KB)"
Write-Host "  https://kw.hofreither.at/uploads/stvalentin-logo-blau.png         (ca. 19 KB)"
Read-Host "`nEnter druecken"
