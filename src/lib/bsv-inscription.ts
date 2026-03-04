/**
 * BSV Inscription Library for bit-sign
 *
 * Inscribes signing envelope data on BSV blockchain via OP_RETURN.
 * Ported from b0ase.com/lib/bitsign-inscription.ts
 */

import { Transaction } from '@bsv/sdk';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';
const FETCH_TIMEOUT_MS = 30000;

export interface BitSignInscriptionData {
  type: 'signature_registration' | 'document_signature' | 'envelope_signing' | 'identity_root' | 'identity_strand' | 'ip_thread' | 'document_seal' | 'document_seal_confirmation';

  // For signature registration
  signatureId?: string;
  signatureType?: 'drawn' | 'typed';
  signatureHash?: string;
  ownerName?: string;

  // For document/envelope signing
  documentSignatureId?: string;
  documentHash?: string;
  signerName?: string;
  envelopeId?: string;
  envelopeTitle?: string;

  // Common fields
  walletAddress?: string;
  walletType?: string;
  createdAt?: string;
  signedAt?: string;

  // For identity_root / identity_strand
  userHandle?: string;
  tokenSymbol?: string;
  rootTxid?: string;
  strandType?: string;
  strandSubtype?: string;
  strandLabel?: string;

  // For ip_thread (documentHash is shared with document_signature above)
  threadTitle?: string;
  threadSequence?: number;
  documentType?: string;
}

export interface BitSignInscriptionResult {
  txid: string;
  inscriptionUrl: string;
  dataHash: string;
  blockchainExplorerUrl: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Calculate SHA-256 hash of a string
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate SHA-256 hash of a Buffer/ArrayBuffer
 */
export async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateBitSignJson(data: BitSignInscriptionData): string {
  // $401 identity types use canonical { p: "401" } format
  // Signing types (signature_registration, document_signature, envelope_signing) keep legacy format

  if (data.type === 'identity_root') {
    return JSON.stringify({
      p: '401',
      op: 'root',
      v: '1.0',
      handle: data.userHandle,
      symbol: data.tokenSymbol,
      payloadHash: data.signatureHash || '',
      ts: new Date().toISOString(),
    }, null, 2);
  }

  if (data.type === 'identity_strand') {
    const strand: Record<string, any> = {
      p: '401',
      op: 'strand',
      v: '1.0',
      root: data.rootTxid,
      type: data.strandType,
      handle: data.userHandle,
      ts: new Date().toISOString(),
    };
    if (data.strandSubtype) strand.subtype = data.strandSubtype;
    if (data.strandLabel) strand.label = data.strandLabel;
    return JSON.stringify(strand, null, 2);
  }

  if (data.type === 'ip_thread') {
    return JSON.stringify({
      p: '401',
      op: 'strand',
      v: '1.0',
      root: data.rootTxid,
      type: 'ip_thread',
      documentHash: data.documentHash,
      documentType: data.documentType || 'DOCUMENT',
      title: data.threadTitle,
      sequence: data.threadSequence || 1,
      handle: data.userHandle,
      ts: new Date().toISOString(),
    }, null, 2);
  }

  // Legacy format for non-identity signing types
  const inscriptionData: Record<string, any> = {
    protocol: 'b0ase-bitsign',
    version: '1.0',
    type: data.type,
    timestamp: new Date().toISOString(),
  };

  if (data.type === 'signature_registration') {
    inscriptionData.signatureId = data.signatureId;
    inscriptionData.signatureType = data.signatureType;
    inscriptionData.signatureHash = data.signatureHash;
    inscriptionData.ownerName = data.ownerName;
    inscriptionData.walletAddress = data.walletAddress;
    inscriptionData.walletType = data.walletType;
    inscriptionData.createdAt = data.createdAt;
  } else if (data.type === 'document_signature') {
    inscriptionData.documentSignatureId = data.documentSignatureId;
    inscriptionData.documentHash = data.documentHash;
    inscriptionData.signatureId = data.signatureId;
    inscriptionData.signerName = data.signerName;
    inscriptionData.signerWallet = data.walletAddress;
    inscriptionData.walletType = data.walletType;
    inscriptionData.signedAt = data.signedAt;
  } else if (data.type === 'envelope_signing') {
    inscriptionData.envelopeId = data.envelopeId;
    inscriptionData.envelopeTitle = data.envelopeTitle;
    inscriptionData.documentHash = data.documentHash;
    inscriptionData.signerName = data.signerName;
    inscriptionData.signerWallet = data.walletAddress;
    inscriptionData.walletType = data.walletType;
    inscriptionData.signedAt = data.signedAt;
  }

  return JSON.stringify(inscriptionData, null, 2);
}

/**
 * Parse an inscription payload, handling both legacy (b0ase-bitsign) and canonical ($401) formats.
 * Returns normalized data regardless of source format.
 */
export function parseInscription(data: Record<string, any>): {
  format: 'canonical' | 'legacy';
  op?: string;
  type?: string;
  handle?: string;
  root?: string;
  strandType?: string;
  strandSubtype?: string;
  raw: Record<string, any>;
} {
  // Canonical $401 format: { p: "401", op: "root"|"strand", v: "1.0", ... }
  if (data.p === '401') {
    return {
      format: 'canonical',
      op: data.op,
      type: data.type || data.op,
      handle: data.handle,
      root: data.root,
      strandType: data.type,
      strandSubtype: data.subtype,
      raw: data,
    };
  }

  // Legacy b0ase-bitsign format: { protocol: "b0ase-bitsign", type: "identity_strand", ... }
  if (data.protocol === 'b0ase-bitsign') {
    const isRoot = data.type === 'identity_root';
    const isStrand = data.type === 'identity_strand';
    return {
      format: 'legacy',
      op: isRoot ? 'root' : isStrand ? 'strand' : data.type,
      type: data.type,
      handle: data.userHandle,
      root: data.rootTxid,
      strandType: data.strandType,
      strandSubtype: data.strandSubtype,
      raw: data,
    };
  }

  return { format: 'legacy', raw: data };
}

/**
 * Verify a BitSign inscription on blockchain.
 * Handles both legacy (b0ase-bitsign protocol marker) and canonical ($401 JSON) formats.
 */
export async function verifyBitSignInscription(txid: string): Promise<{
  found: boolean;
  data?: any;
  dataHash?: string;
  format?: 'canonical' | 'legacy';
}> {
  try {
    const url = `${WHATSONCHAIN_API}/tx/${txid}/hex`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return { found: false };
    }

    const txHex = await response.text();
    const tx = Transaction.fromHex(txHex);

    for (const output of tx.outputs) {
      const script = output.lockingScript;
      const chunks = script.chunks;

      if (chunks.length > 0 && chunks[0].op === 106) {
        // Try to extract JSON from OP_RETURN chunks
        for (let i = 1; i < chunks.length; i++) {
          const buf = chunks[i].data as Buffer | undefined;
          if (!buf) continue;
          const text = Buffer.from(buf).toString('utf8');

          // Try parsing as JSON
          try {
            const data = JSON.parse(text);
            if (data && typeof data === 'object') {
              const parsed = parseInscription(data);
              if (parsed.format === 'canonical' || data.protocol === 'b0ase-bitsign') {
                const dataHash = await hashData(text);
                return { found: true, data, dataHash, format: parsed.format };
              }
            }
          } catch {
            // Not JSON, check if it's the protocol marker
            if (text === 'b0ase-bitsign' && chunks.length >= i + 3) {
              const dataBuf = chunks[i + 2].data as Buffer | undefined;
              const jsonData = dataBuf ? Buffer.from(dataBuf).toString('utf8') : '';
              if (jsonData) {
                const data = JSON.parse(jsonData);
                const dataHash = await hashData(jsonData);
                return { found: true, data, dataHash, format: 'legacy' };
              }
            }
          }
        }
      }
    }

    return { found: false };
  } catch (error) {
    console.error('[bitsign] Verify error:', error);
    return { found: false };
  }
}

/**
 * Generate signing message for document signing
 */
export function generateSigningMessage(params: {
  documentTitle?: string;
  documentHash: string;
  signerName?: string;
  walletAddress: string;
  timestamp?: string;
}): string {
  const timestamp = params.timestamp || new Date().toISOString();
  const nonce = crypto.randomUUID();

  return `BitSign Document Signature
==========================
Document: ${params.documentTitle || 'Untitled Document'}
Hash: ${params.documentHash}
Signer: ${params.signerName || 'Anonymous'}
Wallet: ${params.walletAddress}
Time: ${timestamp}
Nonce: ${nonce}

By signing, I confirm I have reviewed and agree to this document.`;
}
