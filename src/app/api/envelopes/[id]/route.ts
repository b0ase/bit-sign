import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/envelopes/[id] — Get envelope details + document preview
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

    return NextResponse.json({ envelope });
  } catch (error: any) {
    console.error('[envelopes] Get error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
