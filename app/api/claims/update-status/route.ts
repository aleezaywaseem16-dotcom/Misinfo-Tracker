import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/sanitize";

const VALID_STATUSES = ["unverified","investigating","confirmed","debunked","disputed","archived"] as const;
type ClaimStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { claim_id, status } = body as { claim_id: unknown; status: unknown };
    if (typeof claim_id !== "string" || !isValidUUID(claim_id)) return NextResponse.json({ error: "claim_id must be a valid UUID" }, { status: 400 });
    if (typeof status !== "string" || !(VALID_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    const safeStatus = status as ClaimStatus;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("roles ( name )").eq("id", user.id).maybeSingle();
    const roleName = (profile as { roles: { name: string } | null } | null)?.roles?.name;
    if (roleName !== "admin") return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    const { data: claim, error: updateErr } = await supabase.from("claims").update({ status: safeStatus, updated_at: new Date().toISOString() }).eq("id", claim_id).select("id, title, status").single();
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ claim });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
