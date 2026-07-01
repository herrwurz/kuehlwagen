# Kühlwagen-Verwaltungssystem — Projektnotizen

## Deployment-Status (Stand 30.06.2026)

### Server
- **Hoster:** Hetzner Cloud (testserver)
- **IP:** 116.203.141.156
- **Domain:** kw.hofreither.at (DNS korrekt gesetzt, SSL aktiv)
- **Zugang:** Hetzner VNC Console (browser-basiert) oder SSH root@116.203.141.156

### PocketBase Container
- **Image:** ghcr.io/muchobien/pocketbase:latest
- **Verwaltet durch:** Coolify
- **Container-Name** ändert sich bei jedem Deploy → immer `docker ps | grep pocket` ausführen
- **Volume:** `/pb_data` (destination im Container) — korrekt konfiguriert, Daten persistent
- **Startbefehl:** `--dir=/pb_data --publicDir=/pb_public --hooksDir=/pb_hooks`
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
- `andreas@hofreither.at` — angelegt in Users-Collection

### Offener Commit (morgen machen)
Alle heutigen Änderungen committen:
```powershell
cd "$env:USERPROFILE\Downloads\kuehlwagen"
git checkout dev
# Alle geänderten Dateien in Ordner kopieren (dc.html + standalone)
git add .
git commit -m "Belegung Filter Tag/Woche/Monat/Jahr, Anfragen-Tab, Mail-Hooks, Dashboard-Fixes"
git push
```

### ✅ Erledigte Aufgaben
1. **index.html hochladen** — FERTIG
   - Datei hier herunterladen (Kühlwagen-Verwaltung-standalone.html)
   - SSH-Passwort-Login aktivieren: `echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config && echo "PermitRootLogin yes" >> /etc/ssh/sshd_config && service ssh restart`
   - Per SCP hochladen: `scp "$env:USERPROFILE\Downloads\index.html" root@116.203.141.156:/root/index.html`
   - In Container kopieren: `docker cp /root/index.html <container-id>:/pb_public/index.html`
   - **App erreichbar unter: https://kw.hofreither.at/index.html**
   - ⚠️ Root-Passwort: `KW2026root` (bitte ändern!)
   - ⚠️ known_hosts bei Problemen löschen: `ssh-keygen -R 116.203.141.156`

### Offene Aufgaben
1. **Buchungsseite** (buchung.html) ebenso in `/pb_public/buchung.html` ablegen
   - Buchungsanfrage-standalone.html herunterladen → umbenennen → gleicher SCP-Weg

2. **Brevo SMTP** einrichten:
   - Account auf brevo.com
   - SMTP-Key generieren
   - In PocketBase Admin → Settings → Mail settings eintragen
   - Host: smtp-relay.brevo.com, Port: 587

3. **Hook-Datei** deployen:
   ```bash
   scp pb_hooks/kw_anfragen.pb.js root@116.203.141.156:/root/kw_anfragen.pb.js
   docker cp /root/kw_anfragen.pb.js <container-id>:/pb/pb_hooks/kw_anfragen.pb.js
   docker restart <container-id>
   ```

4. **Root-Redirect** / → /index.html — Traefik-Middleware nötig, komplex, vorerst als Lesezeichen belassen. App läuft stabil unter /index.html

### Projektdateien
- `Kühlwagen-Verwaltung.dc.html` — Hauptapp (Design Component)
- `Kühlwagen-Verwaltung-standalone.html` — Self-contained für pb_public
- `Buchungsanfrage.dc.html` — Öffentliche Buchungsseite
- `pb_hooks/kw_anfragen.pb.js` — E-Mail-Hooks für PocketBase
- `Deployment-Anleitung.html` — Vollständige Anleitung

### Geplant nach erstem vollständigen Deploy
- Git-Workflow einrichten (GitHub, dev/prod Branches) ✅
- Lokale PocketBase Entwicklungsumgebung (localhost:8090)
  - pocketbase.exe in kuehlwagen-Ordner legen
  - PB_URL in App umschaltbar machen (localhost:8090 vs kw.hofreither.at)
- PB_URL in Buchungsanfrage.dc.html konfigurierbar machen
- Deploy-Script oder GitHub Actions für Prod-Deploy ✅
- Setup-Guide dafür erstellen lassen

### Wichtige Hinweise
- SCP von Büro nicht möglich (Firewall)
- Hetzner VNC Console funktioniert von überall
- wget vom Server funktioniert (URL muss frisch generiert werden, läuft ab)
- `docker ps` Container-ID ändert sich bei jedem Coolify-Deploy
