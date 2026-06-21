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
  const systemPrompt = `You are a helpful and concise misinformation analysis assistant. Answer questions about claim confidence, evidence strength, watchlist alerts, and fact-checking workflow. If the user asks for a summary, keep it clear and actionable. Do not invent unsupported facts.
When you produce the final answer, append a JSON object on a new line containing the following keys: \n- response: the assistant text summary (string)\n- confidence: an optional confidence label or percent (string or number)\n- sourceUrl: an optional primary source URL you used (string).\nReturn valid JSON on that final line when possible.`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    max_tokens: 450,
    temperature: 0.7,
  };
  // Abort if Groq does not respond in a reasonable time
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

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
  const text = data?.choices?.[0]?.message?.content ?? "I couldn't generate a response.";

  // Try to extract a JSON object from the assistant output (last JSON line)
  let parsed: { response?: string; confidence?: string | number; sourceUrl?: string } = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}$/m);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
      // If parsed.response is missing, use the remaining text (without the JSON tail)
      if (!parsed.response) {
        const trimmed = text.replace(jsonMatch[0], "").trim();
        parsed.response = trimmed || parsed.response || "I couldn't generate a response.";
      }
    } else {
      // No JSON found — return the raw assistant text
      parsed.response = text;
    }
  } catch {
    parsed.response = text;
  }

  return NextResponse.json({ response: parsed.response, confidence: parsed.confidence ?? null, sourceUrl: parsed.sourceUrl ?? null });
}

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;
  return NextResponse.json({
    configured: !!apiKey,
    model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
  });
}
