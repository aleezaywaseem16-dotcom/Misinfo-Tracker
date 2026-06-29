"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Stats { claims: number; users: number; evidence: number; comments: number; }
interface RecentClaim { id: string; title: string; status: string; created_at: string; }
interface RecentEvidence {
  id: string; title: string | null; content: string | null; created_at: string;
  claim_id: string; profiles: { display_name: string; username: string } | null;
}
interface RecentComment {
  id: string; content: string; created_at: string; claim_id: string;
  profiles: { display_name: string; username: string } | null;
}

const VALID_STATUSES = ["unverified","investigating","confirmed","debunked","disputed","archived"] as const;

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ claims: 0, users: 0, evidence: 0, comments: 0 });
  const [recentClaims, setRecentClaims] = useState<RecentClaim[]>([]);
  const [recentEvidence, setRecentEvidence] = useState<RecentEvidence[]>([]);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [confirmModal, setConfirmModal] = useState<{ id: string; title: string; type: 'claim' | 'evidence' | 'comment' } | null>(null);

  useEffect(() => {
    async function loadAll() {
      const [
        { count: claims },
        { count: users },
        { count: evidence },
        { count: comments },
        { data: recent },
        { data: evidenceRows },
        { data: commentRows },
      ] = await Promise.all([
        supabase.from("claims").select("*", { count: "exact", head: true }).eq("visibility", "public").is("deleted_at", null),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("evidence").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("comments").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("claims").select("id, title, status, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
        supabase.from("evidence").select(`id, title, content, created_at, claim_id, profiles!evidence_created_by_fkey ( display_name, username )`).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
        supabase.from("comments").select(`id, content, created_at, claim_id, profiles!comments_created_by_fkey ( display_name, username )`).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
      ]);
      setStats({ claims: claims ?? 0, users: users ?? 0, evidence: evidence ?? 0, comments: comments ?? 0 });
      setRecentClaims((recent as RecentClaim[]) ?? []);
      setRecentEvidence((evidenceRows as unknown as RecentEvidence[]) ?? []);
      setRecentComments((commentRows as unknown as RecentComment[]) ?? []);
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

  async function handleDeleteClaim(claimId: string) {
    setDeleteError("");
    setDeletingId(claimId);
    try {
      const res = await fetch("/api/claims/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? "Failed to delete claim");
      setRecentClaims((prev) => prev.filter((c) => c.id !== claimId));
      setStats((prev) => ({ ...prev, claims: Math.max(0, prev.claims - 1) }));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete claim.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteEvidence(evidenceId: string) {
    setDeleteError("");
    setDeletingId(evidenceId);
    try {
      const res = await fetch("/api/evidence/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence_id: evidenceId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? "Failed to delete evidence");
      setRecentEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
      setStats((prev) => ({ ...prev, evidence: Math.max(0, prev.evidence - 1) }));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete evidence.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteComment(commentId: string) {
    setDeleteError("");
    setDeletingId(commentId);
    try {
      const res = await fetch("/api/comments/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: commentId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? "Failed to delete comment");
      setRecentComments((prev) => prev.filter((c) => c.id !== commentId));
      setStats((prev) => ({ ...prev, comments: Math.max(0, prev.comments - 1) }));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete comment.");
    } finally {
      setDeletingId(null);
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

        {deleteError && (
          <div className="error-banner" style={{ marginBottom: '16px' }}>
            {deleteError}
          </div>
        )}

        <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
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
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ id: claim.id, title: claim.title, type: 'claim' })}
                    disabled={deletingId === claim.id}
                    className="btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '4px 10px', flexShrink: 0, color: 'var(--danger)', opacity: deletingId === claim.id ? 0.5 : 1 }}
                  >
                    {deletingId === claim.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Recent evidence</h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '10px' }} />)}
            </div>
          ) : recentEvidence.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No evidence yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentEvidence.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <Link href={`/claims/${item.claim_id}`} style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title ?? item.content ?? 'Untitled evidence'}
                  </Link>
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {item.profiles?.username ? `@${item.profiles.username}` : '@unknown'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ id: item.id, title: item.title ?? item.content ?? 'this evidence item', type: 'evidence' })}
                    disabled={deletingId === item.id}
                    className="btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '4px 10px', flexShrink: 0, color: 'var(--danger)', opacity: deletingId === item.id ? 0.5 : 1 }}
                  >
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Recent comments</h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '10px' }} />)}
            </div>
          ) : recentComments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No comments yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentComments.map((comment) => (
                <div key={comment.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <Link href={`/claims/${comment.claim_id}`} style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {comment.content}
                  </Link>
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {comment.profiles?.username ? `@${comment.profiles.username}` : '@unknown'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ id: comment.id, title: comment.content.slice(0, 60) + (comment.content.length > 60 ? '…' : ''), type: 'comment' })}
                    disabled={deletingId === comment.id}
                    className="btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '4px 10px', flexShrink: 0, color: 'var(--danger)', opacity: deletingId === comment.id ? 0.5 : 1 }}
                  >
                    {deletingId === comment.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(248,113,113,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" fill="none" stroke="var(--danger)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Delete {confirmModal.type}?</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
              Are you sure you want to delete this {confirmModal.type}?{' '}
              <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>
                &ldquo;{confirmModal.title.slice(0, 80)}{confirmModal.title.length > 80 ? '…' : ''}&rdquo;
              </span>
              <br />
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>This cannot be undone.</span>
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center', background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={async () => {
                  const { id, type } = confirmModal;
                  setConfirmModal(null);
                  if (type === 'claim') await handleDeleteClaim(id);
                  else if (type === 'evidence') await handleDeleteEvidence(id);
                  else await handleDeleteComment(id);
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
