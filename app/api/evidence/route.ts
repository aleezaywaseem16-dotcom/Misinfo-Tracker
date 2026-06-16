// app/api/evidence/create/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sanitizeText } from '@/lib/sanitize';

export async function POST(req: Request) {
  const body = await req.json();
  const { claim_id, platform_id, title, content, evidence_url, image_url } = body;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!evidence_url?.trim()) return NextResponse.json({ error: 'Source URL required' }, { status: 400 });
  try { new URL(evidence_url); } catch { return NextResponse.json({ error: 'Invalid URL' }, { status: 400 }); }

  const { data, error } = await supabase.from('evidence').insert({
    claim_id,
    platform_id: platform_id || null,
    title: title ? sanitizeText(title.trim()) : null,
    content: content ? sanitizeText(content.trim()) : null,
    evidence_url: sanitizeText(evidence_url.trim()),
    image_url: image_url ? sanitizeText(image_url.trim()) : null,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ evidence: data });
}