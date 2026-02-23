export const J30_FORM_TEMPLATE = {
  id: 'j30_form',
  name: 'Stock Transfer Form (J30)',
  description: 'Standard form for transferring shares between parties',
  fields: [
    { key: 'company_name', label: 'Company Name', required: true },
    { key: 'share_class', label: 'Share Class', required: false, default: 'Ordinary' },
    { key: 'share_amount', label: 'Number of Shares', required: true },
    { key: 'nominal_value', label: 'Nominal Value per Share', required: false, default: '1.00' },
    { key: 'consideration', label: 'Consideration (GBP)', required: true },
    { key: 'transferor_name', label: 'Transferor (Seller) Name', required: true },
    { key: 'transferor_address', label: 'Transferor Address', required: true },
    { key: 'transferee_name', label: 'Transferee (Buyer) Name', required: true },
    { key: 'transferee_address', label: 'Transferee Address', required: true },
    { key: 'transfer_date', label: 'Transfer Date', required: false },
  ],
  signers: [
    { role: 'transferor', label: 'Transferor (Seller)', required: true },
    { role: 'witness', label: 'Witness', required: true },
  ],
  html: `
<div style="font-family: 'Courier New', monospace; max-width: 800px; margin: 0 auto; padding: 40px; border: 2px solid #000;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 22px; letter-spacing: 3px; text-transform: uppercase; margin: 0;">Stock Transfer Form</h1>
    <p style="font-size: 11px; color: #666; margin-top: 4px;">Pursuant to Section 770 of the Companies Act 2006</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
    <tr>
      <td style="padding: 10px; border: 1px solid #333; width: 40%; font-weight: bold; background: #f5f5f5;">Full name of the Company</td>
      <td style="padding: 10px; border: 1px solid #333;">{{company_name}}</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #333; font-weight: bold; background: #f5f5f5;">Description of shares</td>
      <td style="padding: 10px; border: 1px solid #333;">{{share_class}} shares of {{nominal_value}} each</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #333; font-weight: bold; background: #f5f5f5;">Number of shares</td>
      <td style="padding: 10px; border: 1px solid #333;">{{share_amount}}</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #333; font-weight: bold; background: #f5f5f5;">Consideration</td>
      <td style="padding: 10px; border: 1px solid #333;">&pound;{{consideration}}</td>
    </tr>
  </table>

  <div style="margin-bottom: 30px;">
    <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #333; padding-bottom: 8px;">Transferor (Seller)</h3>
    <p style="font-size: 13px;"><strong>Name:</strong> {{transferor_name}}</p>
    <p style="font-size: 13px;"><strong>Address:</strong> {{transferor_address}}</p>
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #333; padding-bottom: 8px;">Transferee (Buyer)</h3>
    <p style="font-size: 13px;"><strong>Name:</strong> {{transferee_name}}</p>
    <p style="font-size: 13px;"><strong>Address:</strong> {{transferee_address}}</p>
  </div>

  <div style="margin-bottom: 20px;">
    <p style="font-size: 12px; color: #555;">I/We hereby transfer the above shares to the transferee named above.</p>
    <p style="font-size: 12px; color: #555;">Date: <strong>{{transfer_date}}</strong></p>
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px;">
    <div style="text-align: center; width: 45%;" data-signer="transferor">
      <div style="border-bottom: 1px solid #333; height: 60px; margin-bottom: 8px;"></div>
      <p style="font-size: 12px; font-weight: bold;">{{transferor_name}}</p>
      <p style="font-size: 11px; color: #666;">Transferor</p>
    </div>
    <div style="text-align: center; width: 45%;" data-signer="witness">
      <div style="border-bottom: 1px solid #333; height: 60px; margin-bottom: 8px;"></div>
      <p style="font-size: 11px; color: #666;">Witness</p>
    </div>
  </div>
</div>
`,
};
