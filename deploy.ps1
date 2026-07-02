# deploy.ps1 - Kuehlwagen-Verwaltung Deploy-Script
# Verwendung: .\deploy.ps1 (oder per deploy.bat)
# Mit Hook-Restart: .\deploy.ps1 -Hooks (oder per deploy-hooks.bat)
# Voraussetzung: SSH-Zugang zu root@116.203.141.156 (am besten mit SSH-Key via setup-ssh-key.ps1)

param(
    [string]$Server = "116.203.141.156",
    [string]$User   = "root",
    [switch]$Hooks
)

$ErrorActionPreference = "Stop"

trap {
    Write-Host "`nUNERWARTETER FEHLER: $_" -ForegroundColor Red
    Read-Host "Enter druecken zum Schliessen"
    exit 1
}

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Fail($msg) {
    Write-Host "    FEHLER: $msg" -ForegroundColor Red
    Read-Host "Enter druecken zum Schliessen"
    exit 1
}

Write-Host "`n========================================" -ForegroundColor DarkCyan
Write-Host "  Kuehlwagen-Verwaltung Deploy-Script"    -ForegroundColor DarkCyan
Write-Host "  Server: $User@$Server"                  -ForegroundColor DarkCyan
Write-Host "========================================`n" -ForegroundColor DarkCyan

# Schritt 1: Quelldateien aus Git-Repo verwenden
Write-Step "Quelldateien aus Repo suchen"

$repo = $PSScriptRoot

$appItem     = Get-ChildItem $repo -Filter "*hlwagen-Verwaltung.dc.html" | Select-Object -First 1
$bookingItem = Get-Item (Join-Path $repo "Buchungsanfrage.dc.html") -ErrorAction SilentlyContinue
$startItem   = Get-Item (Join-Path $repo "Startseite.dc.html")      -ErrorAction SilentlyContinue
$supportItem = Get-Item (Join-Path $repo "support.js")               -ErrorAction SilentlyContinue

if (-not $appItem)     { Write-Fail "Verwaltung .dc.html nicht im Repo gefunden." }
if (-not $bookingItem) { Write-Fail "Buchungsanfrage.dc.html nicht im Repo gefunden." }
if (-not $startItem)   { Write-Fail "Startseite.dc.html nicht im Repo gefunden." }
if (-not $supportItem) { Write-Fail "support.js nicht im Repo gefunden." }

Write-Ok "Verwaltung:    $($appItem.Name) ($([math]::Round($appItem.Length/1024))KB)"
Write-Ok "Buchungsseite: $($bookingItem.Name) ($([math]::Round($bookingItem.Length/1024))KB)"
Write-Ok "Startseite:    $($startItem.Name) ($([math]::Round($startItem.Length/1024))KB)"
Write-Ok "Support.js:    $($supportItem.Name) ($([math]::Round($supportItem.Length/1024))KB)"

# Schritt 2: Dateien per SCP hochladen
Write-Step "Dateien auf Server hochladen (SCP)"

scp $appItem.FullName     "${User}@${Server}:/root/index.html"
if ($LASTEXITCODE -ne 0) { Write-Fail "SCP fuer index.html fehlgeschlagen" }
Write-Ok "index.html hochgeladen"

scp $bookingItem.FullName "${User}@${Server}:/root/buchung.html"
if ($LASTEXITCODE -ne 0) { Write-Fail "SCP fuer buchung.html fehlgeschlagen" }
Write-Ok "buchung.html hochgeladen"

scp $startItem.FullName   "${User}@${Server}:/root/start.html"
if ($LASTEXITCODE -ne 0) { Write-Fail "SCP fuer start.html fehlgeschlagen" }
Write-Ok "start.html hochgeladen"

scp $supportItem.FullName "${User}@${Server}:/root/support.js"
if ($LASTEXITCODE -ne 0) { Write-Fail "SCP fuer support.js fehlgeschlagen" }
Write-Ok "support.js hochgeladen"

# uploads-Ordner deployen (nur Logo)
$uploadsPath = Join-Path $repo "uploads"
$logoFile = Join-Path $uploadsPath "logo-weiss-transparent-1000.gif"
if (Test-Path $logoFile) {
    Write-Step "Logo hochladen"
    scp $logoFile "${User}@${Server}:/root/logo-weiss-transparent-1000.gif"
    if ($LASTEXITCODE -eq 0) { Write-Ok "Logo hochgeladen" }
    else { Write-Host "    WARN: Logo-Upload fehlgeschlagen" -ForegroundColor Yellow }
}

# Hook-Datei deployen (optional)
$hookPath = Join-Path $repo "pb_hooks\kw_anfragen.pb.js"
if (Test-Path $hookPath) {
    scp $hookPath "${User}@${Server}:/root/kw_anfragen.pb.js"
    Write-Ok "Hook-Datei hochgeladen"
}

# Schritt 3: In Container kopieren
Write-Step "Dateien in PocketBase Container kopieren"

$containerCmd = @'
CONTAINER=$(docker ps --format '{{.ID}} {{.Image}}' | grep pocketbase | awk '{print $1}' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "FEHLER: Kein PocketBase Container gefunden!"
  exit 1
fi
echo "Container: $CONTAINER"
docker cp /root/index.html   $CONTAINER:/pb_public/index.html
docker cp /root/buchung.html $CONTAINER:/pb_public/buchung.html
docker cp /root/start.html   $CONTAINER:/pb_public/start.html
docker cp /root/support.js   $CONTAINER:/pb_public/support.js
docker cp /root/logo-weiss-transparent-1000.gif $CONTAINER:/pb_public/uploads/logo-weiss-transparent-1000.gif 2>/dev/null || true
# Hook in ALLE moeglichen hooksDir-Pfade kopieren (aktiv ist der CWD-relative, meist /pb/pb_hooks)
docker exec $CONTAINER mkdir -p /pb_data/pb_hooks /pb_hooks /pb/pb_hooks
docker cp /root/kw_anfragen.pb.js $CONTAINER:/pb_data/pb_hooks/kw_anfragen.pb.js 2>/dev/null || true
docker cp /root/kw_anfragen.pb.js $CONTAINER:/pb_hooks/kw_anfragen.pb.js 2>/dev/null || true
docker cp /root/kw_anfragen.pb.js $CONTAINER:/pb/pb_hooks/kw_anfragen.pb.js 2>/dev/null || true
echo "DONE"
'@

$result = ssh "${User}@${Server}" $containerCmd
if ($LASTEXITCODE -ne 0 -or $result -match "FEHLER") { Write-Fail "Container-Copy fehlgeschlagen: $result" }
Write-Ok "Alle Dateien im Container"

# Schritt 4: Container neu starten (nur bei Hook-Aenderungen)
if ($Hooks) {
    Write-Step "PocketBase Container neu starten (Hooks aktivieren)"
    $restartCmd = 'CONTAINER=$(docker ps --format ''{{.ID}} {{.Image}}'' | grep pocketbase | awk ''{print $1}'' | head -1); docker restart $CONTAINER; echo RESTARTED'
    $rr = ssh "${User}@${Server}" $restartCmd
    if ($rr -match "RESTARTED") { Write-Ok "Container neu gestartet - Hooks aktiv" }
    else { Write-Host "    WARN: Restart unklar: $rr" -ForegroundColor Yellow }
}

# Fertig
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  DEPLOY ERFOLGREICH!"                    -ForegroundColor Green
Write-Host "  Start:   https://kw.hofreither.at/start.html"   -ForegroundColor Green
Write-Host "  App:     https://kw.hofreither.at/index.html"   -ForegroundColor Green
Write-Host "  Buchung: https://kw.hofreither.at/buchung.html" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Read-Host "Enter druecken zum Schliessen"
