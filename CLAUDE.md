# Kühlwagen-Verwaltungssystem — Projektnotizen

## Arbeitsweise / Workflow (Stand 02.07.2026)

**Zwei gleichwertige Wege — beide enden bei deploy.bat:**

**Weg 1: Code-Fixes (VS Code)**
1. `.dc.html` in VS Code (`C:\Projekte\kuehlwagen\`) bearbeiten
2. `deploy.bat` ausführen → DC-Dateien + `support.js` direkt auf Server

**Weg 2: UI-Änderungen (Claude)**
1. `.dc.html` in Claude Design Editor bearbeiten
2. Geänderte DC-Datei herunterladen → in `kuehlwagen`-Ordner legen
3. `deploy.bat` ausführen

**Kein Standalone-Export mehr nötig!** `deploy.ps1` deployed die DC-Dateien direkt zusammen mit `support.js`.

**Wichtig:** `support.js` muss im `kuehlwagen`-Ordner liegen und bei Claude-Updates synchronisiert werden.

**Datei-Upload zu Claude:** Geänderte DC-Datei per Drag & Drop in den Chat ziehen → Claude übernimmt sie und kann weiter bearbeiten.

---

## Bekannte Fixes & Entscheidungen (Stand 02.07.2026)

### Deploy-Script (deploy.ps1)
- Sucht DC-Dateien im Repo-Ordner per Glob (umgeht Umlaut-Encoding-Probleme)
- Deployed auch `support.js` (zwingend erforderlich für DC-Dateien)
- Logo (`uploads/logo-weiss-transparent-1000.gif`) wird automatisch deployed → landet in `/pb_public/uploads/`
- **SSH-Key einrichten:** `setup-ssh-key.ps1` einmalig ausführen → kein Passwort mehr bei deploy.bat
- `support.js` Pfad: `/support.js` (absolut) — nicht `./support.js` (führt zu falschem Pfad bei index.html)
- **Zwei Deploy-Varianten:**
  - `deploy.bat` — normaler Deploy (HTML-Änderungen), KEIN Container-Restart
  - `deploy-hooks.bat` — Deploy MIT Hook-Update + Container-Neustart (`deploy.ps1 -Hooks`). Nur nötig wenn `pb_hooks/kw_anfragen.pb.js` geändert wurde

### Kalender-Sync & Doppelanfragen (Stand 02.07.2026) — GELÖST
- **kw_calendar Format:** `[{from, to, type:'booked'|'requested'}]` — booked = Buchungen, requested = pending Anfragen
- **Serverseitiger Hook LÄUFT JETZT** (`kw_anfragen.pb.js`): spiegelt pending-Anfragen sofort nach kw_calendar, unabhängig von der Admin-App. Login-Lücke geschlossen.
- **Client-Pfad zusätzlich aktiv:** `loadAnfragen()` → `syncCalendar()` (booked + requested), bei Login + alle 2 Min
- **buchung.html:** liest kw_calendar (`sort=-updated`), zeigt `angefragt` orange, Auswahl blockiert; Datumsfelder ROT bei Konflikt; Submit blockiert bei Überlappung; Doppel-Submit-Guard; Reload nach Submit
- Alter kw_calendar-Eintrag ohne `type` → als `booked` behandelt (`r.type||'booked'`)

### ⚠️ ZWEI ENTSCHEIDENDE HOOK-FALLSTRICKE (waren die Ursache)
1. **Hooks-Pfad:** PocketBase läuft mit `hooksDir=pb_hooks` (RELATIV → CWD-relativ = `/pb/pb_hooks`, NICHT `/pb_data/pb_hooks`!). Es gibt drei Kandidaten: `/pb_hooks`, `/pb/pb_hooks`, `/pb_data/pb_hooks`. `deploy.ps1` kopiert jetzt in ALLE DREI. Aktiv ist `/pb/pb_hooks`.
2. **Isolierter Scope:** PocketBase-Hook-Callbacks können KEINE top-level Funktionen/Variablen aufrufen → `ReferenceError: xxx is not defined`. Alle Logik MUSS inline im Callback stehen, nur globale `$app.*` / `new Record()` sind verfügbar. Die Kalender-Rebuild-Logik ist daher inline in beide Hooks dupliziert.
- **PocketBase Version:** v0.39.5 → `$app.save(record)`, `$app.findAllRecords()`, `$app.findRecordsByFilter()`, `$app.findCollectionByNameOrId()`, `new Record(coll)` sind korrekt
- **Diagnose-Trick wenn Hook-Logs unsichtbar:** `console.log`/`$app.logger()` erscheinen NICHT in Admin-Logs oder docker logs. Stattdessen Diagnose in E-Mail-Betreff schreiben (Mail-Kanal funktioniert zuverlässig)

### Konfliktcheck (Doppelbuchungen)
- `submitBooking` (manuelle Buchung): prüft gegen bestehende Buchungen mit `parseD()` (nicht String-Vergleich!)
- `approveAnfrage` (Online-Anfrage genehmigen): prüft ebenfalls mit `parseD()`
- String-Vergleich war fehlerhaft bei Datumsformaten ohne führende Null

### Tagessatz
- Default ist `??0` (nicht `||85`) — `||` würde bei Tagessatz=0 auf 85 fallen

### Logo / uploads
- Logo liegt in `kuehlwagen/uploads/logo-weiss-transparent-1000.gif`
- Server-Pfad: `/pb_public/uploads/logo-weiss-transparent-1000.gif`
- Unnötige Dateien am Server löschen: `docker exec $CONTAINER sh -c 'rm -f /pb_public/uploads/pasted-*'`

### PocketBase Reset
- `resetAllData()` löscht Bookings/Calendar/Anfragen in PocketBase + localStorage/sessionStorage
- `kw_state` Record bleibt erhalten (Inhalt wird geleert) — ist so gewollt
- `kw_calendar` Record bleibt erhalten (data leer) — ist ok

### Login
- `localStorage.removeItem('pocketbase_auth')` vor `new PocketBase()` → kein Auto-Login
- `this.pb` nach Logout NICHT auf null setzen — nur `authStore.clear()`

---

## Deployment-Status (Stand 26.07.2026)

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
- **Root-Passwort:** Kuehlwagen2026

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
**Aktueller Weg:** `.\deploy.bat` im Repo-Ordner ausführen (Doppelklick oder PowerShell). Deployed direkt die `.dc.html`-Dateien + `support.js` (kein Standalone-Export mehr nötig, siehe „Arbeitsweise / Workflow" oben) an `index.html`, `buchung.html`, `start.html` in `pb_public/`. Voraussetzung: SSH-Key eingerichtet (`setup-ssh-key.ps1` einmalig ausführen) oder Passwort zur Hand.

Manuell (falls `deploy.bat` nicht verfügbar ist):
```powershell
scp "Kühlwagen-Verwaltung.dc.html" root@116.203.141.156:/root/index.html
scp "Buchungsanfrage.dc.html"      root@116.203.141.156:/root/buchung.html
scp "Startseite.dc.html"           root@116.203.141.156:/root/start.html
scp "support.js"                   root@116.203.141.156:/root/support.js

# In Container kopieren:
CONTAINER=$(docker ps --format '{{.ID}} {{.Image}}' | grep pocketbase | awk '{print $1}' | head -1)
docker cp /root/index.html   $CONTAINER:/pb_public/index.html
docker cp /root/buchung.html $CONTAINER:/pb_public/buchung.html
docker cp /root/start.html   $CONTAINER:/pb_public/start.html
docker cp /root/support.js   $CONTAINER:/pb_public/support.js
```

### SSH-Zugang aktivieren (falls Permission denied)
```bash
echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config
echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
service ssh restart
# known_hosts löschen falls nötig:
ssh-keygen -R 116.203.141.156
```

⚠️ Falls SSH trotz korrektem Passwort mit "Authentication failed" scheitert: fail2ban kann die eigene IP nach ein paar Fehlversuchen sperren. Nur über die Hetzner VNC Console behebbar:
```bash
fail2ban-client status sshd        # gesperrte IPs anzeigen
fail2ban-client set sshd unbanip <IP>
```

### Hook-Datei deployen
**Aktueller Weg:** `.\deploy-hooks.bat` im Repo-Ordner ausführen — deployed Frontend + Hook und startet den Container neu (nötig, damit der Hook geladen wird).

Manuell: Datei in **alle drei** Kandidaten-Pfade kopieren, da der tatsächlich aktive Pfad je nach PocketBase-Startkonfiguration variiert (`hooksDir` ist CWD-relativ; aktiv beobachtet: `/pb/pb_hooks`):
```powershell
scp "pb_hooks\kw_anfragen.pb.js" root@116.203.141.156:/root/kw_anfragen.pb.js
```
```bash
CONTAINER=$(docker ps --format '{{.ID}} {{.Image}}' | grep pocketbase | awk '{print $1}' | head -1)
docker exec $CONTAINER mkdir -p /pb_data/pb_hooks /pb_hooks /pb/pb_hooks
docker cp /root/kw_anfragen.pb.js $CONTAINER:/pb_data/pb_hooks/kw_anfragen.pb.js
docker cp /root/kw_anfragen.pb.js $CONTAINER:/pb_hooks/kw_anfragen.pb.js
docker cp /root/kw_anfragen.pb.js $CONTAINER:/pb/pb_hooks/kw_anfragen.pb.js
docker restart $CONTAINER
```

### Git-Workflow
- **Repo:** https://github.com/herrwurz/kuehlwagen
- **Branches:** main (Prod), dev (Entwicklung) — beide aktuell auf demselben Stand (26.07.2026 gemerged)
- **Lokaler Ordner:** `C:\Projekte\kuehlwagen`

```powershell
# Commit & Deploy:
cd C:\Projekte\kuehlwagen
git checkout dev
git add .
git commit -m "Beschreibung"
git push origin dev
git checkout main
git merge dev --no-edit
git push origin main
git checkout dev
```

⚠️ **Am 26.07.2026 mussten 2 seit 02.07. auf `dev` liegende, nie gemergte Commits nachträglich in `main` gemerged werden** (Kalender-Sync-Hook, SSH-Key-Setup u.a. waren dadurch bis dahin nicht in `main`/Produktion aktiv, obwohl sie schon länger auf dem Server liefen). Um das zu vermeiden: nach Feature-Arbeit auf `dev` möglichst zeitnah nach `main` mergen, nicht wochenlang aufschieben.

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
12. **Lokale PocketBase-Entwicklungsumgebung** — FERTIG (siehe Abschnitt unten)
13. **Root-Redirect** / → /start.html — FERTIG via Traefik-Middleware `kw-root-redirect` (Custom Labels in Coolify, Ressource `docker-image-v9j9ncs0jejdvkjiz8fuzqgw`, Router `https-0-v9j9ncs0jejdvkjiz8fuzqgw`)

### Offene Aufgaben
1. **Setup-Guide** für Git/Deploy erstellen

## Lokale Entwicklungsumgebung

Läuft komplett unabhängig vom Produktivserver, im Projektordner (`pocketbase.exe`, `pb_data/`, `pb_public/` sind gitignored).

### Start
```powershell
./pocketbase.exe serve --http=127.0.0.1:8090
```
Kein Autostart eingerichtet — muss nach jedem Neustart manuell gestartet werden.

### URLs (lokal)
- Startseite: http://127.0.0.1:8090/start.html
- Verwaltung: http://127.0.0.1:8090/index.html
- Buchungsseite: http://127.0.0.1:8090/buchung.html
- PocketBase Admin: http://127.0.0.1:8090/_/

Die App erkennt die PocketBase-URL automatisch über `window.location.origin` (kein `PB_URL`-Umschalter nötig) — Voraussetzung ist, dass sie aus dem `pb_public`-Ordner desselben PocketBase-Servers ausgeliefert wird.

### Zugangsdaten (nur lokal!)
- Superuser `andreas@hofreither.at` — gleiches Passwort wie Prod
- Normale User (Login in der App): `andreas@hofreither.at`, `ulrike.gruber@valentinum.at`, `christa.pitschmann@valentinum.at` — alle mit Passwort `lokal1234`

### Bekannte Einschränkungen
- **SMTP nicht konfiguriert** — E-Mail-Hooks (`pb_hooks/kw_anfragen.pb.js`) laufen zwar, aber es wird lokal keine echte Mail verschickt. Für Tests müsste in der lokalen PB-Admin-UI ein SMTP-Server (z.B. Mailtrap) hinterlegt werden.
- `pb_public/` wird nicht automatisch aktualisiert — nach Änderungen an den `.dc.html`-Dateien oder `support.js` manuell neu kopieren (gleiches DC+support.js-Modell wie Produktion):
  ```powershell
  cp "Kühlwagen-Verwaltung.dc.html" pb_public/index.html
  cp "Buchungsanfrage.dc.html" pb_public/buchung.html
  cp "Startseite.dc.html" pb_public/start.html
  cp "support.js" pb_public/support.js
  ```

### Schema-Migrationen
`pb_migrations/` ist **versioniert** (im Gegensatz zu `pb_data/`) und enthält die automatisch generierten Migrationen für `kw_state`, `kw_calendar`, `kw_booking_requests`. Bei neuen Collections/Feldern legt PocketBase automatisch neue Dateien dort an — die sollten mitcommittet werden, damit das Schema reproduzierbar bleibt.

### Projektdateien
- `Kühlwagen-Verwaltung.dc.html` — Hauptapp (Design Component), wird direkt deployt (→ index.html)
- `Buchungsanfrage.dc.html` — Öffentliche Buchungsseite (→ buchung.html)
- `Startseite.dc.html` — Einstiegsseite mit 2 Buttons (→ start.html)
- `support.js` — gemeinsame JS-Library aller drei Seiten, wird mitdeployt (→ /support.js)
- `*-standalone.html` — **veraltet**, seit 02.07.2026 nicht mehr im Deploy-Prozess verwendet (deploy.ps1 nutzt die `.dc.html`-Dateien direkt)
- `pb_hooks/kw_anfragen.pb.js` — E-Mail- und Kalender-Sync-Hooks für PocketBase
- `pb_migrations/` — Schema-Migrationen (versioniert, siehe „Lokale Entwicklungsumgebung")
- `deploy.ps1` / `deploy.bat` — Deploy-Script (SCP + Container-Copy)
- `deploy-hooks.bat` — wie deploy.bat, zusätzlich Hook-Update + Container-Neustart
- `setup-ssh-key.ps1` — einmalig ausführen, dann kein Passwort mehr bei deploy.bat nötig
- `commit-and-deploy.ps1` — Git-Commit + Deploy kombiniert (referenziert alten Downloads-Pfad, ggf. veraltet)
- `Deployment-Anleitung.html` — Vollständige Anleitung

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
