import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/sanitize";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { claim_id } = body as { claim_id: unknown };

    if (typeof claim_id !== "string" || !isValidUUID(claim_id)) {
      return NextResponse.json({ error: "claim_id must be a valid UUID" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Soft delete via a security-definer RPC (see soft_delete_claim in
    // scripts/supabase-schema.sql) — same approach as comments/delete,
    // for the same reason: the declarative DELETE policy is not reliably
    // enforced via a plain RLS-gated call in this database.
    const { data, error } = await supabase.rpc("soft_delete_claim", { p_claim_id: claim_id });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Claim not found or you don't have permission to delete it" }, { status: 404 });

    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
