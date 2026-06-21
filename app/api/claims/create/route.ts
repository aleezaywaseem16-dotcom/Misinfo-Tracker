import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeText, sanitizeUrl, isValidUUID } from "@/lib/sanitize";

const VALID_SOURCE_TYPES = ["link", "document", "image", "text"] as const;
const VALID_VISIBILITIES = ["public", "private"] as const;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, visibility, category_id, estimated_origin_at, sourceUrl, sourceType, selectedTags } = body as {
      title: unknown; description: unknown; visibility: unknown; category_id: unknown;
      estimated_origin_at: unknown; sourceUrl: unknown; sourceType: unknown; selectedTags: unknown;
    };

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (typeof sourceUrl !== "string" || !sourceUrl.trim()) {
      return NextResponse.json({ error: "Source is required" }, { status: 400 });
    }

    const safeTitle = sanitizeText(title.trim());
    const safeDescription = typeof description === "string" && description.trim() ? sanitizeText(description.trim()) : null;

    const safeVisibility = typeof visibility === "string" && (VALID_VISIBILITIES as readonly string[]).includes(visibility)
      ? (visibility as "public" | "private") : "public";
    const safeSourceType = typeof sourceType === "string" && (VALID_SOURCE_TYPES as readonly string[]).includes(sourceType)
      ? (sourceType as (typeof VALID_SOURCE_TYPES)[number]) : "link";
    const safeCategoryId = typeof category_id === "string" && isValidUUID(category_id) ? category_id : null;

    // "text" sources are typed content, not a link — every other type
    // (link/document/image) is a real URL, validated as such.
    const safeSource = safeSourceType === "text" ? sanitizeText(sourceUrl.trim()) : sanitizeUrl(sourceUrl.trim());
    if (!safeSource) {
      return NextResponse.json(
        { error: safeSourceType === "text" ? "Source text cannot be empty" : "Source must be a valid http/https URL" },
        { status: 400 }
      );
    }

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

    const { data: claim, error: claimErr } = await supabase
      .from("claims")
      .insert({
        title: safeTitle,
        description: safeDescription,
        visibility: safeVisibility,
        category_id: safeCategoryId,
        estimated_origin_at: safeOriginAt,
        source_url: safeSource,
        source_type: safeSourceType,
        created_by: user.id,
        status: "unverified",
      })
      .select().single();

    if (claimErr || !claim) return NextResponse.json({ error: claimErr?.message ?? "Failed to create claim" }, { status: 500 });

    if (Array.isArray(selectedTags) && selectedTags.length > 0) {
      const validTagIds = (selectedTags as unknown[]).filter((t): t is string => typeof t === "string" && isValidUUID(t));
      if (validTagIds.length > 0) {
        const { error: tagErr } = await supabase
          .from("claim_tags")
          .insert(validTagIds.map((tag_id) => ({ claim_id: claim.id, tag_id, added_by: user.id })));
        if (tagErr) console.error("Failed to attach tags to claim:", tagErr.message);
      }
    }

    return NextResponse.json({ claim });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
