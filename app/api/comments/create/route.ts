import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeText, isValidUUID } from "@/lib/sanitize";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { claim_id, content } = body as { claim_id: unknown; content: unknown };

    if (typeof claim_id !== "string" || !isValidUUID(claim_id)) {
      return NextResponse.json({ error: "claim_id must be a valid UUID" }, { status: 400 });
    }
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const safeContent = sanitizeText(content.trim());
    if (!safeContent) return NextResponse.json({ error: "Content is empty after sanitization" }, { status: 400 });

    const { data: comment, error } = await supabase
      .from("comments")
      .insert({ claim_id, content: safeContent, created_by: user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comment });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
