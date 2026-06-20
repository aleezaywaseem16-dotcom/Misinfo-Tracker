import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeText, isValidUUID } from "@/lib/sanitize";

const VALID_VISIBILITIES = ["public", "private"] as const;

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { claim_id, title, description, category_id, visibility, estimated_origin_at } = body as {
      claim_id: unknown; title: unknown; description: unknown; category_id: unknown;
      visibility: unknown; estimated_origin_at: unknown;
    };

    if (typeof claim_id !== "string" || !isValidUUID(claim_id)) {
      return NextResponse.json({ error: "claim_id must be a valid UUID" }, { status: 400 });
    }
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const safeTitle = sanitizeText(title.trim());
    const safeDescription = typeof description === "string" && description.trim() ? sanitizeText(description.trim()) : null;
    const safeCategoryId = typeof category_id === "string" && isValidUUID(category_id) ? category_id : null;
    const safeVisibility = typeof visibility === "string" && (VALID_VISIBILITIES as readonly string[]).includes(visibility)
      ? (visibility as "public" | "private") : "public";

    let safeOriginAt: string | null = null;
    if (typeof estimated_origin_at === "string" && estimated_origin_at) {
      const parsed = new Date(estimated_origin_at);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "estimated_origin_at must be a valid date" }, { status: 400 });
      }
      if (parsed.getTime() > Date.now()) {
        return NextResponse.json({ error: "Estimated origin date cannot be in the future" }, { status: 400 });
      }
      safeOriginAt = estimated_origin_at;
    }

    const { data, error } = await supabase.rpc("update_claim", {
      p_claim_id: claim_id,
      p_title: safeTitle,
      p_description: safeDescription,
      p_category_id: safeCategoryId,
      p_visibility: safeVisibility,
      p_estimated_origin_at: safeOriginAt,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    return NextResponse.json({ updated: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
