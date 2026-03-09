export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

  const MAILERLITE_TOKEN = process.env.MAILERLITE_API_TOKEN;
  const RESEND_KEY       = process.env.MTP_RESEND_API_KEY;
  const GROUP_ID         = '181416920771200399';
  const CHECKLIST_URL    = 'https://www.michianatrustplanning.com/indiana-trust-checklist.pdf';

  try {
    // 1 — Add subscriber to MailerLite group
    await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${MAILERLITE_TOKEN}`
      },
      body: JSON.stringify({ email, groups: [GROUP_ID] })
    });

    // 2 — Send checklist via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: 'Michiana Trust Planning <info@michianatrustplanning.com>',
        to: email,
        subject: 'Your Indiana Trust Readiness Checklist',
        html: `
          <div style="font-family:'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;color:#253040">
            <div style="background:#1c2b3a;padding:28px 32px 20px;border-bottom:3px solid #b07d2e">
              <p style="margin:0;font-size:11px;letter-spacing:2px;color:#c99540;font-weight:600;text-transform:uppercase">Michiana Trust Planning</p>
            </div>
            <div style="padding:36px 32px">
              <h1 style="font-size:22px;color:#1c2b3a;margin:0 0 16px;font-weight:600">Your Indiana Trust Readiness Checklist</h1>
              <p style="font-size:15px;line-height:1.7;color:#4a5568;margin:0 0 20px">
                Here's your step-by-step checklist covering everything an Indiana family needs for a complete, properly funded revocable living trust plan.
              </p>
              <p style="font-size:15px;line-height:1.7;color:#4a5568;margin:0 0 28px">
                Use it to audit your current plan — or to know exactly what you need to build one from scratch. Any unchecked box is a gap worth closing.
              </p>
              <a href="${CHECKLIST_URL}"
                 style="display:inline-block;background:#b07d2e;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none">
                Download Your Checklist →
              </a>
              <hr style="border:none;border-top:1px solid #e8e3d8;margin:36px 0 24px">
              <p style="font-size:13px;color:#6b7787;line-height:1.7;margin:0 0 8px">
                When you're ready to move forward, the Indiana Revocable Living Trust Workbook ($29.99) walks you through every decision your plan requires. Or go straight to the Complete Document Bundle and have all 7 attorney-reviewed documents in minutes.
              </p>
              <p style="font-size:13px;margin:0">
                <a href="https://www.michianatrustplanning.com" style="color:#b07d2e;font-weight:600">michianatrustplanning.com</a>
              </p>
            </div>
            <div style="background:#f5f1ea;padding:16px 32px;text-align:center">
              <p style="margin:0;font-size:11px;color:#9aa5b1">
                © 2026 Michiana Trust Planning · Keith Plummer, J.D. · Northern Indiana<br>
                <a href="https://www.michianatrustplanning.com" style="color:#9aa5b1">michianatrustplanning.com</a>
              </p>
            </div>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      // Still return success — subscriber was added to MailerLite
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
