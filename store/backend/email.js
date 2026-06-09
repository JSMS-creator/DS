import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

export async function sendOrderConfirmation({ to, name, product, quantity, total }) {
  await transporter.sendMail({
    from: `"${process.env.STORE_NAME}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: `Ordrebekreftelse — ${process.env.STORE_NAME}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
        <h2 style="color:#111">Takk for bestillingen, ${name}! 🎉</h2>
        <p>Vi har mottatt betalingen din og sender ordren til deg snart.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><b>Produkt</b></td><td style="text-align:right">${product} × ${quantity}</td></tr>
          <tr><td style="padding:8px 0"><b>Totalt betalt</b></td><td style="text-align:right"><b>NOK ${total.toFixed(2)}</b></td></tr>
        </table>
        <p style="color:#666;font-size:14px">Du vil motta en e-post med sporingsinformasjon så snart pakken er sendt.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#999;font-size:12px">${process.env.STORE_NAME} — ${process.env.STORE_URL}</p>
      </div>
    `
  });
}

export async function sendTrackingEmail({ to, name, tracking, trackingUrl }) {
  await transporter.sendMail({
    from: `"${process.env.STORE_NAME}" <${process.env.FROM_EMAIL}>`,
    to,
    subject: `Pakken din er på vei! — ${process.env.STORE_NAME}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px">
        <h2 style="color:#111">Pakken din er sendt, ${name}! 📦</h2>
        <p>Sporingsnummer: <b>${tracking}</b></p>
        ${trackingUrl ? `<a href="${trackingUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Spor pakken din</a>` : ''}
        <p style="color:#666;font-size:14px">Forventet leveringstid: 3–7 virkedager.</p>
      </div>
    `
  });
}
