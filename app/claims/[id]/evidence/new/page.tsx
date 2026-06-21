"use client";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Toast from "@/components/Toast";

interface Claim { id: string; title: string; status: string; }

const SOURCE_REQUIRED_MESSAGES: Record<string, string> = {
  image: "A source image is required to submit evidence.",
  document: "A source document is required to submit evidence.",
  text: "Source text is required to submit evidence.",
};

export default function AddEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ title: "", content: "", evidence_url: "", sourceType: "", sourceFileName: "" });
  const [uploadingSource, setUploadingSource] = useState(false);
  const [sourceError, setSourceError] = useState("");

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
  const ACCEPTED_DOCUMENT_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];

  async function handleImageFile(file: File) {
    setSourceError("");
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setSourceError("Please upload a PNG, JPEG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSourceError("Image must be smaller than 5MB.");
      return;
    }
    if (!userId) return;
    setUploadingSource(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("evidence-images").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: publicData } = supabase.storage.from("evidence-images").getPublicUrl(path);
      setForm((prev) => ({ ...prev, evidence_url: publicData.publicUrl }));
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingSource(false);
    }
  }

  async function handleDocumentFile(file: File) {
    setSourceError("");
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
      setSourceError("Please upload a PDF, Word document, or plain text file.");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setSourceError("Document must be smaller than 10MB.");
      return;
    }
    if (!userId) return;
    setUploadingSource(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${userId}/${id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("source-documents").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: publicData } = supabase.storage.from("source-documents").getPublicUrl(path);
      setForm((prev) => ({ ...prev, evidence_url: publicData.publicUrl, sourceFileName: file.name }));
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setUploadingSource(false);
    }
  }

  const loadData = useCallback(async () => {
    const { data } = await supabase.from("claims").select("id, title, status").eq("id", id).is("deleted_at", null).single();
    if (data) setClaim(data as Claim);
  }, [id]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      await loadData();
      setLoading(false);
    }
    init();
  }, [id, router, loadData]);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    if (!form.title.trim() && !form.content.trim()) { setError("Please add a title or description."); return; }
    if (!form.sourceType) { setError("Please select a source type."); return; }
    if (!form.evidence_url.trim()) {
      setError(SOURCE_REQUIRED_MESSAGES[form.sourceType] ?? "A source URL is required.");
      return;
    }
    if (form.sourceType !== "text") {
      try {
        new URL(form.evidence_url);
      } catch {
        setError("Please enter a valid URL for the source.");
        return;
      }
    }

    setSubmitting(true);
    setError("");

    const res = await fetch('/api/evidence/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claim_id: id,
        title: form.title,
        content: form.content,
        evidence_url: form.evidence_url,
        source_type: form.sourceType,
      }),
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok || payload?.error) { setError(payload?.error ?? 'Failed to submit evidence.'); return; }
    setSuccess("Evidence submitted successfully.");
    setTimeout(() => router.push(`/claims/${id}`), 800);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Navbar />
        <div className="page-spinner-wrap" style={{ gap: 12 }}>
          <div className="page-spinner" />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.08em" }}>LOADING...</span>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Navbar />
        <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text-muted)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "2rem", marginBottom: 16, letterSpacing: "0.1em" }}>[ 404 ]</div>
          <p style={{ marginBottom: 16 }}>Claim not found.</p>
          <Link href="/claims" className="btn-ghost" style={{ textDecoration: "none" }}>← Back to claims</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(20px, 5vw, 36px) clamp(20px, 4vw, 64px)" }}>

        {/* Back + header */}
        <div style={{ marginBottom: 24 }}>
          <Link href={`/claims/${id}`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.06em" }}>
            ← BACK TO CLAIM
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
            <div style={{ width: 3, height: 32, background: "var(--accent)", borderRadius: 2, flexShrink: 0 }} />
            <div>
              <h1 className="font-display" style={{ fontSize: "1.6rem", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>Submit Evidence</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, fontFamily: "var(--font-mono)" }}>
                for: <span style={{ color: "var(--text-secondary)" }}>{claim.title}</span>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Evidence details */}
          <div className="card" style={{ padding: "20px" }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Evidence Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Short headline or title of this sighting"
                  className="input-field"
                  maxLength={200}
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>{form.title.length}/200</p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Description</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Describe what this evidence shows, how it relates to the claim..."
                  rows={4}
                  className="input-field"
                  maxLength={2000}
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>{form.content.length}/2000</p>
              </div>
            </div>
          </div>

          {/* Source */}
          <div className="card" style={{ padding: "20px", display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div className="eyebrow">Source</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Required — this is what backs the evidence</p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Source Type</label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value, evidence_url: "", sourceFileName: "" })}
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
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Source Image <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                {form.evidence_url && (
                  <div style={{ marginBottom: 10, maxWidth: 260 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.evidence_url} alt="Evidence preview" style={{ width: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "block" }} />
                    <button type="button" onClick={() => setForm({ ...form, evidence_url: "" })} className="btn-secondary" style={{ marginTop: 8, fontSize: 12, padding: "5px 10px" }}>
                      Remove image
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadingSource}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImageFile(file); e.target.value = ""; }}
                  className="input-field"
                />
                {uploadingSource && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Uploading...</p>}
                {sourceError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{sourceError}</p>}
              </div>
            ) : form.sourceType === "document" ? (
              <div className="animate-fade-in">
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Source Document <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                {form.evidence_url && (
                  <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    <a href={form.evidence_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 13 }}>
                      {form.sourceFileName || "View uploaded document"}
                    </a>
                    <button type="button" onClick={() => setForm({ ...form, evidence_url: "", sourceFileName: "" })} className="btn-secondary" style={{ fontSize: 12, padding: "5px 10px" }}>
                      Remove document
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  disabled={uploadingSource}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleDocumentFile(file); e.target.value = ""; }}
                  className="input-field"
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>PDF, Word, or plain text — up to 10MB.</p>
                {uploadingSource && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Uploading...</p>}
                {sourceError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{sourceError}</p>}
              </div>
            ) : form.sourceType === "text" ? (
              <div className="animate-fade-in">
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Source Text <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <textarea
                  value={form.evidence_url}
                  onChange={(e) => setForm({ ...form, evidence_url: e.target.value })}
                  placeholder="Paste or describe the source content..."
                  rows={4}
                  className="input-field"
                  style={{ resize: 'none' }}
                  maxLength={2000}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{form.evidence_url.length}/2000</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Source URL <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <input
                  type="url"
                  value={form.evidence_url}
                  onChange={(e) => setForm({ ...form, evidence_url: e.target.value })}
                  placeholder="https://example.com/post/..."
                  className="input-field"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <Link href={`/claims/${id}`} className="btn-secondary" style={{ flex: 1, textDecoration: "none", justifyContent: "center" }}>
              Cancel
            </Link>
            <button type="submit" disabled={submitting || uploadingSource} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
              {submitting ? "Submitting..." : "Submit Evidence"}
            </button>
          </div>
        </form>

        {success && <Toast message={success} />}
      </div>
    </div>
  );
}
