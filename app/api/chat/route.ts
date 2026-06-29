import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export async function POST(request: Request) {
  // This calls a paid third-party API on every request — without an auth
  // check, anyone (including unauthenticated, scripted requests) could call
  // it directly and burn through the GROQ_API_KEY quota at no cost to them.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI service key is not configured. Set GROQ_API_KEY in your environment to enable the chat assistant.",
      },
      { status: 500 }
    );
  }

  const model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;
  const systemPrompt = `You are a helpful AI assistant embedded in a misinformation tracking platform. Answer the user's question directly and conversationally in 2–4 paragraphs.

Topics you cover: how misinformation spreads, fact-checking methods, source credibility, media literacy, recognising propaganda techniques, platform features (watchlists, evidence, confidence scores).

Rules:
- Give a real, substantive answer every single time.
- If the question is vague or lacks context, answer it as a general educational question on that topic — never ask the user to "provide claim details" or say you "need more context".
- Be direct, clear, and informative. No filler phrases.`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    max_tokens: 700,
    temperature: 0.7,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!response.ok) {
    const errorBody = await response.text();
    return NextResponse.json(
      { error: `AI service error: ${response.status} ${response.statusText}. ${errorBody}` },
      { status: 502 }
    );
  }

  const data = await response.json().catch(() => ({}));
  const responseText: string = (data?.choices?.[0]?.message?.content ?? "").trim() || "I couldn't generate a response.";

  return NextResponse.json({ response: responseText, confidence: null, sourceUrl: null });
}

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;
  return NextResponse.json({
    configured: !!apiKey,
    model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
  });
}
