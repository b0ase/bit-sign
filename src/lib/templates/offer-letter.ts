export const OFFER_LETTER_TEMPLATE = {
  id: 'offer_letter',
  name: 'Share Offer Letter',
  description: 'Formal letter offering shares in a company to an investor',
  fields: [
    { key: 'company_name', label: 'Company Name', required: true },
    { key: 'company_number', label: 'Company Number', required: true },
    { key: 'investor_name', label: 'Investor Name', required: true },
    { key: 'investor_address', label: 'Investor Address', required: false },
    { key: 'share_amount', label: 'Number of Shares Offered', required: true },
    { key: 'share_class', label: 'Share Class', required: false, default: 'Ordinary' },
    { key: 'price_per_share', label: 'Price per Share (GBP)', required: true },
    { key: 'total_consideration', label: 'Total Consideration (GBP)', required: true },
    { key: 'percentage', label: 'Percentage of Company', required: false },
    { key: 'offer_date', label: 'Offer Date', required: false },
    { key: 'expiry_date', label: 'Offer Expiry Date', required: false },
    { key: 'director_name', label: 'Director Name', required: true },
    { key: 'conditions', label: 'Special Conditions', required: false },
  ],
  signers: [
    { role: 'director', label: 'Director (Issuer)', required: true },
    { role: 'investor', label: 'Investor (Acceptor)', required: true },
  ],
  html: `
<div style="font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 50px; line-height: 1.8;">
  <div style="margin-bottom: 40px;">
    <h2 style="margin: 0; font-size: 22px;">{{company_name}}</h2>
    <p style="font-size: 12px; color: #666; margin: 4px 0;">Company Number: {{company_number}}</p>
  </div>

  <div style="margin-bottom: 30px;">
    <p style="font-size: 13px; color: #555;">Date: {{offer_date}}</p>
  </div>

  <div style="margin-bottom: 30px;">
    <p style="font-size: 14px;"><strong>{{investor_name}}</strong></p>
    {{#investor_address}}<p style="font-size: 13px; color: #555;">{{investor_address}}</p>{{/investor_address}}
  </div>

  <div style="margin-bottom: 30px;">
    <p style="font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Re: Offer of Shares</p>
  </div>

  <div style="margin-bottom: 30px; font-size: 14px;">
    <p>Dear {{investor_name}},</p>

    <p>On behalf of <strong>{{company_name}}</strong> (the "Company"), I am pleased to offer you the following shares:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Shares Offered</td>
        <td style="padding: 8px 12px; border: 1px solid #ddd;">{{share_amount}} {{share_class}} Shares</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Price per Share</td>
        <td style="padding: 8px 12px; border: 1px solid #ddd;">&pound;{{price_per_share}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Total Consideration</td>
        <td style="padding: 8px 12px; border: 1px solid #ddd;">&pound;{{total_consideration}}</td>
      </tr>
      {{#percentage}}
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #ddd; background: #f9f9f9; font-weight: bold;">Equity Percentage</td>
        <td style="padding: 8px 12px; border: 1px solid #ddd;">{{percentage}}%</td>
      </tr>
      {{/percentage}}
    </table>

    <p>This offer is made subject to the memorandum and articles of association of the Company. The shares will rank pari passu with all existing issued {{share_class}} shares.</p>

    {{#conditions}}<p><strong>Special Conditions:</strong> {{conditions}}</p>{{/conditions}}

    {{#expiry_date}}<p>This offer expires on <strong>{{expiry_date}}</strong>. If not accepted by that date, it shall be deemed to have been withdrawn.</p>{{/expiry_date}}

    <p>To accept this offer, please sign below and return a copy of this letter.</p>

    <p>Yours sincerely,</p>
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 50px;">
    <div style="width: 45%;" data-signer="director">
      <div style="border-bottom: 1px solid #333; height: 60px; margin-bottom: 8px;"></div>
      <p style="font-size: 12px; font-weight: bold; margin: 0;">{{director_name}}</p>
      <p style="font-size: 11px; color: #666; margin: 4px 0;">Director, {{company_name}}</p>
    </div>
    <div style="width: 45%;" data-signer="investor">
      <p style="font-size: 13px; font-weight: bold; margin-bottom: 8px;">ACCEPTED AND AGREED:</p>
      <div style="border-bottom: 1px solid #333; height: 60px; margin-bottom: 8px;"></div>
      <p style="font-size: 12px; font-weight: bold; margin: 0;">{{investor_name}}</p>
      <p style="font-size: 11px; color: #666; margin: 4px 0;">Date: _______________</p>
    </div>
  </div>
</div>
`,
};
