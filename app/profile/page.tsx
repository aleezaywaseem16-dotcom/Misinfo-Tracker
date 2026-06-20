"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

interface Profile { display_name: string; username: string; bio: string | null; avatar_url: string | null; created_at: string; }

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ display_name: "", bio: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) { setProfile(data as Profile); setForm({ display_name: data.display_name ?? "", bio: data.bio ?? "" }); }
      setLoading(false);
    }
    init();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false); setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be signed in."); setSaving(false); return; }
    const { error: updateErr } = await supabase.from("profiles").update({ display_name: form.display_name.trim(), bio: form.bio.trim() || null, updated_at: new Date().toISOString() }).eq("id", user.id);
    setSaving(false);
    if (updateErr) { setError(updateErr.message); } else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  function handleReset() {
    if (!profile) return;
    setForm({ display_name: profile.display_name ?? "", bio: profile.bio ?? "" });
    setError("");
    setSaved(false);
  }

  async function handleAvatarFile(file: File) {
    setAvatarError("");
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Please upload a PNG, JPEG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be smaller than 5MB.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAvatarError("You must be signed in."); return; }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;

      const { error: updateErr } = await supabase.from("profiles").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (updateErr) throw updateErr;

      setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
      window.dispatchEvent(new Event("profile-avatar-updated"));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAvatarError("You must be signed in."); return; }

    setUploadingAvatar(true);
    try {
      const { error: updateErr } = await supabase.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (updateErr) throw updateErr;
      setProfile((prev) => (prev ? { ...prev, avatar_url: null } : prev));
      window.dispatchEvent(new Event("profile-avatar-updated"));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to remove avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  const isDirty = !!profile && (form.display_name !== (profile.display_name ?? "") || form.bio !== (profile.bio ?? ""));

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  if (loading) return (
    <div className="page-content" style={{ minHeight: "100vh" }}>
      <Navbar />
      <div className="page-spinner-wrap">
        <div className="page-spinner" />
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: 'clamp(20px, 6vw, 40px) clamp(20px, 4vw, 64px)' }}>
        <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.82rem', padding: '4px 0', display: 'inline-flex', gap: '6px', marginBottom: '16px' }}>
          ← Back to dashboard
        </Link>
        <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '6px' }}>Profile</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '28px' }}>Manage your display name and bio.</p>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Avatar</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, color: 'var(--accent)', fontWeight: 700, fontSize: '1.3rem' }}>
                  {profile?.avatar_url
                    ? <Image src={profile.avatar_url} alt="" width={64} height={64} unoptimized style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    : (profile?.display_name?.charAt(0).toUpperCase() ?? 'U')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploadingAvatar}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleAvatarFile(file); e.target.value = ""; }}
                    className="input-field"
                    style={{ fontSize: '0.78rem', padding: '8px' }}
                  />
                  {profile?.avatar_url && (
                    <button type="button" onClick={handleRemoveAvatar} disabled={uploadingAvatar} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 12px', alignSelf: 'flex-start' }}>
                      Remove avatar
                    </button>
                  )}
                </div>
              </div>
              {uploadingAvatar && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>Uploading...</p>}
              {avatarError && <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: '8px' }}>{avatarError}</p>}
            </div>
            <div>
              <label style={labelStyle}>Username</label>
              <div className="input-field" style={{ opacity: 0.6, cursor: 'not-allowed' }}>@{profile?.username}</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>Username cannot be changed.</p>
            </div>
            <div>
              <label style={labelStyle}>Display name</label>
              <input type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="input-field" maxLength={80} />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{form.display_name.length}/80</p>
            </div>
            <div>
              <label style={labelStyle}>Bio</label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="input-field" style={{ resize: 'none' }} rows={3} maxLength={300} placeholder="A short bio..." />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>{form.bio.length}/300</p>
            </div>
          </div>
          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={handleReset} disabled={!isDirty} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', opacity: isDirty ? 1 : 0.5 }}>
              Reset
            </button>
            <button type="submit" disabled={saving || !isDirty} className="btn-primary" style={{ flex: 2, justifyContent: 'center', opacity: saving || !isDirty ? 0.6 : 1 }}>
              {saving ? "Saving..." : saved ? "✓ Saved!" : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
