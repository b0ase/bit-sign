import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashData } from '@/lib/bsv-inscription';
import crypto from 'crypto';

/**
 * POST /api/envelopes/import — Import existing investor documents as historical envelopes
 *
 * This creates signing envelopes from the existing Bitcoin Corporation investor
 * documents (share certificates, J30 forms, offer letters) that were already
 * generated as HTML/PDF but not yet tracked in the signing system.
 *
 * These are imported as "completed" envelopes awaiting signature collection.
 */

interface InvestorDoc {
  title: string;
  document_type: 'share_certificate' | 'j30_form' | 'offer_letter';
  investor_name: string;
  investor_role: string;
  percentage: string;
  document_html: string;
  signers: {
    name: string;
    role: string;
    order: number;
  }[];
  metadata?: Record<string, any>;
}

// Investor document definitions (HTML fetched at import time)
const INVESTOR_DOCUMENTS: Omit<InvestorDoc, 'document_html'>[] = [
  // === BAILEY CONNOR (1%) ===
  {
    title: 'Bailey Connor — Share Certificate (1%)',
    document_type: 'share_certificate',
    investor_name: 'Bailey Connor',
    investor_role: 'Shareholder',
    percentage: '1%',
    signers: [
      { name: 'Richard Boase', role: 'Director', order: 1 },
      { name: 'Bailey Connor', role: 'Witness', order: 2 },
    ],
    metadata: {
      certificate_number: '004',
      shares: '10,000,000',
      consideration: '£2,000',
      reference: 'CONNOR-SUB-001',
    },
  },
  {
    title: 'Bailey Connor — J30 Stock Transfer Form',
    document_type: 'j30_form',
    investor_name: 'Bailey Connor',
    investor_role: 'Transferee',
    percentage: '1%',
    signers: [
      { name: 'Richard Boase', role: 'Transferor', order: 1 },
      { name: 'Bailey Connor', role: 'Transferee', order: 2 },
    ],
    metadata: {
      shares: '10,000,000',
      consideration: '£2,000',
    },
  },
  {
    title: 'Bailey Connor — Share Offer Letter (1%)',
    document_type: 'offer_letter',
    investor_name: 'Bailey Connor',
    investor_role: 'Investor',
    percentage: '1%',
    signers: [
      { name: 'Richard Boase', role: 'Director', order: 1 },
      { name: 'Bailey Connor', role: 'Investor', order: 2 },
    ],
    metadata: {
      shares: '10,000,000',
      consideration: '£2,000',
      reference: 'CONNOR-SUB-001',
    },
  },

  // === DANIEL PARIKEN SAKUDA (2%) ===
  {
    title: 'Daniel Pariken Sakuda — Share Certificate (2%)',
    document_type: 'share_certificate',
    investor_name: 'Daniel Pariken Sakuda',
    investor_role: 'Shareholder',
    percentage: '2%',
    signers: [
      { name: 'Richard Boase', role: 'Director', order: 1 },
      { name: 'Daniel Pariken Sakuda', role: 'Witness', order: 2 },
    ],
    metadata: {
      certificate_number: '003',
      shares: '20,000,000',
      consideration: '£4,000',
      reference: 'SAKUDA-SUB-001',
    },
  },
  {
    title: 'Daniel Pariken Sakuda — J30 Stock Transfer Form',
    document_type: 'j30_form',
    investor_name: 'Daniel Pariken Sakuda',
    investor_role: 'Transferee',
    percentage: '2%',
    signers: [
      { name: 'Richard Boase', role: 'Transferor', order: 1 },
      { name: 'Daniel Pariken Sakuda', role: 'Transferee', order: 2 },
    ],
    metadata: {
      shares: '20,000,000',
      consideration: '£4,000',
    },
  },
  {
    title: 'Daniel Pariken Sakuda — Share Offer Letter (2%)',
    document_type: 'offer_letter',
    investor_name: 'Daniel Pariken Sakuda',
    investor_role: 'Investor',
    percentage: '2%',
    signers: [
      { name: 'Richard Boase', role: 'Director', order: 1 },
      { name: 'Daniel Pariken Sakuda', role: 'Investor', order: 2 },
    ],
    metadata: {
      shares: '20,000,000',
      consideration: '£4,000',
      reference: 'SAKUDA-SUB-001',
    },
  },

  // === CRAIG MASSEY (1%) ===
  {
    title: 'Craig Massey — Share Certificate (1%)',
    document_type: 'share_certificate',
    investor_name: 'Craig Massey',
    investor_role: 'Shareholder',
    percentage: '1%',
    signers: [
      { name: 'Richard Boase', role: 'Director', order: 1 },
      { name: 'Craig Massey', role: 'Witness', order: 2 },
    ],
    metadata: {
      certificate_number: '002',
      shares: '10,000,000',
      consideration: '£2,000',
      reference: 'MASSEY-SUB-001',
    },
  },
  {
    title: 'Craig Massey — J30 Stock Transfer Form',
    document_type: 'j30_form',
    investor_name: 'Craig Massey',
    investor_role: 'Transferee',
    percentage: '1%',
    signers: [
      { name: 'Richard Boase', role: 'Transferor', order: 1 },
      { name: 'Craig Massey', role: 'Transferee', order: 2 },
    ],
    metadata: {
      shares: '10,000,000',
      consideration: '£2,000',
    },
  },
  {
    title: 'Craig Massey — Share Offer Letter (1%)',
    document_type: 'offer_letter',
    investor_name: 'Craig Massey',
    investor_role: 'Investor',
    percentage: '1%',
    signers: [
      { name: 'Richard Boase', role: 'Director', order: 1 },
      { name: 'Craig Massey', role: 'Investor', order: 2 },
    ],
    metadata: {
      shares: '10,000,000',
      consideration: '£2,000',
      reference: 'MASSEY-SUB-001',
    },
  },
];

// Map document definitions to their source HTML file paths
const HTML_FILE_MAP: Record<string, string> = {
  'Bailey Connor — Share Certificate (1%)':
    '/Volumes/2026/Projects/bitcoin-corp/investors/bailey-conner/Bailey_Connor_Share_Certificate_1_Percent.html',
  'Bailey Connor — J30 Stock Transfer Form':
    '/Volumes/2026/Projects/bitcoin-corp/investors/bailey-conner/Bailey_Connor_J30_Form.html',
  'Bailey Connor — Share Offer Letter (1%)':
    '/Volumes/2026/Projects/bitcoin-corp/investors/bailey-conner/Bailey_Connor_Share_Offer_1_Percent.html',
  'Daniel Pariken Sakuda — Share Certificate (2%)':
    '/Volumes/2026/Projects/bitcoin-corp/investors/daniel/Daniel_Share_Certificate_2_Percent.html',
  'Daniel Pariken Sakuda — J30 Stock Transfer Form':
    '/Volumes/2026/Projects/bitcoin-corp/investors/daniel/Daniel_J30_Form.html',
  'Daniel Pariken Sakuda — Share Offer Letter (2%)':
    '/Volumes/2026/Projects/bitcoin-corp/investors/daniel/Daniel_Share_Offer_2_Percent.html',
  'Craig Massey — Share Certificate (1%)':
    '/Volumes/2026/Projects/bitcoin-corp/investors/craig-massey/Craig_Massey_Revised_Share_Certificate_1_Percent.html',
  'Craig Massey — J30 Stock Transfer Form':
    '/Volumes/2026/Projects/bitcoin-corp/investors/craig-massey/Craig_Massey_J30_Form.html',
  'Craig Massey — Share Offer Letter (1%)':
    '/Volumes/2026/Projects/bitcoin-corp/investors/craig-massey/Craig_Massey_Revised_Share_Offer_1_Percent.html',
};

export async function POST(request: NextRequest) {
  try {
    // Simple auth check — only allow from localhost or with admin token
    const host = request.headers.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    if (!isLocal) {
      return NextResponse.json({ error: 'Import only available locally' }, { status: 403 });
    }

    const results: { title: string; id?: string; error?: string }[] = [];
    const fs = await import('fs/promises');

    for (const doc of INVESTOR_DOCUMENTS) {
      try {
        // Check if already imported (by title)
        const { data: existing } = await supabaseAdmin
          .from('signing_envelopes')
          .select('id')
          .eq('title', doc.title)
          .maybeSingle();

        if (existing) {
          results.push({ title: doc.title, id: existing.id, error: 'Already imported' });
          continue;
        }

        // Read HTML from file
        const filePath = HTML_FILE_MAP[doc.title];
        if (!filePath) {
          results.push({ title: doc.title, error: 'No file mapping found' });
          continue;
        }

        let documentHtml: string;
        try {
          documentHtml = await fs.readFile(filePath, 'utf-8');
        } catch (readErr) {
          results.push({ title: doc.title, error: `File not found: ${filePath}` });
          continue;
        }

        // Hash the document
        const documentHash = await hashData(documentHtml);

        // Create signers with signing tokens
        const signers = doc.signers.map((s) => ({
          ...s,
          status: 'pending',
          signed_at: null,
          signing_token: crypto.randomUUID(),
          signature_data: null,
        }));

        // Insert envelope as "pending" (awaiting signatures)
        const { data: envelope, error: insertError } = await supabaseAdmin
          .from('signing_envelopes')
          .insert({
            title: doc.title,
            document_type: doc.document_type,
            status: 'pending',
            document_html: documentHtml,
            document_hash: documentHash,
            created_by_handle: 'richard',
            signers,
            metadata: {
              ...doc.metadata,
              imported: true,
              imported_at: new Date().toISOString(),
              source: 'bitcoin-corp/investors',
              investor_name: doc.investor_name,
              investor_percentage: doc.percentage,
            },
          })
          .select('id')
          .single();

        if (insertError) {
          results.push({ title: doc.title, error: insertError.message });
        } else {
          results.push({ title: doc.title, id: envelope.id });
        }
      } catch (docErr: any) {
        results.push({ title: doc.title, error: docErr.message });
      }
    }

    const imported = results.filter((r) => r.id && !r.error).length;
    const skipped = results.filter((r) => r.error === 'Already imported').length;
    const failed = results.filter((r) => r.error && r.error !== 'Already imported').length;

    return NextResponse.json({
      success: true,
      summary: { imported, skipped, failed, total: results.length },
      results,
    });
  } catch (error: any) {
    console.error('[import] Error:', error);
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
