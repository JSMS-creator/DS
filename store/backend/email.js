// Email via Resend API — uses plain fetch (Node 18+ built-in)
// Falls back to a warning log if RESEND_API_KEY is not set

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to);
    return;
  }
  const from = process.env.FROM_EMAIL
    ? `"${process.env.STORE_NAME || 'Store'}" <${process.env.FROM_EMAIL}>`
    : `"${process.env.STORE_NAME || 'Store'}" <noreply@resend.dev>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[email] Resend error:', res.status, err);
  }
}

export async function sendOrderConfirmation({ to, name, product, quantity, total }) {
  const storeName = process.env.STORE_NAME || 'Store';
  const storeUrl = process.env.STORE_URL || '';

  const html = `<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#111111;padding:32px 40px;text-align:center">
            <h1 style="color:#ffffff;margin:0;font-size:1.6rem;font-weight:800;letter-spacing:-0.5px">${storeName}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px">
            <h2 style="color:#111111;margin:0 0 8px;font-size:1.3rem">Takk for bestillingen, ${name}! 🎉</h2>
            <p style="color:#555555;font-size:0.95rem;line-height:1.6;margin:0 0 32px">
              Vi har mottatt betalingen din og begynner å behandle ordren din med en gang. Du vil motta en ny e-post med sporingsinformasjon så snart pakken er sendt.
            </p>

            <!-- Order summary -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #eeeeee;border-radius:10px;overflow:hidden;margin-bottom:32px">
              <tr style="background:#f8f8f8">
                <td style="padding:12px 16px;font-size:0.75rem;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px">Produkt</td>
                <td style="padding:12px 16px;font-size:0.75rem;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;text-align:right">Antall</td>
                <td style="padding:12px 16px;font-size:0.75rem;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;text-align:right">Beløp</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;font-size:0.9rem;color:#111111;border-top:1px solid #eeeeee">${product}</td>
                <td style="padding:14px 16px;font-size:0.9rem;color:#111111;border-top:1px solid #eeeeee;text-align:right">${quantity}</td>
                <td style="padding:14px 16px;font-size:0.9rem;color:#111111;border-top:1px solid #eeeeee;text-align:right">—</td>
              </tr>
              <tr style="background:#f8f8f8">
                <td colspan="2" style="padding:14px 16px;font-size:0.9rem;font-weight:700;color:#111111;border-top:1px solid #eeeeee">Totalt betalt (inkl. MVA)</td>
                <td style="padding:14px 16px;font-size:1rem;font-weight:800;color:#111111;border-top:1px solid #eeeeee;text-align:right">NOK ${typeof total === 'number' ? total.toFixed(2) : total}</td>
              </tr>
            </table>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;margin-bottom:32px">
              <tr>
                <td style="padding:16px 20px">
                  <p style="margin:0;font-size:0.88rem;color:#166534;line-height:1.6">
                    ✅ <strong>Hva skjer nå?</strong> Ordren din sendes vanligvis innen 1–3 virkedager. Forventet leveringstid er 7–14 virkedager til Norge. Vi sender sporingsnummer så snart pakken er på vei!
                  </p>
                </td>
              </tr>
            </table>

            <p style="color:#888888;font-size:0.82rem;margin:0">Har du spørsmål? Svar på denne e-posten eller kontakt oss på <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || ''}" style="color:#111111">${process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || storeName}</a>.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#111111;padding:20px 40px;text-align:center">
            <p style="color:#888888;font-size:0.78rem;margin:0">${storeName}${storeUrl ? ' — ' + storeUrl : ''}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to,
    subject: `Ordrebekreftelse — ${storeName}`,
    html
  });
}

export async function sendTrackingEmail({ to, name, tracking, trackingUrl }) {
  const storeName = process.env.STORE_NAME || 'Store';
  const storeUrl = process.env.STORE_URL || '';

  const html = `<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#111111;padding:32px 40px;text-align:center">
            <h1 style="color:#ffffff;margin:0;font-size:1.6rem;font-weight:800;letter-spacing:-0.5px">${storeName}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px">
            <h2 style="color:#111111;margin:0 0 8px;font-size:1.3rem">Pakken din er på vei, ${name}! 📦</h2>
            <p style="color:#555555;font-size:0.95rem;line-height:1.6;margin:0 0 32px">
              Gode nyheter — ordren din er nå sendt! Du kan spore pakken din med informasjonen nedenfor.
            </p>

            <!-- Tracking box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #eeeeee;border-radius:10px;overflow:hidden;margin-bottom:32px">
              <tr style="background:#f8f8f8">
                <td style="padding:12px 16px;font-size:0.75rem;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px">Sporingsnummer</td>
              </tr>
              <tr>
                <td style="padding:16px;font-size:1.1rem;font-weight:800;color:#111111;border-top:1px solid #eeeeee;letter-spacing:1px">${tracking}</td>
              </tr>
            </table>

            ${trackingUrl ? `
            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
              <tr><td align="center">
                <a href="${trackingUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:0.95rem">
                  Spor pakken din →
                </a>
              </td></tr>
            </table>` : ''}

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:10px;margin-bottom:32px">
              <tr>
                <td style="padding:16px 20px">
                  <p style="margin:0;font-size:0.88rem;color:#1e40af;line-height:1.6">
                    🚚 <strong>Forventet leveringstid:</strong> 7–14 virkedager til Norge. Sporingsinformasjon oppdateres vanligvis innen 24–48 timer etter sending.
                  </p>
                </td>
              </tr>
            </table>

            <p style="color:#888888;font-size:0.82rem;margin:0">Har du spørsmål? Svar på denne e-posten eller kontakt oss på <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || ''}" style="color:#111111">${process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || storeName}</a>.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#111111;padding:20px 40px;text-align:center">
            <p style="color:#888888;font-size:0.78rem;margin:0">${storeName}${storeUrl ? ' — ' + storeUrl : ''}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to,
    subject: `Pakken din er sendt! — ${storeName}`,
    html
  });
}
