// PocketBase JS Hooks — Kühlwagen Buchungsanfragen & Buchungsbestätigungen
// Aktiver Hooks-Pfad: CWD-relativ "pb_hooks" → bei diesem Image /pb/pb_hooks
// deploy.ps1 kopiert in alle drei Kandidaten-Pfade.
// WICHTIG: PocketBase-Hook-Callbacks laufen in isoliertem Scope — sie sehen
// KEINE top-level Funktionen/Variablen. Deshalb ist die Kalender-Logik in
// jeden Hook INLINE geschrieben und nutzt nur globale $app.* / Record APIs.
//
// Voraussetzung: SMTP in PocketBase Admin → Settings → Mail konfigurieren

// ─── Neue Anfrage → Kalender spiegeln + Mail an alle Benutzer ────────────────
onRecordAfterCreateSuccess((e) => {
  // ── Kalender-Rebuild (INLINE) ──────────────────────────────────────────────
  try {
    let allReqs = [];
    try { allReqs = $app.findAllRecords("kw_booking_requests"); } catch (ee) { allReqs = []; }
    const seen = {};
    const requested = [];
    for (let i = 0; i < allReqs.length; i++) {
      const rr = allReqs[i];
      if (rr.getString("status") !== "pending") continue;
      const f = rr.getString("from_date"), t = rr.getString("to_date");
      if (!f || !t) continue;
      const key = f + "_" + t;
      if (seen[key]) continue;                 // Dedup → idempotent
      seen[key] = true;
      requested.push({ from: f, to: t, type: "requested" });
    }
    let calRec = null;
    try {
      const cals = $app.findRecordsByFilter("kw_calendar", "id != ''", "-updated", 1, 0);
      calRec = (cals && cals.length > 0) ? cals[0] : null;
    } catch (ee) {
      try { const all = $app.findAllRecords("kw_calendar"); calRec = (all && all.length > 0) ? all[0] : null; } catch (e2) { calRec = null; }
    }
    const booked = [];
    if (calRec) {
      let raw = calRec.get("data");
      if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch (ee) { raw = []; } }
      else if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "number") {
        // PocketBase liefert JSON-Felder manchmal als rohes Byte-Array statt als String/Objekt —
        // ohne diese Rekonstruktion würden einzelne Bytes als kaputte "booked"-Einträge landen.
        try {
          let s = "";
          for (let k = 0; k < raw.length; k++) s += String.fromCharCode(raw[k]);
          raw = JSON.parse(s);
        } catch (ee) { raw = []; }
      }
      if (Array.isArray(raw)) { for (let j = 0; j < raw.length; j++) { const it = raw[j]; if (it && typeof it === "object" && (it.type || "booked") === "booked") booked.push(it); } }
    }
    const merged = booked.concat(requested);
    if (calRec) {
      calRec.set("data", merged);
      $app.save(calRec);
    } else {
      const coll = $app.findCollectionByNameOrId("kw_calendar");
      const newRec = new Record(coll);
      newRec.set("data", merged);
      $app.save(newRec);
    }
  } catch (err) {
    try { $app.logger().error("kw_calendar rebuild (create): " + String(err)); } catch (ignore) {}
  }

  // ── Benachrichtigungsmail an alle Benutzer ─────────────────────────────────
  const r = e.record;
  const name     = r.getString("name");
  const email    = r.getString("email");
  const phone    = r.getString("phone") || "—";
  const company  = r.getString("company") || "—";
  const from_d   = r.getString("from_date");
  const to_d     = r.getString("to_date");
  const purpose  = r.getString("purpose") || "—";
  const message  = r.getString("message") || "—";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f4f7fb;padding:20px">
      <div style="background:#142029;border-radius:12px 12px 0 0;padding:20px 24px">
        <div style="color:#fff;font-size:18px;font-weight:bold">❄ Neue Buchungsanfrage</div>
        <div style="color:#7d8a97;font-size:13px;margin-top:4px">Stadtgemeinde St. Valentin · Kühlwagen-Verleih</div>
      </div>
      <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;border:1px solid #e6eaef;border-top:none">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f6f8fb"><td style="padding:10px 14px;color:#666;width:140px">Name</td><td style="padding:10px 14px;font-weight:bold;color:#142029">${name}</td></tr>
          <tr><td style="padding:10px 14px;color:#666">Firma/Verein</td><td style="padding:10px 14px;color:#1b2733">${company}</td></tr>
          <tr style="background:#f6f8fb"><td style="padding:10px 14px;color:#666">E-Mail</td><td style="padding:10px 14px"><a href="mailto:${email}" style="color:#3b82d6">${email}</a></td></tr>
          <tr><td style="padding:10px 14px;color:#666">Telefon</td><td style="padding:10px 14px;color:#1b2733">${phone}</td></tr>
          <tr style="background:#e9f1fb"><td style="padding:12px 14px;color:#1b5fb8;font-weight:bold">Zeitraum</td><td style="padding:12px 14px;color:#1b5fb8;font-weight:bold;font-size:16px">${from_d} bis ${to_d}</td></tr>
          <tr><td style="padding:10px 14px;color:#666">Verwendungszweck</td><td style="padding:10px 14px;color:#1b2733">${purpose}</td></tr>
          <tr style="background:#f6f8fb"><td style="padding:10px 14px;color:#666">Nachricht</td><td style="padding:10px 14px;color:#1b2733;font-style:italic">${message}</td></tr>
        </table>
        <div style="margin-top:20px;text-align:center">
          <a href="https://kw.hofreither.at/start.html" style="background:#3b82d6;color:#fff;padding:12px 28px;border-radius:9px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block">In der App öffnen → Anfragen</a>
        </div>
      </div>
      <p style="text-align:center;font-size:11px;color:#9aa6b2;margin-top:16px">Stadtgemeinde St. Valentin · Kühlwagen-Verleih · Automatische Benachrichtigung</p>
    </div>
  `;

  try {
    const users = $app.findAllRecords("users");
    for (const user of users) {
      const userEmail = user.getString("email");
      if (!userEmail) continue;
      $app.newMailClient().send(new MailerMessage({
        from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName || "Kühlwagen-Verleih" },
        to: [{ address: userEmail }],
        subject: "❄ Neue Buchungsanfrage von " + name + " (" + from_d + " – " + to_d + ")",
        html: html
      }));
    }
  } catch (err) {
    console.error("kw_anfragen: Fehler beim E-Mail-Versand:", err);
  }
}, "kw_booking_requests");


// ─── Status-Änderung Anfrage → Kalender spiegeln + Mail an Anfragenden ────────
onRecordAfterUpdateSuccess((e) => {
  const r = e.record;

  // ── Kalender-Rebuild (INLINE) — IMMER, auch bei pending-Datumsänderung ──────
  try {
    let allReqs = [];
    try { allReqs = $app.findAllRecords("kw_booking_requests"); } catch (ee) { allReqs = []; }
    const seen = {};
    const requested = [];
    for (let i = 0; i < allReqs.length; i++) {
      const rr = allReqs[i];
      if (rr.getString("status") !== "pending") continue;
      const f = rr.getString("from_date"), t = rr.getString("to_date");
      if (!f || !t) continue;
      const key = f + "_" + t;
      if (seen[key]) continue;
      seen[key] = true;
      requested.push({ from: f, to: t, type: "requested" });
    }
    let calRec = null;
    try {
      const cals = $app.findRecordsByFilter("kw_calendar", "id != ''", "-updated", 1, 0);
      calRec = (cals && cals.length > 0) ? cals[0] : null;
    } catch (ee) {
      try { const all = $app.findAllRecords("kw_calendar"); calRec = (all && all.length > 0) ? all[0] : null; } catch (e2) { calRec = null; }
    }
    const booked = [];
    if (calRec) {
      let raw = calRec.get("data");
      if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch (ee) { raw = []; } }
      else if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "number") {
        // PocketBase liefert JSON-Felder manchmal als rohes Byte-Array statt als String/Objekt —
        // ohne diese Rekonstruktion würden einzelne Bytes als kaputte "booked"-Einträge landen.
        try {
          let s = "";
          for (let k = 0; k < raw.length; k++) s += String.fromCharCode(raw[k]);
          raw = JSON.parse(s);
        } catch (ee) { raw = []; }
      }
      if (Array.isArray(raw)) { for (let j = 0; j < raw.length; j++) { const it = raw[j]; if (it && typeof it === "object" && (it.type || "booked") === "booked") booked.push(it); } }
    }
    const merged = booked.concat(requested);
    if (calRec) {
      calRec.set("data", merged);
      $app.save(calRec);
    } else {
      const coll = $app.findCollectionByNameOrId("kw_calendar");
      const newRec = new Record(coll);
      newRec.set("data", merged);
      $app.save(newRec);
    }
  } catch (err) {
    try { $app.logger().error("kw_calendar rebuild (update): " + String(err)); } catch (ignore) {}
  }

  // ── Status-Mail nur bei approved/rejected ──────────────────────────────────
  const status = r.getString("status");
  if (status !== "approved" && status !== "rejected") return;

  const name    = r.getString("name");
  const email   = r.getString("email");
  const from_d  = r.getString("from_date");
  const to_d    = r.getString("to_date");
  const note    = r.getString("rejection_note") || "";

  let subject, bodyHtml;

  if (status === "approved") {
    subject = "✓ Ihre Buchungsanfrage wurde bestätigt – Kühlwagen-Verleih St. Valentin";
    bodyHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f4f7fb;padding:20px">
        <div style="background:#142029;border-radius:12px 12px 0 0;padding:20px 24px">
          <div style="color:#fff;font-size:18px;font-weight:bold">Stadtgemeinde St. Valentin</div>
          <div style="color:#7d8a97;font-size:13px;margin-top:2px">Kühlwagen-Verleih</div>
        </div>
        <div style="background:#1d6e48;padding:20px 24px;text-align:center">
          <div style="font-size:32px">✓</div>
          <div style="color:#fff;font-size:20px;font-weight:bold;margin-top:8px">Anfrage genehmigt!</div>
        </div>
        <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e6eaef;border-top:none">
          <p style="font-size:15px;color:#1b2733">Sehr geehrte/r <strong>${name}</strong>,</p>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">wir freuen uns, Ihnen mitteilen zu können, dass Ihre Buchungsanfrage <strong>genehmigt</strong> wurde!</p>
          <div style="background:#e7f5ee;border:1px solid #b8dfcb;border-radius:10px;padding:16px 20px;margin:20px 0;text-align:center">
            <div style="font-size:12px;color:#1d6e48;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Gebuchter Zeitraum</div>
            <div style="font-size:22px;font-weight:bold;color:#142029">${from_d} – ${to_d}</div>
            <div style="font-size:13px;color:#1d6e48;margin-top:6px">Kühlkoffer FK300/16 T 2700</div>
          </div>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">Wir werden uns in Kürze mit Ihnen in Verbindung setzen, um alle Details zu besprechen.</p>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">Bei Fragen erreichen Sie uns unter:<br>
            📞 <a href="tel:+437435505" style="color:#3b82d6">+43 7435 505-0</a><br>
            ✉ <a href="mailto:rathaus@st-valentin.at" style="color:#3b82d6">rathaus@st-valentin.at</a>
          </p>
          <p style="font-size:14px;color:#3a4854;margin-top:20px">Mit freundlichen Grüßen<br><strong>Stadtgemeinde St. Valentin</strong><br><span style="color:#8a96a3;font-size:13px">Kühlwagen-Verleih</span></p>
        </div>
        <p style="text-align:center;font-size:11px;color:#9aa6b2;margin-top:16px">Stadtgemeinde St. Valentin · Hauptplatz 7 · 4300 St. Valentin</p>
      </div>
    `;
  } else {
    subject = "Ihre Buchungsanfrage – Kühlwagen-Verleih St. Valentin";
    const noteSection = note ? `<div style="background:#fff7f0;border:1px solid #f5c49a;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:13.5px;color:#5a3a1a"><strong>Begründung:</strong> ${note}</div>` : '';
    bodyHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f4f7fb;padding:20px">
        <div style="background:#142029;border-radius:12px 12px 0 0;padding:20px 24px">
          <div style="color:#fff;font-size:18px;font-weight:bold">Stadtgemeinde St. Valentin</div>
          <div style="color:#7d8a97;font-size:13px;margin-top:2px">Kühlwagen-Verleih</div>
        </div>
        <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e6eaef;border-top:none">
          <p style="font-size:15px;color:#1b2733">Sehr geehrte/r <strong>${name}</strong>,</p>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">leider müssen wir Ihnen mitteilen, dass Ihre Buchungsanfrage für den Zeitraum <strong>${from_d} – ${to_d}</strong> nicht berücksichtigt werden kann.</p>
          ${noteSection}
          <p style="font-size:14px;color:#3a4854;line-height:1.7">Wir bitten um Ihr Verständnis. Für alternative Termine oder Fragen stehen wir Ihnen gerne zur Verfügung.</p>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">
            📞 <a href="tel:+437435505" style="color:#3b82d6">+43 7435 505-0</a><br>
            ✉ <a href="mailto:rathaus@st-valentin.at" style="color:#3b82d6">rathaus@st-valentin.at</a>
          </p>
          <p style="font-size:14px;color:#3a4854;margin-top:20px">Mit freundlichen Grüßen<br><strong>Stadtgemeinde St. Valentin</strong><br><span style="color:#8a96a3;font-size:13px">Kühlwagen-Verleih</span></p>
        </div>
        <p style="text-align:center;font-size:11px;color:#9aa6b2;margin-top:16px">Stadtgemeinde St. Valentin · Hauptplatz 7 · 4300 St. Valentin</p>
      </div>
    `;
  }

  try {
    $app.newMailClient().send(new MailerMessage({
      from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName || "Kühlwagen-Verleih St. Valentin" },
      to: [{ address: email }],
      subject: subject,
      html: bodyHtml
    }));
  } catch (err) {
    console.error("kw_anfragen: Fehler beim Status-Mail:", err);
  }
}, "kw_booking_requests");


// ─── Buchung bestätigt → Bestätigungsmail an Kunden ─────────────────────────
// Wird ausgelöst wenn in der Verwaltungs-App der Status auf "bestätigt" gesetzt wird
onRecordAfterUpdateSuccess((e) => {
  const r = e.record;
  // Nur kw_state Records verarbeiten
  if (!r.getString("data")) return;

  let data;
  try { data = JSON.parse(r.getString("data")); } catch(ex) { return; }
  if (!data || !data.bookings) return;

  // Bestätigte Buchungen mit E-Mail finden
  const confirmed = data.bookings.filter(b =>
    b.status === "bestätigt" && b.email && b._mailSent !== true
  );

  let sentCount = 0;

  for (const b of confirmed) {
    const htmlMail = `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#f4f7fb;padding:20px">
        <div style="background:#142029;border-radius:12px 12px 0 0;padding:20px 24px">
          <div style="color:#fff;font-size:18px;font-weight:bold">Stadtgemeinde St. Valentin</div>
          <div style="color:#7d8a97;font-size:13px;margin-top:2px">Kühlwagen-Verleih</div>
        </div>
        <div style="background:#3b82d6;padding:20px 24px;text-align:center">
          <div style="color:#fff;font-size:20px;font-weight:bold">Buchungsbestätigung</div>
          <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px">${b.id || ''}</div>
        </div>
        <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e6eaef;border-top:none">
          <p style="font-size:15px;color:#1b2733">Sehr geehrte/r <strong>${b.kunde || ''}</strong>,</p>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">hiermit bestätigen wir Ihre Buchung des Kühlwagens:</p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0">
            <tr style="background:#f6f8fb"><td style="padding:11px 14px;color:#666;width:140px;border-bottom:1px solid #eef1f5">Fahrzeug</td><td style="padding:11px 14px;font-weight:600;color:#142029;border-bottom:1px solid #eef1f5">Kühlkoffer FK300/16 T 2700</td></tr>
            <tr><td style="padding:11px 14px;color:#666;border-bottom:1px solid #eef1f5">Zeitraum</td><td style="padding:11px 14px;font-weight:bold;color:#1b5fb8;border-bottom:1px solid #eef1f5">${b.von || ''} – ${b.bis || ''}</td></tr>
            <tr style="background:#f6f8fb"><td style="padding:11px 14px;color:#666;border-bottom:1px solid #eef1f5">Anlass</td><td style="padding:11px 14px;color:#1b2733;border-bottom:1px solid #eef1f5">${b.grund || '—'}</td></tr>
            ${b.preis ? `<tr><td style="padding:11px 14px;color:#666;border-bottom:1px solid #eef1f5">Mietbetrag</td><td style="padding:11px 14px;font-weight:600;color:#142029;border-bottom:1px solid #eef1f5">€ ${b.preis.toLocaleString('de-AT')}</td></tr>` : ''}
            ${b.kaution ? `<tr style="background:#f6f8fb"><td style="padding:11px 14px;color:#666">Kaution</td><td style="padding:11px 14px;color:#1b2733">€ ${b.kaution.toLocaleString('de-AT')} (wird bei Rückgabe erstattet)</td></tr>` : ''}
          </table>

          ${b.notiz ? `<div style="background:#f6f8fb;border-radius:9px;padding:13px 16px;margin-bottom:20px;font-size:13px;color:#5a6675;line-height:1.6"><strong>Hinweis:</strong> ${b.notiz}</div>` : ''}

          <p style="font-size:14px;color:#3a4854;line-height:1.7">Wir freuen uns auf eine erfolgreiche Zusammenarbeit. Bei Fragen stehen wir Ihnen gerne zur Verfügung:</p>
          <p style="font-size:14px;color:#3a4854;line-height:1.8">
            📞 <a href="tel:+437435505" style="color:#3b82d6">+43 7435 505-0</a><br>
            ✉ <a href="mailto:rathaus@st-valentin.at" style="color:#3b82d6">rathaus@st-valentin.at</a><br>
            📍 Hauptplatz 7, 4300 St. Valentin
          </p>
          <p style="font-size:14px;color:#3a4854;margin-top:24px;padding-top:20px;border-top:1px solid #eef1f5">Mit freundlichen Grüßen<br><strong>Stadtgemeinde St. Valentin</strong><br><span style="color:#8a96a3;font-size:13px">Kühlwagen-Verleih</span></p>
        </div>
        <p style="text-align:center;font-size:11px;color:#9aa6b2;margin-top:16px">Stadtgemeinde St. Valentin · Hauptplatz 7 · 4300 St. Valentin<br>Diese E-Mail wurde automatisch generiert.</p>
      </div>
    `;

    try {
      $app.newMailClient().send(new MailerMessage({
        from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName || "Kühlwagen-Verleih St. Valentin" },
        to: [{ address: b.email }],
        subject: "Buchungsbestätigung " + (b.id || '') + " – Kühlwagen-Verleih St. Valentin",
        html: htmlMail
      }));
      b._mailSent = true;   // Regression-Schutz: nicht erneut senden
      sentCount++;
    } catch (err) {
      console.error("kw_buchung: Fehler beim Mail-Versand:", err);
    }
  }

  // _mailSent zurück in kw_state persistieren (nur wenn versendet) → kein Loop
  if (sentCount > 0) {
    try { r.set("data", data); $app.save(r); } catch (err) { console.error("kw_buchung: _mailSent persist Fehler:", err); }
  }
}, "kw_state");


// ─── Erinnerungs-Mails (täglich ~08:00 Wien) ─────────────────────────────────
// "Abholung morgen" an Kunden mit Status bestätigt, von == morgen
// "Rückgabe heute"  an Kunden mit Status bestätigt/laufend, bis == heute
// Kein State-Write nötig: Datums-exakter Match → jede Mail wird genau 1x gesendet.
// Cron läuft in Server-Zeit (UTC im Container) → 6:00 UTC = 08:00 CEST / 07:00 CET.
cronAdd("kwReminders", "0 6 * * *", () => {
  try {
    // Lokales Datum Europe/Vienna (DST: letzter So. März bis letzter So. Okt. = UTC+2, sonst UTC+1)
    const nowUtc = Date.now();
    const yy = new Date(nowUtc).getUTCFullYear();
    function lastSundayUtc(year, monthIdx) {
      const last = new Date(Date.UTC(year, monthIdx + 1, 0));
      return Date.UTC(year, monthIdx + 1, 0 - last.getUTCDay(), 1, 0, 0);
    }
    const offset = (nowUtc >= lastSundayUtc(yy, 2) && nowUtc < lastSundayUtc(yy, 9)) ? 2 : 1;
    function isoLocal(msUtc) {
      const d = new Date(msUtc + offset * 3600000);
      const pad = function (n) { return String(n).padStart(2, "0"); };
      return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
    }
    const todayIso = isoLocal(nowUtc);
    const tomorrowIso = isoLocal(nowUtc + 86400000);
    function fmtDe(s) { const p = String(s || "").split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : String(s || ""); }

    // kw_state laden (Record mit Daten)
    let bookings = [];
    try {
      const all = $app.findAllRecords("kw_state");
      for (let i = 0; i < all.length; i++) {
        let raw = all[i].getString("data");
        if (!raw) continue;
        let data; try { data = JSON.parse(raw); } catch (ee) { continue; }
        if (data && Array.isArray(data.bookings) && data.bookings.length > 0) { bookings = data.bookings; break; }
      }
    } catch (ee) { bookings = []; }
    if (!bookings.length) return;

    function buildMail(b, kind) {
      const isPickup = kind === "abholung";
      const title = isPickup ? "Erinnerung: Abholung morgen" : "Erinnerung: Rückgabe heute";
      const lead = isPickup
        ? "wir möchten Sie daran erinnern, dass die Abholung des Kühlwagens <strong>morgen, " + fmtDe(b.von) + "</strong>, ansteht."
        : "wir möchten Sie daran erinnern, dass die Rückgabe des Kühlwagens <strong>heute, " + fmtDe(b.bis) + "</strong>, vereinbart ist.";
      const extra = isPickup
        ? "<p style=\"font-size:14px;color:#3a4854;line-height:1.7\">Bitte bringen Sie zur Übergabe einen Lichtbildausweis mit." + (b.kaution ? " Die Kaution von <strong>€ " + Number(b.kaution).toLocaleString("de-AT") + "</strong> ist bei der Übergabe zu hinterlegen." : "") + "</p>"
        : "<p style=\"font-size:14px;color:#3a4854;line-height:1.7\">Bitte geben Sie den Kühlwagen gereinigt und im übernommenen Zustand zurück." + (b.kaution ? " Ihre Kaution von <strong>€ " + Number(b.kaution).toLocaleString("de-AT") + "</strong> wird nach der Rücknahme erstattet." : "") + "</p>";
      return "" +
        "<div style=\"font-family:sans-serif;max-width:560px;margin:0 auto;background:#f4f7fb;padding:20px\">" +
          "<div style=\"background:#142029;border-radius:12px 12px 0 0;padding:20px 24px\">" +
            "<div style=\"color:#fff;font-size:18px;font-weight:bold\">Stadtgemeinde St. Valentin</div>" +
            "<div style=\"color:#7d8a97;font-size:13px;margin-top:2px\">Kühlwagen-Verleih</div>" +
          "</div>" +
          "<div style=\"background:" + (isPickup ? "#3b82d6" : "#1d6e48") + ";padding:18px 24px;text-align:center\">" +
            "<div style=\"color:#fff;font-size:20px;font-weight:bold\">" + title + "</div>" +
            "<div style=\"color:rgba(255,255,255,.8);font-size:13px;margin-top:4px\">" + (b.id || "") + "</div>" +
          "</div>" +
          "<div style=\"background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e6eaef;border-top:none\">" +
            "<p style=\"font-size:15px;color:#1b2733\">Sehr geehrte/r <strong>" + (b.kunde || "") + "</strong>,</p>" +
            "<p style=\"font-size:14px;color:#3a4854;line-height:1.7\">" + lead + "</p>" +
            "<div style=\"background:#f6f8fb;border:1px solid #e6eaef;border-radius:10px;padding:16px 20px;margin:18px 0;text-align:center\">" +
              "<div style=\"font-size:12px;color:#8a96a3;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px\">Gebuchter Zeitraum</div>" +
              "<div style=\"font-size:20px;font-weight:bold;color:#142029\">" + fmtDe(b.von) + " – " + fmtDe(b.bis) + "</div>" +
              "<div style=\"font-size:13px;color:#5a6675;margin-top:6px\">Kühlkoffer FK300/16 T 2700 · " + (b.grund || "") + "</div>" +
            "</div>" +
            extra +
            "<p style=\"font-size:14px;color:#3a4854;line-height:1.8\">Bei Fragen erreichen Sie uns unter:<br>" +
              "📞 <a href=\"tel:+437435505\" style=\"color:#3b82d6\">+43 7435 505-0</a><br>" +
              "✉ <a href=\"mailto:rathaus@st-valentin.at\" style=\"color:#3b82d6\">rathaus@st-valentin.at</a><br>" +
              "📍 Hauptplatz 7, 4300 St. Valentin</p>" +
            "<p style=\"font-size:14px;color:#3a4854;margin-top:20px\">Mit freundlichen Grüßen<br><strong>Stadtgemeinde St. Valentin</strong><br><span style=\"color:#8a96a3;font-size:13px\">Kühlwagen-Verleih</span></p>" +
          "</div>" +
          "<p style=\"text-align:center;font-size:11px;color:#9aa6b2;margin-top:16px\">Stadtgemeinde St. Valentin · Hauptplatz 7 · 4300 St. Valentin<br>Diese E-Mail wurde automatisch generiert.</p>" +
        "</div>";
    }

    let sent = 0;
    for (let i = 0; i < bookings.length; i++) {
      const b = bookings[i];
      if (!b || !b.email) continue;
      let kind = null;
      if (b.status === "bestätigt" && b.von === tomorrowIso) kind = "abholung";
      else if ((b.status === "bestätigt" || b.status === "laufend") && b.bis === todayIso) kind = "rueckgabe";
      if (!kind) continue;
      try {
        $app.newMailClient().send(new MailerMessage({
          from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName || "Kühlwagen-Verleih St. Valentin" },
          to: [{ address: b.email }],
          subject: (kind === "abholung"
            ? "Erinnerung: Abholung des Kühlwagens morgen (" + fmtDe(b.von) + ")"
            : "Erinnerung: Rückgabe des Kühlwagens heute (" + fmtDe(b.bis) + ")") + " – " + (b.id || ""),
          html: buildMail(b, kind)
        }));
        sent++;
      } catch (err) {
        try { $app.logger().error("kwReminders Mail-Fehler (" + (b.id || "?") + "): " + String(err)); } catch (ignore) {}
      }
    }
    try { $app.logger().info("kwReminders: " + sent + " Erinnerung(en) gesendet (" + todayIso + ")"); } catch (ignore) {}
  } catch (err) {
    try { $app.logger().error("kwReminders: " + String(err)); } catch (ignore) {}
  }
});
