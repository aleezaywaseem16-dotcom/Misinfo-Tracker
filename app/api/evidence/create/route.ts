import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeText, sanitizeUrl, isValidUUID } from "@/lib/sanitize";

const VALID_SOURCE_TYPES = ["link", "document", "image", "text"] as const;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { claim_id, platform_id, title, content, evidence_url, source_type } = body as {
      claim_id: unknown; platform_id: unknown; title: unknown;
      content: unknown; evidence_url: unknown; source_type: unknown;
    };

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (typeof claim_id !== "string" || !isValidUUID(claim_id)) {
      return NextResponse.json({ error: "claim_id must be a valid UUID" }, { status: 400 });
    }
    if (typeof evidence_url !== "string" || !evidence_url.trim()) {
      return NextResponse.json({ error: "A source is required" }, { status: 400 });
    }

    const safeSourceType = typeof source_type === "string" && (VALID_SOURCE_TYPES as readonly string[]).includes(source_type)
      ? (source_type as (typeof VALID_SOURCE_TYPES)[number]) : "link";

    // "text" sources are typed content, not a link — every other type
    // (link/document/image) is a real URL, validated as such.
    const safeEvidenceUrl = safeSourceType === "text" ? sanitizeText(evidence_url.trim()) : sanitizeUrl(evidence_url.trim());
    if (!safeEvidenceUrl) {
      return NextResponse.json(
        { error: safeSourceType === "text" ? "Source text cannot be empty" : "Source must be a valid http/https URL" },
        { status: 400 }
      );
    }

    const safePlatformId = typeof platform_id === "string" && isValidUUID(platform_id) ? platform_id : null;
    const safeTitle = typeof title === "string" && title.trim() ? sanitizeText(title.trim()) : null;
    const safeContent = typeof content === "string" && content.trim() ? sanitizeText(content.trim()) : null;

    if (!safeTitle && !safeContent) {
      return NextResponse.json({ error: "Please provide a title or description" }, { status: 400 });
    }

    const { data: evidence, error: insertErr } = await supabase
      .from("evidence")
      .insert({ claim_id, platform_id: safePlatformId, title: safeTitle, content: safeContent, evidence_url: safeEvidenceUrl, source_type: safeSourceType, created_by: user.id })
      .select().single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ evidence });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
