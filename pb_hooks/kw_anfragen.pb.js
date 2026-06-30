// PocketBase JS Hooks — Kühlwagen Buchungsanfragen
// Datei kopieren nach: /pb/pb_hooks/kw_anfragen.pb.js
// Dann Container neu starten: docker restart <container-id>
//
// Voraussetzung: SMTP in PocketBase Admin → Settings → Mail konfigurieren
// Empfehlung: Brevo (brevo.com) — kostenlos, 300 Mails/Tag, kein Server nötig

// ─── Neue Anfrage → Mail an alle Benutzer ───────────────────────────────────
onRecordAfterCreateSuccess((e) => {
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
      <div style="background:#142029;border-radius:12px 12px 0 0;padding:20px 24px;display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">❄</span>
        <div style="color:#fff;font-size:18px;font-weight:bold">Neue Buchungsanfrage</div>
      </div>
      <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;border:1px solid #e6eaef;border-top:none">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f6f8fb"><td style="padding:10px 14px;color:#666;width:140px">Name</td><td style="padding:10px 14px;font-weight:bold;color:#142029">${name}</td></tr>
          <tr><td style="padding:10px 14px;color:#666">Firma</td><td style="padding:10px 14px;color:#1b2733">${company}</td></tr>
          <tr style="background:#f6f8fb"><td style="padding:10px 14px;color:#666">E-Mail</td><td style="padding:10px 14px"><a href="mailto:${email}" style="color:#3b82d6">${email}</a></td></tr>
          <tr><td style="padding:10px 14px;color:#666">Telefon</td><td style="padding:10px 14px;color:#1b2733">${phone}</td></tr>
          <tr style="background:#e9f1fb"><td style="padding:12px 14px;color:#1b5fb8;font-weight:bold">Zeitraum</td><td style="padding:12px 14px;color:#1b5fb8;font-weight:bold;font-size:16px">${from_d} bis ${to_d}</td></tr>
          <tr><td style="padding:10px 14px;color:#666">Verwendungszweck</td><td style="padding:10px 14px;color:#1b2733">${purpose}</td></tr>
          <tr style="background:#f6f8fb"><td style="padding:10px 14px;color:#666">Nachricht</td><td style="padding:10px 14px;color:#1b2733;font-style:italic">${message}</td></tr>
        </table>
        <div style="margin-top:20px;text-align:center">
          <a href="https://kw.hofreither.at" style="background:#3b82d6;color:#fff;padding:12px 28px;border-radius:9px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block">In der App öffnen → Anfragen</a>
        </div>
      </div>
      <p style="text-align:center;font-size:11px;color:#9aa6b2;margin-top:16px">Kühlwagen-Verleih · Automatische Benachrichtigung</p>
    </div>
  `;

  // Alle Benutzer benachrichtigen
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


// ─── Status-Änderung → Mail an Anfragenden ───────────────────────────────────
onRecordAfterUpdateSuccess((e) => {
  const r      = e.record;
  const status = r.getString("status");
  if (status !== "approved" && status !== "rejected") return;

  const name    = r.getString("name");
  const email   = r.getString("email");
  const from_d  = r.getString("from_date");
  const to_d    = r.getString("to_date");
  const note    = r.getString("rejection_note") || "";

  let subject, bodyHtml;

  if (status === "approved") {
    subject = "✓ Ihre Buchungsanfrage wurde bestätigt";
    bodyHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f4f7fb;padding:20px">
        <div style="background:#1d6e48;border-radius:12px 12px 0 0;padding:20px 24px;text-align:center">
          <span style="font-size:36px">✓</span>
          <div style="color:#fff;font-size:20px;font-weight:bold;margin-top:8px">Anfrage bestätigt!</div>
        </div>
        <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e6eaef;border-top:none">
          <p style="font-size:15px;color:#1b2733">Liebe/r <strong>${name}</strong>,</p>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">wir freuen uns, Ihnen mitteilen zu können, dass Ihre Buchungsanfrage <strong>genehmigt</strong> wurde!</p>
          <div style="background:#e7f5ee;border-radius:10px;padding:16px 20px;margin:20px 0;text-align:center">
            <div style="font-size:12px;color:#1d6e48;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Gebuchter Zeitraum</div>
            <div style="font-size:20px;font-weight:bold;color:#142029">${from_d} – ${to_d}</div>
          </div>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">Wir werden uns in Kürze mit Ihnen in Verbindung setzen, um alle Details zu besprechen.</p>
          <p style="font-size:14px;color:#3a4854;margin-top:20px">Mit freundlichen Grüßen<br><strong>Ihr Kühlwagen-Verleih Team</strong></p>
        </div>
      </div>
    `;
  } else {
    subject = "Ihre Buchungsanfrage konnte leider nicht berücksichtigt werden";
    const noteSection = note ? `<div style="background:#fff7f0;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:13.5px;color:#5a3a1a"><strong>Begründung:</strong> ${note}</div>` : '';
    bodyHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f4f7fb;padding:20px">
        <div style="background:#142029;border-radius:12px 12px 0 0;padding:20px 24px;text-align:center">
          <span style="font-size:28px">❄</span>
          <div style="color:#fff;font-size:18px;font-weight:bold;margin-top:8px">Kühlwagen-Verleih</div>
        </div>
        <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e6eaef;border-top:none">
          <p style="font-size:15px;color:#1b2733">Liebe/r <strong>${name}</strong>,</p>
          <p style="font-size:14px;color:#3a4854;line-height:1.7">leider müssen wir Ihnen mitteilen, dass Ihre Buchungsanfrage für den Zeitraum <strong>${from_d} – ${to_d}</strong> nicht berücksichtigt werden kann.</p>
          ${noteSection}
          <p style="font-size:14px;color:#3a4854;line-height:1.7">Wir bitten um Ihr Verständnis. Für alternative Termine oder Fragen stehen wir Ihnen gerne zur Verfügung.</p>
          <p style="font-size:14px;color:#3a4854;margin-top:20px">Mit freundlichen Grüßen<br><strong>Ihr Kühlwagen-Verleih Team</strong></p>
        </div>
      </div>
    `;
  }

  try {
    $app.newMailClient().send(new MailerMessage({
      from: { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName || "Kühlwagen-Verleih" },
      to: [{ address: email }],
      subject: subject,
      html: bodyHtml
    }));
  } catch (err) {
    console.error("kw_anfragen: Fehler beim Status-Mail:", err);
  }
}, "kw_booking_requests");
