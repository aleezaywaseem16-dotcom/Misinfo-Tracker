import { NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  const systemPrompt = `You are a professional misinformation analyst. Analyze the provided claim and return ONLY a valid JSON object with no other text. The JSON must have exactly these fields:
- verdict: one of "TRUE", "FALSE", "MISLEADING", or "UNVERIFIED"
- confidence: integer 0-100 representing how confident you are
- explanation: 2-3 sentence explanation of your verdict
- reasoning: array of exactly 3 short bullet point strings (each under 20 words)

Base your analysis solely on the claim title and description. If you cannot determine truthfulness with reasonable confidence, use "UNVERIFIED". Return only the JSON object, nothing else.`;

  const userMessage = `Claim title: ${title}\n\nDescription: ${description || "No description provided."}`;

  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 450,
    temperature: 0.3,
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
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
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await response.json().catch(() => ({}));
    const text: string = data?.choices?.[0]?.message?.content ?? "";

    let parsed: { verdict?: string; confidence?: unknown; explanation?: string; reasoning?: unknown } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    const validVerdicts = ["TRUE", "FALSE", "MISLEADING", "UNVERIFIED"];
    const verdict = validVerdicts.includes(parsed.verdict ?? "") ? parsed.verdict! : "UNVERIFIED";
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
        : 50;
    const explanation =
      typeof parsed.explanation === "string" ? parsed.explanation : "No explanation available.";
    const reasoning = Array.isArray(parsed.reasoning)
      ? (parsed.reasoning as unknown[]).slice(0, 3).map(String)
      : [];

    return NextResponse.json({ verdict, confidence, explanation, reasoning });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "AI request timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
