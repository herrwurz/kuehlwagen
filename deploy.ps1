# deploy.ps1 — Kühlwagen-Verwaltung Deploy-Script
# Verwendung: .\deploy.ps1
# Voraussetzung: SSH-Zugang zu root@116.203.141.156 funktioniert

param(
    [string]$Server = "116.203.141.156",
    [string]$User = "root",
    [string]$AppFile = "Kuehlwagen-Verwaltung-standalone.html",
    [string]$BookingFile = "Buchungsanfrage-standalone.html"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host "`n>>> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "    OK: $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "    FEHLER: $msg" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor DarkCyan
Write-Host "  Kühlwagen-Verwaltung Deploy-Script" -ForegroundColor DarkCyan
Write-Host "  Server: $User@$Server" -ForegroundColor DarkCyan
Write-Host "========================================`n" -ForegroundColor DarkCyan

# ── Schritt 1: Git merge dev → main ─────────────────────────────────────────
Write-Step "Git: dev → main mergen"
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
    git checkout main
    git merge dev --no-edit
    git push origin main
    Write-Ok "dev nach main gemergt und gepusht"
} else {
    Write-Ok "Bereits auf main"
}

# ── Schritt 2: Standalone HTMLs prüfen ──────────────────────────────────────
Write-Step "Standalone HTML Dateien prüfen"

$appPath = Join-Path $PSScriptRoot $AppFile
$bookingPath = Join-Path $PSScriptRoot $BookingFile

if (-not (Test-Path $appPath)) {
    Write-Fail "$AppFile nicht gefunden. Bitte zuerst in Claude.ai als Standalone exportieren."
}
if (-not (Test-Path $bookingPath)) {
    Write-Fail "$BookingFile nicht gefunden. Bitte zuerst in Claude.ai als Standalone exportieren."
}

$appSize = (Get-Item $appPath).Length
$bookingSize = (Get-Item $bookingPath).Length
Write-Ok "App: $([math]::Round($appSize/1024))KB"
Write-Ok "Buchungsseite: $([math]::Round($bookingSize/1024))KB"

# ── Schritt 3: Dateien auf Server hochladen ──────────────────────────────────
Write-Step "Dateien auf Server hochladen"

scp $appPath "${User}@${Server}:/root/index.html"
if ($LASTEXITCODE -ne 0) { Write-Fail "SCP für index.html fehlgeschlagen" }
Write-Ok "index.html hochgeladen"

scp $bookingPath "${User}@${Server}:/root/buchung.html"
if ($LASTEXITCODE -ne 0) { Write-Fail "SCP für buchung.html fehlgeschlagen" }
Write-Ok "buchung.html hochgeladen"

# Hook-Datei deployen
$hookPath = Join-Path $PSScriptRoot "pb_hooks\kw_anfragen.pb.js"
if (Test-Path $hookPath) {
    scp $hookPath "${User}@${Server}:/root/kw_anfragen.pb.js"
    Write-Ok "Hook-Datei hochgeladen"
}

# ── Schritt 4: In Container kopieren ─────────────────────────────────────────
Write-Step "Dateien in PocketBase Container kopieren"

$containerCmd = @"
CONTAINER=\$(docker ps --format '{{.ID}} {{.Image}}' | grep pocketbase | awk '{print \$1}' | head -1)
if [ -z "\$CONTAINER" ]; then
  echo "FEHLER: Kein PocketBase Container gefunden!"
  exit 1
fi
echo "Container: \$CONTAINER"
docker cp /root/index.html \$CONTAINER:/pb_public/index.html
docker cp /root/buchung.html \$CONTAINER:/pb_public/buchung.html
docker exec \$CONTAINER mkdir -p /pb_data/pb_hooks
docker cp /root/kw_anfragen.pb.js \$CONTAINER:/pb_data/pb_hooks/kw_anfragen.pb.js 2>/dev/null || true
echo "DONE"
"@

$result = ssh "${User}@${Server}" $containerCmd
if ($result -match "FEHLER") {
    Write-Fail $result
}
Write-Ok "Alle Dateien im Container"

# ── Fertig ────────────────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  DEPLOY ERFOLGREICH!" -ForegroundColor Green
Write-Host "  App:     https://kw.hofreither.at/index.html" -ForegroundColor Green
Write-Host "  Buchung: https://kw.hofreither.at/buchung.html" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
