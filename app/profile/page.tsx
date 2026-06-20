"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

interface Profile { display_name: string; username: string; bio: string | null; avatar_url: string | null; created_at: string; }

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ display_name: "", bio: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
              <label style={labelStyle}>Username</label>
              <div className="input-field" style={{ opacity: 0.6, cursor: 'not-allowed' }}>@{profile?.username}</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>Username cannot be changed.</p>
            </div>
            <div>
              <label style={labelStyle}>Display name</label>
              <input type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="input-field" maxLength={80} />
            </div>
            <div>
              <label style={labelStyle}>Bio</label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="input-field" style={{ resize: 'none' }} rows={3} maxLength={300} placeholder="A short bio..." />
            </div>
          </div>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderLeft: '3px solid var(--danger)', borderRadius: 'var(--radius-xs)', padding: '12px 16px', fontSize: '0.85rem', color: 'var(--danger)' }}>
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
