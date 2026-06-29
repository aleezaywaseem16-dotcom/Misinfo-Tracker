"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface WatchedClaim {
  id: string;
  title: string;
  status: string;
  visibility: string;
  estimated_origin_at: string | null;
  created_at: string;
  profiles: { display_name: string; username: string } | null;
  categories: { name: string } | null;
}

interface WatchlistRow {
  claim_id: string;
  created_at: string;
  claims: WatchedClaim | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function WatchlistPage() {
  const router = useRouter();
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/watchlist");
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? "Failed to load watchlist");
      setRows((payload.watchlist ?? []) as WatchlistRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await load();
    }
    init();
  }, [router, load]);

  async function handleRemove(claimId: string) {
    setRemovingId(claimId);
    setError("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? "Failed to remove claim");
      setRows((prev) => prev.filter((row) => row.claim_id !== claimId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove claim from watchlist.");
    } finally {
      setRemovingId(null);
    }
  }

  const alertCount = rows.filter((row) => row.claims && ["investigating", "disputed", "confirmed"].includes(row.claims.status)).length;

  return (
    <div className="page-content" style={{ minHeight: "100vh" }}>
      <Navbar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "clamp(20px, 5vw, 36px) clamp(20px, 4vw, 64px) 48px" }}>

        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: "none", fontSize: "0.82rem", padding: "4px 0", display: "inline-flex", gap: "6px" }}>
            ← Back to dashboard
          </Link>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Tracked claims</div>
              <h1 className="font-display" style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
                Watchlist
              </h1>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                {rows.length} watching
              </div>
              {alertCount > 0 && (
                <div style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent-border)", background: "var(--accent-dim)", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                  {alertCount} alert{alertCount > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: "var(--radius-sm)" }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p style={{ marginBottom: 16 }}>You aren&apos;t watching any claims yet.</p>
            <Link href="/claims" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
              Browse claims
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map((row) => {
              const claim = row.claims;
              if (!claim) return null;
              return (
                <div key={row.claim_id} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <Link href={`/claims/${claim.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span className={`status-pill status-${claim.status}`}>
                        <span className="status-dot" />
                        {claim.status}
                      </span>
                      {claim.categories && (
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                          {claim.categories.name}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {claim.title}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                      <span
                        onClick={(e) => { if (claim.profiles?.username) { e.preventDefault(); e.stopPropagation(); router.push(`/users/${claim.profiles.username}`); } }}
                        style={{ cursor: claim.profiles?.username ? "pointer" : "default" }}
                      >
                        @{claim.profiles?.username ?? "unknown"}
                      </span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span title={new Date(row.created_at).toLocaleString()}>Watched {timeAgo(row.created_at)}</span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemove(row.claim_id)}
                    disabled={removingId === row.claim_id}
                    className="btn-secondary"
                    style={{ fontSize: "0.78rem", padding: "7px 14px", flexShrink: 0, opacity: removingId === row.claim_id ? 0.5 : 1 }}
                  >
                    {removingId === row.claim_id ? "Removing..." : "Remove"}
                  </button>
                </div>
              );
            })}
            {rows.length > 0 && rows.length < 3 && (
              <div className="card" style={{ padding: "20px 22px", border: "1px dashed rgba(0,255,136,0.25)", background: "rgba(0,255,136,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Track more claims</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0" }}>Browse claims and click &ldquo;Add to Watchlist&rdquo; to monitor them here.</p>
                </div>
                <Link href="/claims" className="btn-primary" style={{ textDecoration: "none", fontSize: "0.82rem", padding: "8px 18px", flexShrink: 0 }}>
                  Browse Claims →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
