"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import DatePicker from "@/components/DatePicker";

interface Category { id: string; name: string; }

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function EditClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    visibility: "public",
    category_id: "",
    estimated_origin_at: "",
  });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: claim } = await supabase
        .from("claims")
        .select("title, description, visibility, category_id, estimated_origin_at, created_by")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (!claim) { setNotFound(true); setLoading(false); return; }
      if (claim.created_by !== user.id) { setForbidden(true); setLoading(false); return; }

      setForm({
        title: claim.title ?? "",
        description: claim.description ?? "",
        visibility: claim.visibility ?? "public",
        category_id: claim.category_id ?? "",
        estimated_origin_at: toDateInputValue(claim.estimated_origin_at),
      });

      const { data: cats } = await supabase.from("categories").select("id, name").is("deleted_at", null);
      setCategories(cats ?? []);
      setLoading(false);
    }
    init();
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }

    setSubmitting(true);
    setError("");

    const res = await fetch('/api/claims/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: id, ...form }),
    });
    const payload = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok || payload?.error) {
      setError(payload?.error ?? 'Failed to update claim.');
      return;
    }
    router.push(`/claims/${id}`);
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  if (loading) {
    return (
      <div className="page-content" style={{ minHeight: "100vh" }}>
        <Navbar />
        <div className="page-spinner-wrap">
          <div className="page-spinner" />
        </div>
      </div>
    );
  }

  if (notFound || forbidden) {
    return (
      <div className="page-content" style={{ minHeight: "100vh" }}>
        <Navbar />
        <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>{forbidden ? "🔒" : "🔍"}</div>
          <p>{forbidden ? "You can only edit claims you created." : "Claim not found."}</p>
          <Link href={`/claims/${id}`} className="btn-ghost" style={{ textDecoration: "none", marginTop: "16px", display: "inline-flex" }}>← Back to claim</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(20px, 6vw, 40px) clamp(20px, 4vw, 64px)' }}>

        <div style={{ marginBottom: '28px' }}>
          <Link href={`/claims/${id}`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.82rem', padding: '4px 0', display: 'inline-flex', gap: '6px' }}>
            ← Back to claim
          </Link>
          <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginTop: '16px' }}>Edit Claim</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>Update the details of this claim</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="eyebrow">Claim Details</div>

            <div>
              <label style={labelStyle}>Title <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-field"
                maxLength={200}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{form.title.length}/200</p>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="input-field"
                style={{ resize: 'none' }}
                maxLength={2000}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{form.description.length}/2000</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '14px' }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Visibility</label>
                <select
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                  className="input-field"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Estimated Origin Date</label>
              <DatePicker
                value={form.estimated_origin_at}
                onChange={(value) => setForm({ ...form, estimated_origin_at: value })}
                placeholder="Select a date"
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>Leave blank to use today as the origin date. Future dates aren&apos;t allowed.</p>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <Link
              href={`/claims/${id}`}
              className="btn-secondary"
              style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
