import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeText, isValidUUID } from "@/lib/sanitize";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { claim_id, content, parent_comment_id } = body as { claim_id: unknown; content: unknown; parent_comment_id?: unknown };

    if (typeof claim_id !== "string" || !isValidUUID(claim_id)) {
      return NextResponse.json({ error: "claim_id must be a valid UUID" }, { status: 400 });
    }
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }
    if (parent_comment_id !== undefined && parent_comment_id !== null && (typeof parent_comment_id !== "string" || !isValidUUID(parent_comment_id))) {
      return NextResponse.json({ error: "parent_comment_id must be a valid UUID" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const safeContent = sanitizeText(content.trim());
    if (!safeContent) return NextResponse.json({ error: "Content is empty after sanitization" }, { status: 400 });

    let safeParentId: string | null = null;
    if (typeof parent_comment_id === "string") {
      const { data: parent } = await supabase.from("comments").select("id, claim_id").eq("id", parent_comment_id).maybeSingle();
      if (!parent || parent.claim_id !== claim_id) {
        return NextResponse.json({ error: "parent_comment_id does not belong to this claim" }, { status: 400 });
      }
      safeParentId = parent.id;
    }

    const { data: comment, error } = await supabase
      .from("comments")
      .insert({ claim_id, content: safeContent, created_by: user.id, parent_comment_id: safeParentId })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comment });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
