import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/sanitize";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { comment_id } = body as { comment_id: unknown };

    if (typeof comment_id !== "string" || !isValidUUID(comment_id)) {
      return NextResponse.json({ error: "comment_id must be a valid UUID" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Soft delete via a security-definer RPC (see soft_delete_comment in
    // scripts/supabase-schema.sql) rather than a plain RLS-gated UPDATE —
    // the declarative UPDATE policy did not reliably allow this even with
    // an explicit, verified-correct WITH CHECK clause.
    const { data, error } = await supabase.rpc("soft_delete_comment", { comment_id });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Comment not found or you don't have permission to delete it" }, { status: 404 });

    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
