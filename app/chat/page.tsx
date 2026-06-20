"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  confidence?: string | number | null;
  sourceUrl?: string | null;
}

const initialMessages: ChatMessage[] = [
  { role: "assistant", text: "Hello! Ask me about a claim, evidence item, confidence score, or what to monitor next." },
];

const quickPrompts = [
  "Summarize the latest evidence for a claim.",
  "Why is this claim considered high risk?",
  "What should I watch in the watchlist next?",
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return initialMessages;
    try {
      const stored = window.localStorage.getItem("misinfo-chat-history");
      if (!stored) return initialMessages;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item.role === "string" && typeof item.text === "string")) {
        return parsed as ChatMessage[];
      }
    } catch { /* ignore */ }
    return initialMessages;
  });
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [groqModel, setGroqModel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
      else setCheckingAuth(false);
    });
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const toStore = messages.slice(-50);
    try {
      window.localStorage.setItem("misinfo-chat-history", JSON.stringify(toStore));
    } catch {
      window.localStorage.removeItem("misinfo-chat-history");
    }
  }, [messages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/chat", { method: "GET" });
        if (!mounted) return;
        if (!res.ok) { setAiConfigured(false); return; }
        const payload = await res.json().catch(() => null);
        setAiConfigured(Boolean(payload?.configured));
        setGroqModel(payload?.model ?? null);
      } catch {
        if (!mounted) return;
        setAiConfigured(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleSend(message: string) {
    if (!message.trim()) return;
    setError("");
    const userMessage = message.trim();
    setMessages((current) => [...current, { role: "user", text: userMessage }]);
    setInput("");
    setSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "AI service returned an error.");
      }
      const payload = await response.json();
      setMessages((current) => [...current, {
        role: "assistant",
        text: payload.response ?? "I couldn't generate a response.",
        confidence: payload.confidence ?? null,
        sourceUrl: payload.sourceUrl ?? null,
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to contact the chat service.");
      setMessages((current) => [...current, { role: "assistant", text: "I couldn't connect to the chat service. Please check configuration." }]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSend(input);
  }

  if (checkingAuth) return (
    <div className="page-content" style={{ minHeight: "100vh" }}>
      <Navbar />
      <div className="page-spinner-wrap">
        <div className="page-spinner" />
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ minHeight: "100vh" }}>
      <Navbar />
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "clamp(20px, 5vw, 36px) clamp(20px, 4vw, 64px) 48px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", marginBottom: "32px", flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: "10px" }}>AI Assistant</div>
            <h1 className="font-display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
              Misinformation Support Chat
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px", maxWidth: "520px", lineHeight: 1.7, fontSize: "0.9rem" }}>
              Use the assistant to explore claim confidence, evidence strength, watchlist alerts, or investigation recommendations.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px" }}>
              {aiConfigured === true && (
                <span className="hero-badge" style={{ color: "var(--verified)", borderColor: "rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)" }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
                  Groq AI connected
                </span>
              )}
              {aiConfigured === false && (
                <span className="hero-badge" style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)" }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
                  Groq disconnected
                </span>
              )}
              {aiConfigured === null && (
                <span className="hero-badge" style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "transparent" }}>
                  Checking status…
                </span>
              )}
              {groqModel && (
                <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", padding: "3px 8px" }}>
                  {groqModel}
                </span>
              )}
            </div>
          </div>
          <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", flexShrink: 0 }}>
            ← Dashboard
          </Link>
        </div>

        {/* Main grid: chat + sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]" style={{ alignItems: "start" }}>

          {/* Chat panel */}
          <div className="card" style={{ padding: "24px 28px" }}>
            <div className="chat-window" style={{ minHeight: "480px" }}>
              {messages.map((message: ChatMessage, index) => (
                <div key={`${message.role}-${index}`} className={`message-bubble ${message.role}`}>
                  <span className="message-label">{message.role === "user" ? "You" : "Assistant"}</span>
                  <p>{message.text}</p>
                  {message.confidence && (
                    <div className="mono" style={{ marginTop: "8px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Confidence: {message.confidence}
                    </div>
                  )}
                  {message.sourceUrl && (
                    <a href={message.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: "0.85rem", marginTop: "8px", display: "inline-block" }}>
                      View primary source →
                    </a>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} style={{ marginTop: "18px" }}>
              <label htmlFor="chat-input" className="sr-only">Ask the assistant</label>
              <textarea
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                rows={4}
                placeholder="Ask something like: 'Summarize the strongest evidence for the top claim.'"
                className="input-field"
                style={{ width: "100%" }}
                disabled={sending}
              />
              <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  {quickPrompts.map((prompt) => (
                    <button key={prompt} type="button" className="filter-chip" onClick={() => handleSend(prompt)} disabled={sending} style={{ fontSize: "0.7rem" }}>
                      {prompt}
                    </button>
                  ))}
                </div>
                <button type="submit" className="btn-primary" disabled={sending || !input.trim()}>
                  {sending ? "Thinking..." : "Send"}
                </button>
              </div>
              {error && <p style={{ color: "var(--danger)", marginTop: "10px", fontSize: "0.85rem" }}>{error}</p>}
            </form>
          </div>

          {/* Sidebar */}
          <aside style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="card" style={{ padding: "18px 20px" }}>
              <div className="eyebrow" style={{ marginBottom: "10px" }}>How it helps</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                <p>Ask the assistant for claim summaries, risk explanations, evidence insight, and watchlist guidance.</p>
                <p>Designed to support analyst workflows by highlighting what to investigate next and why a claim may be trending.</p>
                <p>For the strongest result, mention the claim or evidence directly in your question.</p>
              </div>
            </div>

            {aiConfigured === false && (
              <div className="card" style={{ padding: "18px 20px", borderLeft: "3px solid var(--warning)" }}>
                <div className="eyebrow" style={{ marginBottom: "8px", color: "var(--warning)" }}>Configuration</div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  Set <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--accent)", background: "var(--bg-inset)", padding: "1px 5px", borderRadius: "2px" }}>GROQ_API_KEY</code> in your environment to connect the AI assistant.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setMessages(initialMessages); window.localStorage.removeItem("misinfo-chat-history"); }}
              className="btn-secondary"
              style={{ width: "100%", justifyContent: "center", fontSize: "0.8rem" }}
            >
              Clear chat history
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
