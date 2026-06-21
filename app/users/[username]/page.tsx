"use client";
import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface UserClaim {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface UserEvidence {
  id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  claim_id: string;
  claims: { title: string } | null;
}

function formatJoinDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: "long", year: "numeric" });
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

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [claims, setClaims] = useState<UserClaim[]>([]);
  const [evidence, setEvidence] = useState<UserEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"claims" | "evidence">("claims");

  useEffect(() => {
    async function load() {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, created_at")
        .eq("username", username)
        .maybeSingle();

      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(profileData as PublicProfile);

      const [{ data: claimsData }, { data: evidenceData }] = await Promise.all([
        supabase
          .from("claims")
          .select("id, title, status, created_at")
          .eq("created_by", profileData.id)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("evidence")
          .select("id, title, content, created_at, claim_id, claims ( title )")
          .eq("created_by", profileData.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setClaims((claimsData as unknown as UserClaim[]) ?? []);
      setEvidence((evidenceData as unknown as UserEvidence[]) ?? []);
      setLoading(false);
    }
    load();
  }, [username]);

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

  if (notFound || !profile) {
    return (
      <div className="page-content" style={{ minHeight: "100vh" }}>
        <Navbar />
        <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text-muted)" }}>
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: "0 auto 16px" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.93 17.93 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z" />
          </svg>
          <p>No user found with username @{username}.</p>
          <Link href="/claims" className="btn-ghost" style={{ textDecoration: "none", marginTop: "16px", display: "inline-flex" }}>← Back to claims</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ minHeight: "100vh" }}>
      <Navbar />
      <div style={{ maxWidth: "880px", margin: "0 auto", padding: "clamp(20px, 5vw, 36px) clamp(20px, 4vw, 64px) 48px" }}>

        <div className="card" style={{ padding: "28px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" }}>
            <div style={{ width: "84px", height: "84px", borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, color: "var(--accent)", fontWeight: 700, fontSize: "2rem" }}>
              {profile.avatar_url
                ? <Image src={profile.avatar_url} alt="" width={84} height={84} unoptimized style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                : profile.display_name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="font-display" style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                {profile.display_name}
              </h1>
              <p className="mono" style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2px" }}>@{profile.username}</p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "8px" }}>Member since {formatJoinDate(profile.created_at)}</p>
              {profile.bio && (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, marginTop: "14px", maxWidth: "60ch" }}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "24px", marginTop: "22px", paddingTop: "18px", borderTop: "1px solid var(--border)" }}>
            <div>
              <div className="data-num" style={{ fontSize: "1.3rem" }}>{claims.length}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Claims submitted</div>
            </div>
            <div>
              <div className="data-num" style={{ fontSize: "1.3rem" }}>{evidence.length}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Evidence submitted</div>
            </div>
          </div>
        </div>

        <div className="tab-bar">
          <button onClick={() => setActiveTab("claims")} className={`tab-item ${activeTab === "claims" ? "active" : ""}`}>
            Claims ({claims.length})
          </button>
          <button onClick={() => setActiveTab("evidence")} className={`tab-item ${activeTab === "evidence" ? "active" : ""}`}>
            Evidence ({evidence.length})
          </button>
        </div>

        {activeTab === "claims" && (
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {claims.length === 0 ? (
              <div className="empty-state">No public claims submitted yet.</div>
            ) : claims.map((claim) => (
              <Link key={claim.id} href={`/claims/${claim.id}`} className="card card-clickable" style={{ padding: "14px 18px", textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className={`status-pill status-${claim.status}`} style={{ marginBottom: "6px", display: "inline-flex" }}>
                      <span className="status-dot" />
                      {claim.status}
                    </span>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {claim.title}
                    </h3>
                  </div>
                  <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }} title={new Date(claim.created_at).toLocaleString()}>
                    {timeAgo(claim.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {activeTab === "evidence" && (
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {evidence.length === 0 ? (
              <div className="empty-state">No evidence submitted yet.</div>
            ) : evidence.map((item) => (
              <Link key={item.id} href={`/claims/${item.claim_id}`} className="card card-clickable" style={{ padding: "14px 18px", textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
                  <span className="mono" style={{ fontSize: "0.7rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {item.claims?.title ?? "Unknown claim"}
                  </span>
                  <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }} title={new Date(item.created_at).toLocaleString()}>
                    {timeAgo(item.created_at)}
                  </span>
                </div>
                {item.title && <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>{item.title}</h3>}
                {item.content && <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "4px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{item.content}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
