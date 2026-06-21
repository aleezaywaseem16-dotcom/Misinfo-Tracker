import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/sanitize";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { evidence_id } = body as { evidence_id: unknown };

    if (typeof evidence_id !== "string" || !isValidUUID(evidence_id)) {
      return NextResponse.json({ error: "evidence_id must be a valid UUID" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Soft delete via a security-definer RPC (see soft_delete_evidence in
    // scripts/supabase-schema.sql) — same approach as comments/delete and
    // claims/delete.
    const { data, error } = await supabase.rpc("soft_delete_evidence", { p_evidence_id: evidence_id });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Evidence item not found or you don't have permission to delete it" }, { status: 404 });

    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
