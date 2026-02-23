import { NextRequest, NextResponse } from 'next/server';
import { listTemplates, getTemplate, renderDocument } from '@/lib/templates';

/**
 * GET /api/templates — List available document templates
 * GET /api/templates?id=share_certificate — Get specific template details
 * POST /api/templates — Preview a rendered template
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (id) {
    const template = getTemplate(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ template });
  }

  const templates = listTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    fields: t.fields,
    signers: t.signers,
  }));

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  try {
    const { template_id, variables } = await request.json();

    if (!template_id) {
      return NextResponse.json({ error: 'Missing template_id' }, { status: 400 });
    }

    const html = renderDocument(template_id, variables || {});
    return NextResponse.json({ html });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
