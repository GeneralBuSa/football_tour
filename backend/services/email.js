const RESEND_API_URL = 'https://api.resend.com/emails';

export function isEmailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.PASSWORD_RESET_BASE_URL);
}

export async function sendPasswordResetEmail({ to, username, resetToken }) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'Email provider is not configured' };
  }

  const resetUrl = `${process.env.PASSWORD_RESET_BASE_URL.replace(/\/$/, '')}/auth?resetToken=${encodeURIComponent(resetToken)}`;
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to,
      subject: 'FT26 sifre sifirlama',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
          <h2>FT26 sifre sifirlama</h2>
          <p>Merhaba ${username},</p>
          <p>Sifrenizi sifirlamak icin asagidaki baglantiyi acin. Bu baglanti 15 dakika gecerlidir.</p>
          <p><a href="${resetUrl}" style="display:inline-block;background:#0284c7;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Sifremi sifirla</a></p>
          <p>Bu istegi siz yapmadiysaniz bu e-postayi yok sayabilirsiniz.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Email provider error');
    throw new Error(message);
  }

  return { sent: true };
}
