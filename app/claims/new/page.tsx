"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Toast from "@/components/Toast";

interface Category { id: string; name: string; }
interface Tag { id: string; name: string; }

export default function NewClaimPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    visibility: "public",
    category_id: "",
    estimated_origin_at: "",
    sourceUrl: "",
    sourceType: "link",
  });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single();
      if (!profile) {
        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";
        const username =
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          user.id.slice(0, 8);

        await supabase.from("profiles").insert({
          id: user.id,
          display_name: displayName,
          username,
          avatar_url: user.user_metadata?.avatar_url || null,
        }).select().maybeSingle();
      }

      setUserId(user.id);

      let cats: Category[] = [];
      let tagData: Tag[] = [];

      const categoriesResp = await supabase.from("categories").select("id, name").is("deleted_at", null);
      if (categoriesResp.error) {
        const fallback = await supabase.from("categories").select("id, name");
        cats = (fallback.error ? [] : (fallback.data as Category[])) ?? [];
      } else {
        cats = (categoriesResp.data as Category[]) ?? [];
      }

      const tagsResp = await supabase.from("tags").select("id, name").is("deleted_at", null);
      if (tagsResp.error) {
        const fallback = await supabase.from("tags").select("id, name");
        tagData = (fallback.error ? [] : (fallback.data as Tag[])) ?? [];
      } else {
        tagData = (tagsResp.data as Tag[]) ?? [];
      }

      setCategories(cats);
      setTags(tagData);
    }
    init();
  }, [router]);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.sourceUrl.trim()) { setError("A source URL is required to submit a claim."); return; }
    try {
      new URL(form.sourceUrl);
    } catch {
      setError("Please enter a valid URL for the source.");
      return;
    }

    setSubmitting(true);
    setError("");

    const resp = await fetch('/api/claims/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, selectedTags }),
    });
    const payload = await resp.json();
    if (!resp.ok || payload?.error) {
      setError(payload?.error ?? 'Failed to create claim.');
      setSubmitting(false);
      return;
    }
    const claim = payload.claim;

    setSubmitting(false);
    window.setTimeout(() => router.push(`/claims/${claim.id}`), 300);
    setSuccessMessage("Thanks — your claim was added.");
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

  return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px clamp(20px, 4vw, 64px)' }}>

        <div style={{ marginBottom: '28px' }}>
          <Link href="/claims" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.82rem', padding: '4px 0', display: 'inline-flex', gap: '6px' }}>
            ← Back to claims
          </Link>
          <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginTop: '16px' }}>New Claim</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>Report a misinformation claim you have encountered</p>
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
                placeholder="e.g. Vaccines cause autism — viral Facebook post"
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
                placeholder="Describe the misinformation claim in detail — what it says, how it spread, why it is false..."
                rows={4}
                className="input-field"
                style={{ resize: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
              <input
                type="date"
                value={form.estimated_origin_at}
                onChange={(e) => setForm({ ...form, estimated_origin_at: e.target.value })}
                className="input-field"
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>Leave blank to use today as the origin date</p>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div className="eyebrow">Source</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Required — this is what backs your claim</p>
            </div>

            <div>
              <label style={labelStyle}>Source URL <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input
                type="url"
                value={form.sourceUrl}
                onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                placeholder="https://example.com/article"
                className="input-field"
              />
            </div>

            <div>
              <label style={labelStyle}>Source Type</label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                className="input-field"
              >
                <option value="link">Link (highest priority)</option>
                <option value="document">Document</option>
                <option value="image">Image / Screenshot</option>
                <option value="text">Text (lowest priority)</option>
              </select>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <div className="eyebrow" style={{ marginBottom: '12px' }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`filter-chip ${selectedTags.includes(tag.id) ? 'active' : ''}`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderLeft: '3px solid var(--danger)', borderRadius: 'var(--radius-xs)', padding: '12px 16px', fontSize: '0.85rem', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <Link
              href="/claims"
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
              {submitting ? "Submitting..." : "Submit Claim"}
            </button>
          </div>
          {successMessage && <Toast key={successMessage} message={successMessage} />}
        </form>
      </div>
    </div>
  );
}
