"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Stats { claims: number; users: number; evidence: number; comments: number; }
interface RecentClaim { id: string; title: string; status: string; created_at: string; }

const VALID_STATUSES = ["unverified","investigating","confirmed","debunked","disputed","archived"] as const;

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ claims: 0, users: 0, evidence: 0, comments: 0 });
  const [recentClaims, setRecentClaims] = useState<RecentClaim[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    async function loadAll() {
      const [
        { count: claims },
        { count: users },
        { count: evidence },
        { count: comments },
        { data: recent },
      ] = await Promise.all([
        supabase.from("claims").select("*", { count: "exact", head: true }).eq("visibility", "public").is("deleted_at", null),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("evidence").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("comments").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("claims").select("id, title, status, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
      ]);
      setStats({ claims: claims ?? 0, users: users ?? 0, evidence: evidence ?? 0, comments: comments ?? 0 });
      setRecentClaims((recent as RecentClaim[]) ?? []);
      setLoading(false);
    }
    void loadAll();
  }, []);

  async function handleStatusChange(claimId: string, newStatus: string) {
    setUpdating(claimId);
    setStatusError("");
    try {
      const res = await fetch("/api/claims/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId, status: newStatus }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? "Failed to update status");
      setRecentClaims((prev) =>
        prev.map((c) => c.id === claimId ? { ...c, status: newStatus } : c)
      );
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setUpdating(null);
    }
  }

  const cards = [
    { label: "Total Claims",   value: stats.claims   },
    { label: "Users",          value: stats.users     },
    { label: "Evidence Items", value: stats.evidence  },
    { label: "Comments",       value: stats.comments  },
  ];

  return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(20px, 6vw, 40px) clamp(20px, 4vw, 64px)' }}>
        <div style={{ marginBottom: '32px' }}>
          <div className="hero-badge" style={{ marginBottom: '12px' }}>
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            Admin Panel
          </div>
          <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>Platform Overview</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>Monitor activity and manage platform content.</p>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '14px' }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            {cards.map((c) => (
              <div key={c.label} className="stat-card">
                <div className="font-display" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{c.value.toLocaleString()}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Quick actions</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <Link href="/claims" className="btn-secondary" style={{ textDecoration: 'none' }}>View all claims</Link>
            <Link href="/claims/new" className="btn-primary" style={{ textDecoration: 'none' }}>New claim</Link>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Recent claims</h2>
          {statusError && (
            <div className="error-banner" style={{ marginBottom: '14px' }}>
              {statusError}
            </div>
          )}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '10px' }} />)}
            </div>
          ) : recentClaims.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No claims yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentClaims.map((claim) => (
                <div key={claim.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <Link href={`/claims/${claim.id}`} style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {claim.title}
                  </Link>
                  <span className={`status-pill status-${claim.status}`} style={{ flexShrink: 0 }}>
                    <span className="status-dot" />
                    {claim.status}
                  </span>
                  <select
                    value={claim.status}
                    disabled={updating === claim.id}
                    onChange={(e) => void handleStatusChange(claim.id, e.target.value)}
                    className="input-field"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', flexShrink: 0, opacity: updating === claim.id ? 0.5 : 1 }}
                  >
                    {VALID_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
