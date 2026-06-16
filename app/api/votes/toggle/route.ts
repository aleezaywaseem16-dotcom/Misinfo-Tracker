import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/sanitize";

const VALID_VOTE_TYPES = ["upvote", "downvote"] as const;
type VoteType = (typeof VALID_VOTE_TYPES)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { claim_id, vote_type } = body as { claim_id: unknown; vote_type: unknown };

    if (typeof claim_id !== "string" || !isValidUUID(claim_id)) {
      return NextResponse.json({ error: "claim_id must be a valid UUID" }, { status: 400 });
    }
    if (typeof vote_type !== "string" || !(VALID_VOTE_TYPES as readonly string[]).includes(vote_type)) {
      return NextResponse.json({ error: "vote_type must be 'upvote' or 'downvote'" }, { status: 400 });
    }
    const safeVoteType = vote_type as VoteType;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: existing, error: selectErr } = await supabase
      .from("claim_votes")
      .select("id, vote_type")
      .eq("claim_id", claim_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (selectErr) return NextResponse.json({ error: selectErr.message }, { status: 500 });

    if (existing) {
      await supabase.from("claim_votes").delete().eq("id", existing.id);
      if (existing.vote_type !== safeVoteType) {
        await supabase.from("claim_votes").insert({ claim_id, user_id: user.id, vote_type: safeVoteType });
      }
    } else {
      await supabase.from("claim_votes").insert({ claim_id, user_id: user.id, vote_type: safeVoteType });
    }

    const { data: allVotes } = await supabase.from("claim_votes").select("vote_type").eq("claim_id", claim_id);
    const votes = (allVotes ?? []) as Array<{ vote_type: string }>;

    return NextResponse.json({
      upvotes: votes.filter((v) => v.vote_type === "upvote").length,
      downvotes: votes.filter((v) => v.vote_type === "downvote").length,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
