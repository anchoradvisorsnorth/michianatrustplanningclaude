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
                Here's your checklist — 7 steps covering everything an Indiana family needs for a complete, properly funded trust plan.
              </p>
              <p style="font-size:15px;line-height:1.7;color:#4a5568;margin:0 0 28px">
                Go through it with a pen. Every unchecked box is a gap in your plan — and most families find at least a few.
              </p>
              <a href="${CHECKLIST_URL}"
                 style="display:inline-block;background:#b07d2e;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none">
                Download Your Checklist →
              </a>
              <div style="background:#faf8f4;border-left:3px solid #b07d2e;padding:20px 24px;margin:32px 0 0;border-radius:0 6px 6px 0">
                <p style="font-size:15px;font-weight:600;color:#1c2b3a;margin:0 0 8px">Found some gaps?</p>
                <p style="font-size:14px;line-height:1.7;color:#4a5568;margin:0 0 14px">
                  The checklist shows you <em>what</em> to fix. The <strong>Indiana Trust Planning Workbook</strong> walks you through <em>how</em> — naming trustees, structuring distributions, funding every asset correctly. It picks up right where the checklist leaves off.
                </p>
                <a href="https://www.michianatrustplanning.com#step-workbook"
                   style="color:#b07d2e;font-weight:600;font-size:14px;text-decoration:none">See what's in the Workbook →</a>
              </div>
            </div>
            <div style="background:#f5f1ea;padding:16px 32px;text-align:center">
              <p style="margin:0;font-size:11px;color:#9aa5b1">
                © 2026 Michiana Trust Planning · Northern Indiana<br>
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
