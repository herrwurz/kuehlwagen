# Kühlwagen-Verwaltungssystem — Projektnotizen

## Deployment-Status (Stand 01.07.2026)

### App-URLs
- **Startseite:** https://kw.hofreither.at/start.html
- **Verwaltung:** https://kw.hofreither.at/index.html
- **Buchungsseite:** https://kw.hofreither.at/buchung.html
- **PocketBase Admin:** https://kw.hofreither.at/_/

### Server
- **Hoster:** Hetzner Cloud (testserver)
- **IP:** 116.203.141.156
- **Domain:** kw.hofreither.at (DNS korrekt gesetzt, SSL aktiv)
- **Zugang:** Hetzner VNC Console (browser-basiert) oder SSH root@116.203.141.156
- **Root-Passwort:** KW2026root (bitte ändern!)

### PocketBase Container
- **Image:** ghcr.io/muchobien/pocketbase:latest
- **Verwaltet durch:** Coolify
- **Container-Name** ändert sich bei jedem Deploy → immer `docker ps | grep pocket` ausführen
- **Volume:** `/pb_data` (destination im Container) — korrekt konfiguriert, Daten persistent
- **Port:** 8090 (in Coolify korrekt eingetragen)

### PocketBase Superuser erstellen (nach jedem Deploy nötig falls Daten verloren)
```bash
docker exec <container-id> /usr/local/bin/pocketbase superuser upsert andreas@hofreither.at PASSWORT --dir=/pb_data
```
⚠️ Immer `--dir=/pb_data` anhängen, sonst wird falsche DB verwendet!

### PocketBase Collections (alle angelegt)
- `kw_state` — Hauptdaten der App (JSON-Feld `data`), Auth required
- `kw_booking_requests` — Online-Anfragen, Create öffentlich, rest Auth
- `kw_calendar` — Verfügbarkeit öffentlich lesbar, Write Auth

### PocketBase Benutzer
- `andreas@hofreither.at` — Superuser + normaler User
- `ulrike.gruber@valentinum.at` — Mitarbeiterin
- `christa.pitschmann@valentinum.at` — Mitarbeiterin

### SMTP (Brevo)
- Host: smtp-relay.brevo.com, Port: 587
- Konfiguriert in PocketBase Admin → Settings → Mail settings
- Sender: rathaus@st-valentin.at / Kühlwagen-Verleih St. Valentin

### Deployment (Dateien auf Server)
```powershell
# Per SCP hochladen:
scp "$env:USERPROFILE\Downloads\index.html" root@116.203.141.156:/root/index.html
scp "$env:USERPROFILE\Downloads\buchung.html" root@116.203.141.156:/root/buchung.html
scp "$env:USERPROFILE\Downloads\start.html" root@116.203.141.156:/root/start.html

# In Container kopieren (VNC Console):
CONTAINER=$(docker ps --format '{{.ID}} {{.Image}}' | grep pocketbase | awk '{print $1}' | head -1)
docker cp /root/index.html $CONTAINER:/pb_public/index.html
docker cp /root/buchung.html $CONTAINER:/pb_public/buchung.html
docker cp /root/start.html $CONTAINER:/pb_public/start.html
```

### SSH-Zugang aktivieren (falls Permission denied)
```bash
echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config
echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
service ssh restart
# known_hosts löschen falls nötig:
ssh-keygen -R 116.203.141.156
```

### Hook-Datei deployen
```powershell
scp "$env:USERPROFILE\Downloads\kw_anfragen.pb.js" root@116.203.141.156:/root/kw_anfragen.pb.js
```
```bash
CONTAINER=$(docker ps --format '{{.ID}} {{.Image}}' | grep pocketbase | awk '{print $1}' | head -1)
docker exec $CONTAINER mkdir -p /pb_data/pb_hooks
docker cp /root/kw_anfragen.pb.js $CONTAINER:/pb_data/pb_hooks/kw_anfragen.pb.js
docker restart $CONTAINER
```

### Git-Workflow
- **Repo:** https://github.com/herrwurz/kuehlwagen
- **Branches:** main (Prod), dev (Entwicklung)
- **Lokaler Ordner:** `$env:USERPROFILE\Downloads\kuehlwagen`

```powershell
# Commit & Deploy:
cd "$env:USERPROFILE\Downloads\kuehlwagen"
git checkout dev
git add .
git commit -m "Beschreibung"
git push origin dev
git checkout main
git merge dev --no-edit
git push origin main
git checkout dev
```

### Offener Commit (noch ausstehend)
Alle heutigen Änderungen ins Git:
```powershell
cd "$env:USERPROFILE\Downloads\kuehlwagen"
git checkout dev
git add .
git commit -m "Tagessatz 0 fix, logout fix, km entfernt, Buchungsbestätigung Mail, Startseite, alle Bugfixes, pbRecordId race condition fix"
git push origin dev
git checkout main
git merge dev --no-edit
git push origin main
git checkout dev
```

### ✅ Erledigte Aufgaben
1. **index.html** — FERTIG (https://kw.hofreither.at/index.html)
2. **buchung.html** — FERTIG (https://kw.hofreither.at/buchung.html)
3. **start.html** — FERTIG (https://kw.hofreither.at/start.html)
4. **PocketBase** — Collections, Benutzer, SMTP alle konfiguriert
5. **E-Mail-Hooks** — Neue Anfrage, Genehmigung, Ablehnung, Buchungsbestätigung
6. **Belegung** — Filter Tag/Woche/Monat/Jahr
7. **Anfragen-Tab** — Genehmigen/Ablehnen mit Auto-Mail
8. **Logo St. Valentin** — in Sidebar, Rechnung, Buchungsseite
9. **Reset-Button** — in Stammdaten, löscht alle Daten + PocketBase
10. **Git-Workflow** — GitHub Repo, dev/prod Branches, deploy.ps1
11. **pbRecordId Race Condition** — BEHOBEN (sessionStorage Backup, 300ms Debounce, beforeunload)

### Offene Aufgaben
1. **Root-Redirect** / → /start.html — Traefik-Middleware nötig, vorerst als Lesezeichen belassen
2. **Lokale PocketBase** einrichten (pocketbase.exe + PB_URL umschaltbar)
3. **Setup-Guide** für Git/Deploy erstellen

### Projektdateien
- `Kühlwagen-Verwaltung.dc.html` — Hauptapp (Design Component)
- `Kühlwagen-Verwaltung-standalone.html` — Self-contained für pb_public (→ index.html)
- `Buchungsanfrage.dc.html` — Öffentliche Buchungsseite
- `Buchungsanfrage-standalone.html` — Self-contained (→ buchung.html)
- `Startseite.dc.html` — Einstiegsseite mit 2 Buttons
- `Startseite-standalone.html` — Self-contained (→ start.html)
- `pb_hooks/kw_anfragen.pb.js` — E-Mail-Hooks für PocketBase
- `deploy.ps1` — Deploy-Script (SCP + Container-Copy)
- `commit-and-deploy.ps1` — Git-Commit + Deploy kombiniert
- `Deployment-Anleitung.html` — Vollständige Anleitung

### Geplant
- Git-Workflow einrichten (GitHub, dev/prod Branches) ✅
- Lokale PocketBase Entwicklungsumgebung (localhost:8090)
  - pocketbase.exe in kuehlwagen-Ordner legen
  - PB_URL in App umschaltbar machen (localhost:8090 vs kw.hofreither.at)
- Deploy-Script ✅
- Setup-Guide dafür erstellen lassen

### Bekannte technische Fallstricke (für zukünftige Entwicklung)
- `this.pb` nach Logout NICHT auf `null` setzen — nur `authStore.clear()` — sonst schlägt das nächste Login fehl
- Alle `.then()` Callbacks die `this.pb` verwenden brauchen einen `if(!this.pb)return;` Guard
- `saveToPB()` und `loadFromPB()` brauchen `if(!this.pb)return;` am Anfang
- PocketBase speichert Auth in `localStorage` unter `pocketbase_auth` — beim Logout explizit löschen
- Superuser-Befehl immer mit `--dir=/pb_data` ausführen, sonst falsche DB
- `||` statt `??` für 0-Werte (Tagessatz, Kaution) führt zu falschen Defaults — immer `??` verwenden
- Standalone HTML immer neu exportieren nach Änderungen an dc.html
- `login()` muss `this.pb` neu erstellen wenn es null ist — frische PocketBase-Instanz bei jedem Login-Versuch
- `saveToPB()` Debounce war 1200ms → auf 300ms reduziert für bessere Persistenz
- sessionStorage als Backup: gewinnt über PB wenn ssCount > pbCount
- `beforeunload` Event sichert State vor Browser-Refresh/Tab-Schliessen
- pbRecordId race condition: saveToPB wartet 600ms wenn pbRecordId noch null

### Wichtige Hinweise
- SCP von Büro nicht möglich (Firewall)
- Hetzner VNC Console funktioniert von überall
- wget vom Server funktioniert (URL muss frisch generiert werden, läuft ab)
- `docker ps` Container-ID ändert sich bei jedem Coolify-Deploy
