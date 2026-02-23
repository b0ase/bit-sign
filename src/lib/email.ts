import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SigningInvitationParams {
  recipientEmail: string;
  recipientName: string;
  signerRole: string;
  senderHandle: string;
  documentTitle: string;
  signingUrl: string;
  message?: string;
}

export async function sendSigningInvitation({
  recipientEmail,
  recipientName,
  signerRole,
  senderHandle,
  documentTitle,
  signingUrl,
  message,
}: SigningInvitationParams): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const html = buildEmailHtml({
    recipientName,
    signerRole,
    senderHandle,
    documentTitle,
    signingUrl,
    message,
  });

  try {
    const { error } = await resend.emails.send({
      from: `bit-sign <${fromEmail}>`,
      to: [recipientEmail],
      subject: `$${senderHandle} has sent you a document to sign: "${documentTitle}"`,
      html,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[email] Send failed:', err);
    return { success: false, error: err.message || 'Failed to send email' };
  }
}

function buildEmailHtml({
  recipientName,
  signerRole,
  senderHandle,
  documentTitle,
  signingUrl,
  message,
}: Omit<SigningInvitationParams, 'recipientEmail'>): string {
  const messageBlock = message
    ? `
      <tr>
        <td style="padding: 0 40px 32px;">
          <div style="border-left: 3px solid #3f3f46; padding: 16px 20px; background: #18181b;">
            <div style="font-family: monospace; font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Personal Message</div>
            <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #d4d4d8; line-height: 1.6;">${escapeHtml(message)}</div>
          </div>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #000000; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #09090b; border: 1px solid #27272a; max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px;">
              <div style="font-family: monospace; font-size: 10px; color: #52525b; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 16px;">Signing Invitation</div>
              <div style="font-family: monospace; font-size: 22px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: -0.02em;">${escapeHtml(documentTitle)}</div>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #27272a;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a;">
                    <span style="font-family: monospace; font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.1em;">From</span>
                    <div style="font-family: monospace; font-size: 13px; color: #ffffff; font-weight: bold; margin-top: 4px;">$${escapeHtml(senderHandle)}</div>
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; border-left: 1px solid #27272a;">
                    <span style="font-family: monospace; font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.1em;">Your Role</span>
                    <div style="font-family: monospace; font-size: 13px; color: #ffffff; font-weight: bold; margin-top: 4px;">${escapeHtml(signerRole)}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 12px 16px;">
                    <span style="font-family: monospace; font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.1em;">Recipient</span>
                    <div style="font-family: monospace; font-size: 13px; color: #ffffff; font-weight: bold; margin-top: 4px;">${escapeHtml(recipientName)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Personal message -->
          ${messageBlock}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px;" align="center">
              <a href="${signingUrl}" target="_blank" style="display: inline-block; padding: 18px 48px; background: #ffffff; color: #000000; font-family: monospace; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none;">Sign Document</a>
            </td>
          </tr>

          <!-- How it works -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="font-family: monospace; font-size: 10px; color: #52525b; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 16px;">How It Works</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 24px;">
                    <span style="font-family: monospace; font-size: 11px; color: #3f3f46;">1.</span>
                  </td>
                  <td style="padding: 8px 0;">
                    <span style="font-family: monospace; font-size: 12px; color: #a1a1aa;">Click the button above to review the document</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 24px;">
                    <span style="font-family: monospace; font-size: 11px; color: #3f3f46;">2.</span>
                  </td>
                  <td style="padding: 8px 0;">
                    <span style="font-family: monospace; font-size: 12px; color: #a1a1aa;">Draw your signature on the signing pad</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 24px;">
                    <span style="font-family: monospace; font-size: 11px; color: #3f3f46;">3.</span>
                  </td>
                  <td style="padding: 8px 0;">
                    <span style="font-family: monospace; font-size: 12px; color: #a1a1aa;">Optionally verify with HandCash for blockchain identity</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HandCash note -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="padding: 16px; background: #18181b; border: 1px solid #27272a;">
                <span style="font-family: monospace; font-size: 11px; color: #71717a; line-height: 1.6;">
                  Don't have HandCash? You can still sign. Get HandCash at
                  <a href="https://handcash.io" style="color: #22c55e; text-decoration: none;">handcash.io</a>
                  for blockchain-verified identity.
                </span>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #27272a;">
              <div style="font-family: monospace; font-size: 10px; color: #3f3f46; text-transform: uppercase; letter-spacing: 0.1em; line-height: 1.8;">
                bit-sign protocol &mdash; blockchain-verified document signing<br>
                <a href="https://bit-sign.online" style="color: #52525b; text-decoration: none;">bit-sign.online</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
