# commit-and-deploy.ps1
# Automatischer Git-Commit + Deploy für Kühlwagen-Verwaltungssystem
# Verwendung: .\commit-and-deploy.ps1 [-msg "Beschreibung"] [-deploy]
# Beispiel:   .\commit-and-deploy.ps1 -msg "Neues Feature" -deploy

param(
    [string]$msg = "",
    [switch]$deploy = $false
)

$ErrorActionPreference = "Stop"
$RepoDir = "$env:USERPROFILE\Downloads\kuehlwagen"
$Server = "116.203.141.156"
$ServerUser = "root"

function Write-Step($text) { Write-Host "`n>>> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "    OK: $text" -ForegroundColor Green }
function Write-Fail($text) { Write-Host "    FEHLER: $text" -ForegroundColor Red; exit 1 }

Write-Host "`n==========================================" -ForegroundColor DarkCyan
Write-Host "  Kühlwagen — Commit & Deploy Script" -ForegroundColor DarkCyan
Write-Host "==========================================`n" -ForegroundColor DarkCyan

# ── Ins Repo wechseln ────────────────────────────────────────────────────────
if (-not (Test-Path "$RepoDir\.git")) { Write-Fail "Kein Git-Repo in $RepoDir gefunden!" }
cd $RepoDir

# ── Branch prüfen ────────────────────────────────────────────────────────────
Write-Step "Branch prüfen"
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "dev") {
    git checkout dev
    Write-Ok "Auf dev gewechselt"
} else {
    Write-Ok "Bereits auf dev"
}

# ── Status anzeigen ──────────────────────────────────────────────────────────
Write-Step "Geänderte Dateien"
$status = git status --short
if (-not $status) {
    Write-Host "    Keine Änderungen — nichts zu committen." -ForegroundColor Yellow
    if (-not $deploy) { exit 0 }
} else {
    Write-Host $status -ForegroundColor White
}

# ── Commit-Message ───────────────────────────────────────────────────────────
if ($status) {
    if (-not $msg) {
        $msg = Read-Host "`nCommit-Beschreibung eingeben"
        if (-not $msg) { $msg = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
    }

    Write-Step "Git add + commit"
    git add .
    git commit -m $msg
    Write-Ok "Committed: $msg"

    Write-Step "Push zu origin/dev"
    git push origin dev
    Write-Ok "Gepusht"

    # ── Nach main mergen ─────────────────────────────────────────────────────
    Write-Step "dev → main mergen"
    git checkout main
    git merge dev --no-edit
    git push origin main
    git checkout dev
    Write-Ok "main aktualisiert"
}

# ── Deploy auf Server ────────────────────────────────────────────────────────
if ($deploy) {
    Write-Step "Standalone HTMLs prüfen"
    $appFile     = Join-Path $RepoDir "Kuehlwagen-Verwaltung-standalone.html"
    $bookingFile = Join-Path $RepoDir "Buchungsanfrage-standalone.html"

    if (-not (Test-Path $appFile))     { Write-Fail "Kuehlwagen-Verwaltung-standalone.html fehlt! Zuerst in Claude.ai exportieren." }
    if (-not (Test-Path $bookingFile)) { Write-Fail "Buchungsanfrage-standalone.html fehlt! Zuerst in Claude.ai exportieren." }

    Write-Ok "App: $([math]::Round((Get-Item $appFile).Length/1024))KB"
    Write-Ok "Buchung: $([math]::Round((Get-Item $bookingFile).Length/1024))KB"

    Write-Step "Dateien auf Server hochladen (SCP)"
    scp $appFile     "${ServerUser}@${Server}:/root/index.html"
    scp $bookingFile "${ServerUser}@${Server}:/root/buchung.html"

    $hookFile = Join-Path $RepoDir "pb_hooks\kw_anfragen.pb.js"
    if (Test-Path $hookFile) {
        scp $hookFile "${ServerUser}@${Server}:/root/kw_anfragen.pb.js"
        Write-Ok "Hook-Datei hochgeladen"
    }

    Write-Step "In PocketBase Container kopieren"
    $cmd = @"
CONTAINER=`$(docker ps --format '{{.ID}} {{.Image}}' | grep pocketbase | awk '{print `$1}' | head -1)
if [ -z "`$CONTAINER" ]; then echo "FEHLER: Kein Container"; exit 1; fi
docker cp /root/index.html `$CONTAINER:/pb_public/index.html
docker cp /root/buchung.html `$CONTAINER:/pb_public/buchung.html
docker exec `$CONTAINER mkdir -p /pb_data/pb_hooks
docker cp /root/kw_anfragen.pb.js `$CONTAINER:/pb_data/pb_hooks/kw_anfragen.pb.js 2>/dev/null || true
echo "DONE"
"@
    ssh "${ServerUser}@${Server}" $cmd
    Write-Ok "Dateien im Container"
}

# ── Fertig ────────────────────────────────────────────────────────────────────
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  FERTIG!" -ForegroundColor Green
if ($deploy) {
    Write-Host "  App:     https://kw.hofreither.at/index.html" -ForegroundColor Green
    Write-Host "  Buchung: https://kw.hofreither.at/buchung.html" -ForegroundColor Green
}
Write-Host "==========================================`n" -ForegroundColor Green
