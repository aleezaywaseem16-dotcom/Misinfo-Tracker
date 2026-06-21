import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeText, sanitizeUrl, isValidUUID } from "@/lib/sanitize";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { claim_id, platform_id, title, content, evidence_url, image_url, document_url } = body as {
      claim_id: unknown; platform_id: unknown; title: unknown;
      content: unknown; evidence_url: unknown; image_url: unknown; document_url: unknown;
    };

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (typeof claim_id !== "string" || !isValidUUID(claim_id)) {
      return NextResponse.json({ error: "claim_id must be a valid UUID" }, { status: 400 });
    }
    if (typeof evidence_url !== "string" || !evidence_url.trim()) {
      return NextResponse.json({ error: "A source URL is required" }, { status: 400 });
    }

    const safeEvidenceUrl = sanitizeUrl(evidence_url.trim());
    if (!safeEvidenceUrl) return NextResponse.json({ error: "Source URL must be a valid http/https URL" }, { status: 400 });

    const safePlatformId = typeof platform_id === "string" && isValidUUID(platform_id) ? platform_id : null;
    const safeTitle = typeof title === "string" && title.trim() ? sanitizeText(title.trim()) : null;
    const safeContent = typeof content === "string" && content.trim() ? sanitizeText(content.trim()) : null;
    const safeImageUrl = typeof image_url === "string" && image_url.trim() ? sanitizeUrl(image_url.trim()) : null;
    const safeDocumentUrl = typeof document_url === "string" && document_url.trim() ? sanitizeUrl(document_url.trim()) : null;

    if (!safeTitle && !safeContent) {
      return NextResponse.json({ error: "Please provide a title or description" }, { status: 400 });
    }

    const { data: evidence, error: insertErr } = await supabase
      .from("evidence")
      .insert({ claim_id, platform_id: safePlatformId, title: safeTitle, content: safeContent, evidence_url: safeEvidenceUrl, image_url: safeImageUrl, document_url: safeDocumentUrl, created_by: user.id })
      .select().single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ evidence });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
