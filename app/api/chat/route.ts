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
  const systemPrompt = `You are a knowledgeable, conversational AI assistant specializing in misinformation analysis, fact-checking, and media literacy. You can answer:
- General questions about how misinformation spreads, common patterns, and red flags to watch for
- Fact-checking methodologies, source evaluation, and evidence credibility
- Analysis of specific claims when details are provided by the user
- Platform workflow guidance (watchlists, evidence submission, confidence scores)
- Media literacy education and critical thinking techniques

Always provide a helpful, substantive answer. Never reply with "I need more context" or "please provide claim details" — if specific context is missing, give a thorough general educational answer about the topic. Be direct and conversational.

Return ONLY a valid JSON object with exactly these fields:
{
  "response": "your full conversational answer here (1-4 paragraphs)",
  "confidence": null,
  "sourceUrl": null
}`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    max_tokens: 700,
    temperature: 0.65,
    response_format: { type: "json_object" },
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
  const raw: string = data?.choices?.[0]?.message?.content ?? "";

  let parsed: { response?: string; confidence?: string | number | null; sourceUrl?: string | null } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { response: raw || "I couldn't generate a response." };
  }

  const responseText = typeof parsed.response === "string" && parsed.response.trim()
    ? parsed.response.trim()
    : "I couldn't generate a response.";

  return NextResponse.json({ response: responseText, confidence: parsed.confidence ?? null, sourceUrl: parsed.sourceUrl ?? null });
}

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;
  return NextResponse.json({
    configured: !!apiKey,
    model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
  });
}
