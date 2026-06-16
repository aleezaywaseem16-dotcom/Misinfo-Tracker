"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[GlobalError]", error); }, [error]);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 24px", background: "var(--bg-base)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.14em", color: "var(--danger)", textTransform: "uppercase", marginBottom: "16px", border: "1px solid rgba(248,113,113,0.25)", padding: "4px 12px", borderRadius: "2px" }}>
        System error
      </div>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "10px" }}>
        Something went wrong
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "32px", maxWidth: "400px", lineHeight: 1.7, fontSize: "0.9rem" }}>
        An unexpected error occurred. You can try again or return to the dashboard.
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={reset} style={{ padding: "10px 24px", background: "var(--accent)", color: "#070a00", fontWeight: 700, fontSize: "0.875rem", borderRadius: "4px", border: "none", cursor: "pointer" }}>
          Try again
        </button>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", padding: "10px 24px", background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.875rem", borderRadius: "4px", textDecoration: "none" }}>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
