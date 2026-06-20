"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/dashboard");
      else setCheckingSession(false);
    });
  }, [router]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  async function handleGoogleSignup() {
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) setError(err.message);
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="card animate-fade-up" style={{ width: "100%", maxWidth: "420px", padding: "40px 36px", position: "relative", zIndex: 1 }}>
        <Link href="/" className="btn-ghost" style={{ textDecoration: "none", fontSize: "0.78rem", padding: "4px 0", display: "inline-flex", gap: "6px", marginBottom: "20px" }}>
          ← Back to home
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "2px",
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Space Mono', monospace", fontSize: "12px", fontWeight: 700,
            color: "#070a00", letterSpacing: "-0.02em", userSelect: "none", flexShrink: 0,
          }}>
            MT
          </div>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-primary)" }}>
            <span style={{ color: "var(--accent)" }}>[</span>MISINFO<span style={{ color: "var(--accent)" }}>TRACKER]</span>
          </span>
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>Create your account</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "28px" }}>No password needed — we&apos;ll email you a secure sign-in link, and your account is created automatically on first sign-in.</p>

        {sent ? (
          <div style={{ background: "rgba(190,242,100,0.06)", border: "1px solid rgba(190,242,100,0.22)", borderRadius: "2px", padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📬</div>
            <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: "8px" }}>Check your inbox</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>We sent a sign-up link to <strong style={{ color: "var(--text-secondary)" }}>{email}</strong>.</p>
            <button onClick={() => setSent(false)} style={{ marginTop: "16px", background: "none", border: "none", color: "var(--accent)", fontSize: "0.875rem", cursor: "pointer", textDecoration: "underline" }}>
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input-field" style={{ width: "100%" }} autoComplete="email" autoFocus />
              </div>
              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderLeft: "3px solid var(--danger)", borderRadius: "var(--radius-xs)", padding: "10px 14px", fontSize: "0.875rem", color: "var(--danger)" }}>{error}</div>
              )}
              <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", justifyContent: "center", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Sending link..." : "Create account"}
              </button>
            </form>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            </div>
            <button onClick={handleGoogleSignup} className="btn-ghost" style={{ width: "100%", justifyContent: "center", gap: "10px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Already have an account? <Link href="/login" style={{ color: "var(--accent)", textDecoration: "underline" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPageWrapper() {
  return (
    <Suspense>
      <SignupPage />
    </Suspense>
  );
}
