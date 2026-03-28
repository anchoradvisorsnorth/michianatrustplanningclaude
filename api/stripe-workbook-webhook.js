import { createHmac } from 'crypto';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parts = Object.fromEntries(
    sigHeader.split(',').map(p => { const [k, v] = p.split('='); return [k, v]; })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  return expected === signature;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_KEY       = process.env.MTP_RESEND_API_KEY;
  const WEBHOOK_SECRET   = process.env.STRIPE_WEBHOOK_SECRET;
  const SITE             = 'https://www.michianatrustplanning.com';
  const WORKBOOK_BASE_IN = `${SITE}/dl/wkb-9f3a7c2e`;
  const WORKBOOK_BASE_MI = `${SITE}/Workbooks/michigan`;

  const rawBody = await readRawBody(req);
  const sigHeader = req.headers['stripe-signature'];

  if (!sigHeader || !verifyStripeSignature(rawBody.toString(), sigHeader, WEBHOOK_SECRET)) {
    console.error('Stripe signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody.toString());

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const email = event.data.object.customer_details?.email;
  if (!email) {
    console.error('No customer email in checkout session');
    return res.status(200).json({ received: true, warning: 'no email' });
  }

  // Detect state from checkout metadata or product name
  const metadata = event.data.object.metadata || {};
  const st = (metadata.state || 'in').toLowerCase();
  const isIN = st === 'in';
  const stateName = isIN ? 'Indiana' : 'Michigan';
  const region = isIN ? 'Northern Indiana' : 'Southwest Michigan';
  const WORKBOOK_BASE = isIN ? WORKBOOK_BASE_IN : WORKBOOK_BASE_MI;
  const fillableFile = isIN ? 'mtp-workbook-fillable-v2.pdf' : 'mtp-workbook-mi-printable-v1.pdf';
  const printableFile = isIN ? 'mtp-workbook-printable-v3.pdf' : 'mtp-workbook-mi-printable-v1.pdf';

  // Send workbook delivery email via Resend
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: 'Michiana Trust Planning <info@michianatrustplanning.com>',
        to: email,
        subject: `Your ${stateName} Trust Planning Workbook — Download Inside`,
        html: `
          <div style="font-family:'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;color:#253040">
            <div style="background:#1c2b3a;padding:28px 32px 20px;border-bottom:3px solid #b07d2e">
              <p style="margin:0;font-size:11px;letter-spacing:2px;color:#c99540;font-weight:600;text-transform:uppercase">Michiana Trust Planning</p>
            </div>
            <div style="padding:36px 32px">
              <h1 style="font-size:22px;color:#1c2b3a;margin:0 0 16px;font-weight:600">Your Workbook Is Ready</h1>
              <p style="font-size:15px;line-height:1.7;color:#4a5568;margin:0 0 20px">
                Thank you for your purchase. Your ${stateName} Revocable Living Trust Workbook is ready to download${isIN ? ' in two formats' : ''}:
              </p>
              ${isIN ? `
              <div style="margin:0 0 12px">
                <a href="${WORKBOOK_BASE}/${fillableFile}"
                   style="display:inline-block;background:#b07d2e;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none">
                  Download Fillable Workbook (PDF) →
                </a>
              </div>` : ''}
              <div style="margin:0 0 28px">
                <a href="${WORKBOOK_BASE}/${printableFile}"
                   style="display:inline-block;background:${isIN ? '#243347' : '#b07d2e'};color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none">
                  Download ${isIN ? 'Printable ' : ''}Workbook (PDF) →
                </a>
              </div>
              ${isIN ? `
              <p style="font-size:14px;line-height:1.7;color:#4a5568;margin:0 0 8px">
                <strong>Fillable version</strong> — complete on your computer, save, and print when ready.
              </p>
              <p style="font-size:14px;line-height:1.7;color:#4a5568;margin:0 0 28px">
                <strong>Printable version</strong> — print it out and work through it with a pen.
              </p>` : ''}
              <div style="background:#faf8f4;border-left:3px solid #b07d2e;padding:20px 24px;margin:0 0 0;border-radius:0 6px 6px 0">
                <p style="font-size:15px;font-weight:600;color:#1c2b3a;margin:0 0 8px">Ready for the full package?</p>
                <p style="font-size:14px;line-height:1.7;color:#4a5568;margin:0 0 14px">
                  The workbook helps you plan. The <strong>Complete ${stateName} Trust Bundle</strong> gives you all 7 attorney-reviewed documents — personalized, delivered to your inbox, ready to sign and notarize. Everything you need, for $199.
                </p>
                <a href="${SITE}#step-bundle"
                   style="color:#b07d2e;font-weight:600;font-size:14px;text-decoration:none">See what's in the Bundle →</a>
              </div>
            </div>
            <div style="background:#f5f1ea;padding:16px 32px;text-align:center">
              <p style="margin:0;font-size:11px;color:#9aa5b1">
                © 2026 Michiana Trust Planning · ${region}<br>
                <a href="${SITE}" style="color:#9aa5b1">michianatrustplanning.com</a>
              </p>
            </div>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
    }
  } catch (err) {
    console.error('Email send error:', err);
  }

  return res.status(200).json({ received: true });
}
