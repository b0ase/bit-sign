import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import React from 'react';
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Courier',
    fontSize: 10,
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
    borderBottom: '2px solid #333',
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 8,
    color: '#666',
    letterSpacing: 2,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 8,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  value: {
    fontSize: 10,
  },
  signerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '8 0',
    borderBottom: '1px solid #eee',
  },
  signerName: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  signerRole: {
    fontSize: 8,
    color: '#666',
    textTransform: 'uppercase',
  },
  signerStatus: {
    fontSize: 8,
    textTransform: 'uppercase',
  },
  proofBox: {
    marginTop: 30,
    padding: 20,
    border: '2px solid #333',
    backgroundColor: '#f9f9f9',
  },
  proofTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 12,
    textAlign: 'center',
  },
  proofRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  proofLabel: {
    fontSize: 8,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    width: 120,
  },
  proofValue: {
    fontSize: 8,
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 7,
    color: '#999',
    borderTop: '1px solid #ddd',
    paddingTop: 10,
  },
});

/**
 * GET /api/envelopes/[id]/pdf — Generate signed PDF with blockchain proof
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: envelope, error } = await supabaseAdmin
      .from('signing_envelopes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    }

    const signers = envelope.signers as any[];
    const hasTxid = envelope.inscription_txid && !envelope.inscription_txid.startsWith('pending-');

    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{envelope.title}</Text>
            <Text style={styles.subtitle}>
              {envelope.document_type.replace(/_/g, ' ').toUpperCase()} | CREATED {new Date(envelope.created_at).toLocaleDateString('en-GB')}
            </Text>
          </View>

          {/* Document Hash */}
          <View style={styles.section}>
            <Text style={styles.label}>Document Hash (SHA-256)</Text>
            <Text style={styles.value}>{envelope.document_hash}</Text>
          </View>

          {/* Created By */}
          <View style={styles.section}>
            <Text style={styles.label}>Created By</Text>
            <Text style={styles.value}>${envelope.created_by_handle}</Text>
          </View>

          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{envelope.status.toUpperCase()}</Text>
          </View>

          {/* Signers */}
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={[styles.label, { marginBottom: 8 }]}>Signers</Text>
            {signers.map((signer: any, i: number) => (
              <View key={i} style={styles.signerRow}>
                <View>
                  <Text style={styles.signerName}>{signer.name}</Text>
                  <Text style={styles.signerRole}>{signer.role}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.signerStatus, {
                    color: signer.status === 'signed' ? '#16a34a' : '#a1a1aa',
                  }]}>
                    {signer.status === 'signed' ? 'SIGNED' : 'PENDING'}
                  </Text>
                  {signer.signed_at && (
                    <Text style={{ fontSize: 7, color: '#999' }}>
                      {new Date(signer.signed_at).toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Blockchain Proof Box */}
          <View style={styles.proofBox}>
            <Text style={styles.proofTitle}>Blockchain Proof</Text>

            <View style={styles.proofRow}>
              <Text style={styles.proofLabel}>Document Hash</Text>
              <Text style={styles.proofValue}>sha256:{envelope.document_hash}</Text>
            </View>

            {hasTxid && (
              <>
                <View style={styles.proofRow}>
                  <Text style={styles.proofLabel}>Transaction ID</Text>
                  <Text style={styles.proofValue}>{envelope.inscription_txid}</Text>
                </View>
                <View style={styles.proofRow}>
                  <Text style={styles.proofLabel}>Explorer</Text>
                  <Text style={styles.proofValue}>https://whatsonchain.com/tx/{envelope.inscription_txid}</Text>
                </View>
              </>
            )}

            <View style={styles.proofRow}>
              <Text style={styles.proofLabel}>Verify Online</Text>
              <Text style={styles.proofValue}>https://bit-sign.online/verify/{id}</Text>
            </View>

            {envelope.inscribed_at && (
              <View style={styles.proofRow}>
                <Text style={styles.proofLabel}>Inscribed At</Text>
                <Text style={styles.proofValue}>{new Date(envelope.inscribed_at).toLocaleString()}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Generated by BIT-SIGN | bit-sign.online | Bitcoin SV Blockchain Verified
          </Text>
        </Page>
      </Document>
    );

    const buffer = await renderToBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="bitsign-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('[pdf] Generation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: 500 });
  }
}
