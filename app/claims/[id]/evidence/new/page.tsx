"use client";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Toast from "@/components/Toast";

interface Claim { id: string; title: string; status: string; }

export default function AddEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ title: "", content: "", evidence_url: "", image_url: "" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  async function handleImageFile(file: File) {
    setImageError("");
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Please upload a PNG, JPEG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be smaller than 5MB.");
      return;
    }
    if (!userId) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("evidence-images").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: publicData } = supabase.storage.from("evidence-images").getPublicUrl(path);
      setForm((prev) => ({ ...prev, image_url: publicData.publicUrl }));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }

  const loadData = useCallback(async () => {
    const { data } = await supabase.from("claims").select("id, title, status").eq("id", id).single();
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
    if (!form.evidence_url.trim()) { setError("A source URL is required."); return; }
    try { new URL(form.evidence_url); } catch { setError("Please enter a valid source URL."); return; }

    setSubmitting(true);
    setError("");

    const res = await fetch('/api/evidence/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: id, ...form }),
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--accent)", animation: "spin 0.7s linear infinite" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.08em" }}>LOADING...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Evidence details */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Evidence Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Description</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Describe what this evidence shows, how it relates to the claim..."
                  rows={4}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Image upload */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Screenshot / Image</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {form.image_url && (
                <div style={{ position: "relative", maxWidth: 260 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.image_url} alt="Evidence preview" style={{ width: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "block" }} />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                    className="btn-secondary"
                    style={{ marginTop: 8, fontSize: 12, padding: "5px 10px" }}
                  >
                    Remove image
                  </button>
                </div>
              )}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Upload an image <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional, max 5MB)</span>
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadingImage}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImageFile(file); e.target.value = ""; }}
                  className="input-field"
                />
                {uploadingImage && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Uploading...</p>}
                {imageError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{imageError}</p>}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Or paste an image URL <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://i.imgur.com/..."
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Source */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Source</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
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
            </div>
          </div>

          {error && (
            <div style={{
              background: "var(--danger-bg)", border: "1px solid rgba(239,68,68,0.25)",
              borderLeft: "3px solid var(--danger)",
              borderRadius: "var(--radius-sm)", padding: "10px 14px",
              fontSize: 13, color: "var(--danger)",
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <Link href={`/claims/${id}`} className="btn-secondary" style={{ flex: 1, textDecoration: "none", justifyContent: "center" }}>
              Cancel
            </Link>
            <button type="submit" disabled={submitting || uploadingImage} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
              {submitting ? "Submitting..." : "Submit Evidence"}
            </button>
          </div>
        </form>

        {success && <Toast message={success} />}
      </div>
    </div>
  );
}
