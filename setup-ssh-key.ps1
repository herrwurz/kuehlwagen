# setup-ssh-key.ps1 — Einmalig ausführen um SSH-Key zu hinterlegen
# Danach kein Passwort mehr bei deploy.bat nötig

$Server = "116.203.141.156"
$User   = "root"

Write-Host "`n=== SSH-Key Setup ===" -ForegroundColor Cyan

# Key generieren falls noch keiner existiert
$keyPath = "$env:USERPROFILE\.ssh\id_rsa"
if (-not (Test-Path $keyPath)) {
    Write-Host "Generiere neuen SSH-Key ..." -ForegroundColor Yellow
    ssh-keygen -t rsa -b 4096 -f $keyPath -N '""'
    Write-Host "Key erstellt: $keyPath" -ForegroundColor Green
} else {
    Write-Host "SSH-Key bereits vorhanden: $keyPath" -ForegroundColor Green
}

# Public Key auf Server kopieren (einmalig Passwort nötig)
Write-Host "`nKopiere Public Key auf Server (Passwort einmalig eingeben) ..." -ForegroundColor Yellow
$pubKey = Get-Content "$keyPath.pub"
ssh "${User}@${Server}" "mkdir -p ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"

Write-Host "`n=== Fertig! ===" -ForegroundColor Green
Write-Host "Ab jetzt kein Passwort mehr bei deploy.bat erforderlich." -ForegroundColor Green
Read-Host "Enter drücken zum Schliessen"
