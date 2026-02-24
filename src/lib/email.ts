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
            <div style="font-family: -apple-system, sans-serif; font-size: 11px; color: #71717a; margin-bottom: 8px;">Personal Message</div>
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
              <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: #71717a; margin-bottom: 12px;">Signing Request</div>
              <div style="font-family: -apple-system, sans-serif; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">${escapeHtml(documentTitle)}</div>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #27272a;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 11px; color: #71717a;">From</span>
                    <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #ffffff; font-weight: 600; margin-top: 4px;">$${escapeHtml(senderHandle)}</div>
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; border-left: 1px solid #27272a;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 11px; color: #71717a;">Your Role</span>
                    <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #ffffff; font-weight: 600; margin-top: 4px;">${escapeHtml(signerRole)}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 12px 16px;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 11px; color: #71717a;">Recipient</span>
                    <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #ffffff; font-weight: 600; margin-top: 4px;">${escapeHtml(recipientName)}</div>
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
              <a href="${signingUrl}" target="_blank" style="display: inline-block; padding: 16px 48px; background: #ffffff; color: #000000; font-family: -apple-system, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px;">Review &amp; Sign Document</a>
            </td>
          </tr>

          <!-- How it works -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: #71717a; margin-bottom: 16px;">How it works</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 24px;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #52525b;">1.</span>
                  </td>
                  <td style="padding: 8px 0;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #a1a1aa;">Click the button above to review the document</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 24px;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #52525b;">2.</span>
                  </td>
                  <td style="padding: 8px 0;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #a1a1aa;">Draw your signature on the signing pad</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 24px;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #52525b;">3.</span>
                  </td>
                  <td style="padding: 8px 0;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #a1a1aa;">Verify your identity with HandCash to record your signature on the blockchain ($0.01 fee)</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HandCash note -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="padding: 16px; background: #18181b; border: 1px solid #27272a; border-radius: 6px;">
                <span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #a1a1aa; line-height: 1.6;">
                  You'll need a <a href="https://handcash.io" style="color: #22c55e; text-decoration: none; font-weight: 600;">HandCash</a> wallet to verify your identity and sign.
                  It takes 30 seconds to set up and your signature will be permanently recorded on the Bitcoin blockchain.
                </span>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #27272a;">
              <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: #52525b; line-height: 1.8;">
                Bit-Sign &mdash; Document signing on Bitcoin<br>
                <a href="https://bit-sign.online" style="color: #71717a; text-decoration: none;">bit-sign.online</a>
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

interface VaultShareParams {
  recipientEmail: string;
  senderHandle: string;
  itemType: string;
  itemLabel: string;
  claimUrl: string;
  message?: string;
}

export async function sendVaultShareInvitation({
  recipientEmail,
  senderHandle,
  itemType,
  itemLabel,
  claimUrl,
  message,
}: VaultShareParams): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const messageBlock = message
    ? `
      <tr>
        <td style="padding: 0 40px 32px;">
          <div style="border-left: 3px solid #3f3f46; padding: 16px 20px; background: #18181b;">
            <div style="font-family: -apple-system, sans-serif; font-size: 11px; color: #71717a; margin-bottom: 8px;">Personal Message</div>
            <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #d4d4d8; line-height: 1.6;">${escapeHtml(message)}</div>
          </div>
        </td>
      </tr>`
    : '';

  const html = `<!DOCTYPE html>
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
              <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: #71717a; margin-bottom: 12px;">Shared with you</div>
              <div style="font-family: -apple-system, sans-serif; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">You've received a ${escapeHtml(itemLabel)}</div>
            </td>
          </tr>

          <!-- From -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #27272a;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 11px; color: #71717a;">From</span>
                    <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #ffffff; font-weight: 600; margin-top: 4px;">$${escapeHtml(senderHandle)}</div>
                  </td>
                  <td style="padding: 12px 16px; border-left: 1px solid #27272a;">
                    <span style="font-family: -apple-system, sans-serif; font-size: 11px; color: #71717a;">Type</span>
                    <div style="font-family: -apple-system, sans-serif; font-size: 14px; color: #ffffff; font-weight: 600; margin-top: 4px;">${escapeHtml(itemLabel)}</div>
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
              <a href="${claimUrl}" target="_blank" style="display: inline-block; padding: 16px 48px; background: #ffffff; color: #000000; font-family: -apple-system, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px;">View on Bit-Sign</a>
            </td>
          </tr>

          <!-- HandCash note -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="padding: 16px; background: #18181b; border: 1px solid #27272a; border-radius: 6px;">
                <span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #a1a1aa; line-height: 1.6;">
                  You'll need a <a href="https://handcash.io" style="color: #22c55e; text-decoration: none; font-weight: 600;">HandCash</a> wallet to view this.
                  It takes 30 seconds to set up &mdash; HandCash handles it all.
                </span>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #27272a;">
              <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: #52525b; line-height: 1.8;">
                bit-sign.online &mdash; Identity &amp; Documents on Bitcoin<br>
                <a href="https://bit-sign.online" style="color: #71717a; text-decoration: none;">bit-sign.online</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: `bit-sign <${fromEmail}>`,
      to: [recipientEmail],
      subject: `$${senderHandle} sent you a ${itemType.toLowerCase()} on Bit-Sign`,
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
