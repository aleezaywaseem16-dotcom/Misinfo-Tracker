import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "40px 24px",
      background: "var(--bg-base)",
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "4rem", fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "20px" }}>
        404
      </div>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: "10px" }}>
        Page not found
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "32px", maxWidth: "380px", lineHeight: 1.7, fontSize: "0.9rem" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 24px", background: "var(--accent)", color: "#070a00", fontWeight: 700, fontSize: "0.875rem", borderRadius: "4px", textDecoration: "none" }}>
        Go to Dashboard
      </Link>
    </div>
  );
}
