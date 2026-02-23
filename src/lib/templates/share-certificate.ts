export const SHARE_CERTIFICATE_TEMPLATE = {
  id: 'share_certificate',
  name: 'Share Certificate',
  description: 'Certificate of share ownership in a limited company',
  fields: [
    { key: 'company_name', label: 'Company Name', required: true },
    { key: 'company_number', label: 'Company Number', required: true },
    { key: 'shareholder_name', label: 'Shareholder Name', required: true },
    { key: 'share_amount', label: 'Number of Shares', required: true },
    { key: 'share_class', label: 'Share Class', required: false, default: 'Ordinary' },
    { key: 'nominal_value', label: 'Nominal Value per Share', required: false, default: '1.00' },
    { key: 'percentage', label: 'Percentage of Total Shares', required: false },
    { key: 'certificate_number', label: 'Certificate Number', required: false },
    { key: 'issue_date', label: 'Issue Date', required: false },
    { key: 'director_name', label: 'Director Name', required: true },
  ],
  signers: [
    { role: 'director', label: 'Director', required: true },
    { role: 'witness', label: 'Witness', required: false },
  ],
  html: `
<div style="font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 60px; border: 3px double #333; position: relative;">
  <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 30px; margin-bottom: 30px;">
    <h1 style="font-size: 28px; letter-spacing: 4px; text-transform: uppercase; margin: 0;">Share Certificate</h1>
    <p style="font-size: 12px; color: #666; letter-spacing: 2px; margin-top: 8px;">CERTIFICATE NO. {{certificate_number}}</p>
  </div>

  <div style="text-align: center; margin-bottom: 40px;">
    <h2 style="font-size: 24px; margin: 0;">{{company_name}}</h2>
    <p style="font-size: 13px; color: #555;">Company Number: {{company_number}}</p>
    <p style="font-size: 12px; color: #888;">Incorporated under the Companies Act 2006</p>
  </div>

  <div style="margin-bottom: 40px; line-height: 2;">
    <p style="font-size: 15px;">This is to certify that</p>
    <p style="font-size: 20px; font-weight: bold; border-bottom: 1px solid #333; display: inline-block; padding: 0 20px;">{{shareholder_name}}</p>
    <p style="font-size: 15px;">is the registered holder of</p>
    <p style="font-size: 20px; font-weight: bold;">{{share_amount}} {{share_class}} Shares</p>
    <p style="font-size: 14px; color: #555;">of {{nominal_value}} each in the above-named company{{#percentage}}, representing <strong>{{percentage}}%</strong> of the total issued share capital{{/percentage}}.</p>
  </div>

  <div style="margin-bottom: 40px;">
    <p style="font-size: 13px; color: #555;">The shares are subject to the memorandum and articles of association of the company.</p>
    <p style="font-size: 13px; color: #555; margin-top: 10px;">Given under the common seal of the company this <strong>{{issue_date}}</strong>.</p>
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px;">
    <div style="text-align: center; width: 45%;" data-signer="director">
      <div style="border-bottom: 1px solid #333; height: 60px; margin-bottom: 8px;"></div>
      <p style="font-size: 12px; font-weight: bold;">{{director_name}}</p>
      <p style="font-size: 11px; color: #666;">Director</p>
    </div>
    <div style="text-align: center; width: 45%;" data-signer="witness">
      <div style="border-bottom: 1px solid #333; height: 60px; margin-bottom: 8px;"></div>
      <p style="font-size: 12px; color: #666;">Witness</p>
    </div>
  </div>
</div>
`,
};
