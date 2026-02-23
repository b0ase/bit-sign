/**
 * Generate a signing message for wallet verification (client-side).
 * This message is what gets signed by HandCash to prove identity.
 */
export function generateSigningMessage(params: {
  documentTitle: string;
  documentHash: string;
  signerName: string;
}): string {
  const timestamp = new Date().toISOString();

  return `BitSign Document Signature
==========================
Document: ${params.documentTitle}
Hash: ${params.documentHash}
Signer: ${params.signerName}
Time: ${timestamp}

By signing, I confirm I have reviewed and agree to this document.`;
}
