"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { sortCategoriesOtherLast, formatCategoryName } from "@/lib/categories";
import Navbar from "@/components/Navbar";
import Toast from "@/components/Toast";
import DatePicker from "@/components/DatePicker";

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
  const [uploadingSourceImage, setUploadingSourceImage] = useState(false);
  const [sourceImageError, setSourceImageError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    visibility: "public",
    category_id: "",
    estimated_origin_at: "",
    sourceUrl: "",
    sourceType: "",
    sourceDocumentName: "",
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

      const categoriesResp = await supabase.from("categories").select("id, name").is("deleted_at", null).order("name");
      if (categoriesResp.error) {
        const fallback = await supabase.from("categories").select("id, name").order("name");
        cats = (fallback.error ? [] : (fallback.data as Category[])) ?? [];
      } else {
        cats = (categoriesResp.data as Category[]) ?? [];
      }

      const tagsResp = await supabase.from("tags").select("id, name").is("deleted_at", null).order("name");
      if (tagsResp.error) {
        const fallback = await supabase.from("tags").select("id, name").order("name");
        tagData = (fallback.error ? [] : (fallback.data as Tag[])) ?? [];
      } else {
        tagData = (tagsResp.data as Tag[]) ?? [];
      }

      setCategories(sortCategoriesOtherLast(cats));
      setTags(tagData);
    }
    init();
  }, [router]);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
  const ACCEPTED_DOCUMENT_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];

  async function handleSourceImageFile(file: File) {
    setSourceImageError("");
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setSourceImageError("Please upload a PNG, JPEG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSourceImageError("Image must be smaller than 5MB.");
      return;
    }
    if (!userId) return;
    setUploadingSourceImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/claim-source-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("evidence-images").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: publicData } = supabase.storage.from("evidence-images").getPublicUrl(path);
      setForm((prev) => ({ ...prev, sourceUrl: publicData.publicUrl }));
    } catch (err) {
      setSourceImageError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingSourceImage(false);
    }
  }

  async function handleSourceDocumentFile(file: File) {
    setSourceImageError("");
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
      setSourceImageError("Please upload a PDF, Word document, or plain text file.");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setSourceImageError("Document must be smaller than 10MB.");
      return;
    }
    if (!userId) return;
    setUploadingSourceImage(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${userId}/claim-source-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("source-documents").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: publicData } = supabase.storage.from("source-documents").getPublicUrl(path);
      setForm((prev) => ({ ...prev, sourceUrl: publicData.publicUrl, sourceDocumentName: file.name }));
    } catch (err) {
      setSourceImageError(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setUploadingSourceImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.sourceType) { setError("Please select a source type."); return; }
    if (!form.sourceUrl.trim()) {
      const sourceRequiredMessages: Record<string, string> = {
        image: "A source image is required to submit a claim.",
        document: "A source document is required to submit a claim.",
        text: "Source text is required to submit a claim.",
      };
      setError(sourceRequiredMessages[form.sourceType] ?? "A source URL is required to submit a claim.");
      return;
    }
    if (form.sourceType !== "text") {
      try {
        new URL(form.sourceUrl);
      } catch {
        setError("Please enter a valid URL for the source.");
        return;
      }
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
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(20px, 6vw, 40px) clamp(20px, 4vw, 64px)' }}>

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
                    <option key={c.id} value={c.id}>{formatCategoryName(c.name)}</option>
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
                placeholder="YYYY-MM-DD"
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>Leave blank to use today as the origin date. Future dates aren&apos;t allowed.</p>
            </div>
          </div>

          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div className="eyebrow">Source</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Required — this is what backs your claim</p>
            </div>

            <div>
              <label style={labelStyle}>Source Type</label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value, sourceUrl: "", sourceDocumentName: "" })}
                className="input-field"
              >
                <option value="" disabled>Select a source type...</option>
                <option value="link">Link (highest priority)</option>
                <option value="document">Document</option>
                <option value="image">Image / Screenshot</option>
                <option value="text">Text (lowest priority)</option>
              </select>
            </div>

            {!form.sourceType ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Choose a source type above to continue.</p>
            ) : form.sourceType === "image" ? (
              <div className="animate-fade-in">
                <label style={labelStyle}>Source Image <span style={{ color: 'var(--accent)' }}>*</span></label>
                {form.sourceUrl && (
                  <div style={{ marginBottom: 10, maxWidth: 260 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.sourceUrl} alt="Source preview" style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'block' }} />
                    <button type="button" onClick={() => setForm({ ...form, sourceUrl: "" })} className="btn-secondary" style={{ marginTop: 8, fontSize: 12, padding: '5px 10px' }}>
                      Remove image
                    </button>
                  </div>
                )}
                <label
                  htmlFor="source-image-upload"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '9px 16px', borderRadius: 'var(--radius-sm)',
                    border: '1px dashed rgba(0,255,136,0.35)',
                    cursor: uploadingSourceImage ? 'not-allowed' : 'pointer',
                    fontSize: '0.82rem', color: 'var(--accent)',
                    opacity: uploadingSourceImage ? 0.5 : 1,
                    background: 'rgba(0,255,136,0.04)', userSelect: 'none',
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {uploadingSourceImage ? 'Uploading…' : 'Upload image'}
                </label>
                <input
                  id="source-image-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadingSourceImage}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleSourceImageFile(file); e.target.value = ""; }}
                  style={{ display: 'none' }}
                />
                {uploadingSourceImage && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Uploading...</p>}
                {sourceImageError && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{sourceImageError}</p>}
              </div>
            ) : form.sourceType === "document" ? (
              <div className="animate-fade-in">
                <label style={labelStyle}>Source Document <span style={{ color: 'var(--accent)' }}>*</span></label>
                {form.sourceUrl && (
                  <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <a href={form.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 13 }}>
                      {form.sourceDocumentName || 'View uploaded document'}
                    </a>
                    <button type="button" onClick={() => setForm({ ...form, sourceUrl: "", sourceDocumentName: "" })} className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }}>
                      Remove document
                    </button>
                  </div>
                )}
                <label
                  htmlFor="source-doc-upload"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '9px 16px', borderRadius: 'var(--radius-sm)',
                    border: '1px dashed rgba(0,255,136,0.35)',
                    cursor: uploadingSourceImage ? 'not-allowed' : 'pointer',
                    fontSize: '0.82rem', color: 'var(--accent)',
                    opacity: uploadingSourceImage ? 0.5 : 1,
                    background: 'rgba(0,255,136,0.04)', userSelect: 'none',
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {uploadingSourceImage ? 'Uploading…' : 'Upload document'}
                </label>
                <input
                  id="source-doc-upload"
                  type="file"
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  disabled={uploadingSourceImage}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleSourceDocumentFile(file); e.target.value = ""; }}
                  style={{ display: 'none' }}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>PDF, Word, or plain text — up to 10MB.</p>
                {uploadingSourceImage && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Uploading...</p>}
                {sourceImageError && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{sourceImageError}</p>}
              </div>
            ) : form.sourceType === "text" ? (
              <div className="animate-fade-in">
                <label style={labelStyle}>Source Text <span style={{ color: 'var(--accent)' }}>*</span></label>
                <textarea
                  value={form.sourceUrl}
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  placeholder="Paste or describe the source content..."
                  rows={4}
                  className="input-field"
                  style={{ resize: 'none' }}
                  maxLength={2000}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{form.sourceUrl.length}/2000</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                <label style={labelStyle}>Source URL <span style={{ color: 'var(--accent)' }}>*</span></label>
                <input
                  type="url"
                  value={form.sourceUrl}
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  placeholder="https://example.com/article"
                  className="input-field"
                />
              </div>
            )}
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
            <div className="error-banner">
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <Link
              href="/claims"
              className="btn-secondary"
              style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || uploadingSourceImage}
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center', opacity: submitting || uploadingSourceImage ? 0.6 : 1 }}
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
