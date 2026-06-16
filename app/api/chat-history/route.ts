import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeText, sanitizeUrl, isValidUUID } from "@/lib/sanitize";

const MAX_HISTORY_ROWS = 100;

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    let query = supabase
      .from("user_chat_history")
      .select("id, chat_session_id, role, content, confidence, source_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (sessionId && isValidUUID(sessionId)) {
      query = query.eq("chat_session_id", sessionId);
    }

    const { data, error } = await query.limit(MAX_HISTORY_ROWS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chat_session_id, role, content, confidence, source_url } = body as {
      chat_session_id: unknown; role: unknown; content: unknown; confidence: unknown; source_url: unknown;
    };

    if (typeof chat_session_id !== "string" || !isValidUUID(chat_session_id)) {
      return NextResponse.json({ error: "chat_session_id must be a valid UUID" }, { status: 400 });
    }
    if (role !== "user" && role !== "assistant") {
      return NextResponse.json({ error: "role must be 'user' or 'assistant'" }, { status: 400 });
    }
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { count } = await supabase
      .from("user_chat_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= MAX_HISTORY_ROWS) {
      const overflow = (count ?? 0) - MAX_HISTORY_ROWS + 1;
      const { data: oldest } = await supabase
        .from("user_chat_history")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(overflow);
      if (oldest && oldest.length > 0) {
        await supabase.from("user_chat_history").delete().in("id", oldest.map((r: { id: string }) => r.id));
      }
    }

    const { data: message, error } = await supabase
      .from("user_chat_history")
      .insert({
        user_id: user.id,
        chat_session_id,
        role,
        content: sanitizeText(content.trim()),
        confidence: typeof confidence === "string" || typeof confidence === "number" ? String(confidence).slice(0, 50) : null,
        source_url: typeof source_url === "string" ? sanitizeUrl(source_url) || null : null,
      })
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { session_id } = body as { session_id?: unknown };

    let query = supabase.from("user_chat_history").delete().eq("user_id", user.id);
    if (typeof session_id === "string" && isValidUUID(session_id)) {
      query = query.eq("chat_session_id", session_id);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cleared: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
