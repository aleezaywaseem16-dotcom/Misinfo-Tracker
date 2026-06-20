"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Claim {
  id: string;
  title: string;
  status: string;
  visibility: string;
  estimated_origin_at: string;
  created_at: string;
  category_id: string | null;
  profiles: { display_name: string; username: string } | null;
  categories: { name: string } | null;
}

interface Stats {
  totalClaims: number;
  debunked: number;
  investigating: number;
  confirmed: number;
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill status-${status}`}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<Stats>({ totalClaims: 0, debunked: 0, investigating: 0, confirmed: 0 });
  const [watchlistClaims, setWatchlistClaims] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");

  async function loadCategories() {
    const { data } = await supabase.from("categories").select("id, name").is("deleted_at", null).order("name");
    setCategories(data ?? []);
  }

  async function loadClaims() {
    const { data } = await supabase
      .from("claims")
      .select(`id, title, status, visibility, estimated_origin_at, created_at, category_id,
        profiles!claims_created_by_fkey ( display_name, username ), categories ( name )`)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setClaims(data as unknown as Claim[]);
  }

  async function loadStats() {
    const { count: total } = await supabase.from("claims").select("*", { count: "exact", head: true }).eq("visibility", "public").is("deleted_at", null);
    const { count: debunked } = await supabase.from("claims").select("*", { count: "exact", head: true }).eq("status", "debunked").is("deleted_at", null);
    const { count: investigating } = await supabase.from("claims").select("*", { count: "exact", head: true }).eq("status", "investigating").is("deleted_at", null);
    const { count: confirmed } = await supabase.from("claims").select("*", { count: "exact", head: true }).eq("status", "confirmed").is("deleted_at", null);
    setStats({ totalClaims: total ?? 0, debunked: debunked ?? 0, investigating: investigating ?? 0, confirmed: confirmed ?? 0 });
  }

  async function loadWatchlist() {
    try {
      const res = await fetch("/api/watchlist");
      const payload = await res.json();
      if (!res.ok || payload?.error) return;
      const rows = (payload.watchlist ?? []) as Array<{ claim_id: string }>;
      setWatchlistClaims(rows.map((row) => row.claim_id));
    } catch {
      /* ignore — watchlist summary is non-critical */
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      await Promise.all([loadClaims(), loadStats(), loadWatchlist(), loadCategories()]);
      setLoading(false);
    }
    init();
  }, [router]);

  const watchlistAlertCount = watchlistClaims.filter((id) => claims.some((claim) => claim.id === id && ["investigating", "confirmed", "disputed"].includes(claim.status))).length;

  const filters = ["all", "unverified", "investigating", "confirmed", "debunked", "disputed"];
  const filteredClaims = claims
    .filter((c) => activeFilter === "all" || c.status === activeFilter)
    .filter((c) => categoryFilter === "all" || c.category_id === categoryFilter);

  const statCards = [
    { label: "Total Claims", value: stats.totalClaims, color: 'var(--accent)', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    )},
    { label: "Investigating", value: stats.investigating, color: 'var(--warning)', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
    )},
    { label: "Confirmed", value: stats.confirmed, color: 'var(--danger)', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
    )},
    { label: "Debunked", value: stats.debunked, color: 'var(--verified)', icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )},
  ];

  return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      <Navbar />

      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: 'clamp(20px, 6vw, 40px) clamp(20px, 4vw, 64px)' }}>

        {/* Hero header */}
        <div className="animate-fade-up" style={{ marginBottom: '40px' }}>
          <div className="hero-badge" style={{ marginBottom: '16px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.3"/><circle cx="12" cy="12" r="4"/></svg>
            Live Tracking Dashboard
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <h1 className="font-display" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: '14px' }}>
                Intelligence for fact-driven teams
                <span className="gradient-text" style={{ display: 'block', fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', lineHeight: 1.05 }}>Secure the narrative with precision.</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '560px', lineHeight: 1.75, marginTop: '4px' }}>
                See high-risk claims, author signals, and investigation status from one polished control panel.
              </p>
            </div>
            <Link href="/claims/new" className="btn-primary" style={{ textDecoration: 'none', fontSize: '0.95rem', padding: '14px 28px' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Report a Claim
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '36px' }}>
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className={`stat-card animate-fade-up stagger-${i + 1}`}
              style={{ '--glow-color': card.color } as React.CSSProperties}
            >
              <div style={{
                position: 'absolute', top: 0, right: 0, width: '100px', height: '100px',
                borderRadius: '50%', background: card.color, opacity: 0.06, filter: 'blur(30px)',
              }} />
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: `${card.color}18`,
                border: `1px solid ${card.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: card.color, marginBottom: '16px',
              }}>
                {card.icon}
              </div>
              <div className="font-display" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {loading ? <div className="skeleton" style={{ width: '48px', height: '32px' }} /> : card.value.toLocaleString()}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="animate-fade-up stagger-5" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px', whiteSpace: 'nowrap' }}>Filter</span>
          {filters.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`filter-chip ${activeFilter === f ? 'active' : ''}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="animate-fade-up stagger-5" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px', whiteSpace: 'nowrap' }}>Category</span>
            <button onClick={() => setCategoryFilter('all')} className={`filter-chip ${categoryFilter === 'all' ? 'active' : ''}`}>
              all
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setCategoryFilter(c.id)} className={`filter-chip ${categoryFilter === c.id ? 'active' : ''}`}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Claims list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '14px', animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        ) : filteredClaims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔎</div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>No claims found in this filter.</p>
            <Link href="/claims/new" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Be the first to add one →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredClaims.map((claim, i) => (
              <Link
                key={claim.id}
                href={`/claims/${claim.id}`}
                className={`card card-clickable animate-fade-up`}
                style={{ padding: '18px 22px', textDecoration: 'none', animationDelay: `${i * 0.04}s`, display: 'block' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <StatusPill status={claim.status} />
                      {claim.categories && (
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: 'var(--text-muted)',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid var(--border)', borderRadius: '6px',
                          padding: '2px 8px',
                        }}>
                          {claim.categories.name}
                        </span>
                      )}
                    </div>
                    <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {claim.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        @{claim.profiles?.username ?? "unknown"}
                      </span>
                      <span style={{ color: 'var(--border)', fontSize: '0.75rem' }}>•</span>
                      <span title={new Date(claim.created_at).toLocaleString('en-GB')} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'default' }}>{timeAgo(claim.created_at)}</span>
                      {claim.estimated_origin_at && (
                        <>
                          <span style={{ color: 'var(--border)', fontSize: '0.75rem' }}>•</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Origin: {new Date(claim.estimated_origin_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <svg width="16" height="16" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {filteredClaims.length > 0 && (
          <>
            <div className="dashboard-summary-card" style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <Link href="/watchlist" className="card card-clickable" style={{ padding: '24px', textDecoration: 'none', color: 'var(--text-primary)', display: 'block' }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Watchlist</div>
                <div className="data-num">{watchlistClaims.length}</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Claims tracked for alerts and status updates.</p>
              </Link>
              <div className="card" style={{ padding: '24px' }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Active Alerts</div>
                <div className="data-num" style={{ color: watchlistAlertCount > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>{watchlistAlertCount}</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Watchlist claims with high-risk or changing status.</p>
              </div>
            </div>
            <div style={{ marginTop: '28px', textAlign: 'center' }}>
              <Link href="/claims" className="btn-ghost" style={{ textDecoration: 'none' }}>
                View all claims
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
