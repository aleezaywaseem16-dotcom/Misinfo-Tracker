"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Claim {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: string;
  estimated_origin_at: string | null;
  created_at: string;
  profiles: { display_name: string; username: string } | null;
  categories: { name: string } | null;
  category_id?: string | null;
}

const SAVED_VIEWS = [
  { key: "all",          label: "All claims",       status: "all",           sortBy: "newest" },
  { key: "investigating",label: "Investigating",     status: "investigating", sortBy: "newest" },
  { key: "unverified",   label: "Fresh unverified", status: "unverified",    sortBy: "newest" },
  { key: "high-risk",    label: "High risk",        status: "disputed",      sortBy: "origin" },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  unverified:    { label: "UNVERIFIED",    cls: "status-unverified"    },
  investigating: { label: "INVESTIGATING", cls: "status-investigating" },
  confirmed:     { label: "CONFIRMED",     cls: "status-confirmed"     },
  debunked:      { label: "DEBUNKED",      cls: "status-debunked"      },
  disputed:      { label: "DISPUTED",      cls: "status-disputed"      },
  archived:      { label: "ARCHIVED",      cls: "status-archived"      },
};

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

function confidenceForStatus(status: string) {
  const map: Record<string, number> = { confirmed: 90, investigating: 72, disputed: 65, unverified: 45, debunked: 18, archived: 30 };
  return map[status] ?? 50;
}

function ClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [savedView, setSavedView] = useState("all");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistClaims, setWatchlistClaims] = useState<Claim[]>([]);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("claims")
      .select(`id, title, description, status, visibility, estimated_origin_at, created_at, category_id, profiles!claims_submitted_by_fkey ( display_name, username ), categories ( name )`)
      .eq("visibility", "public")
      .is("deleted_at", null);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (categoryFilter !== "all") query = query.eq("category_id", categoryFilter);
    if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
    if (sortBy === "newest") query = query.order("created_at", { ascending: false });
    else if (sortBy === "oldest") query = query.order("created_at", { ascending: true });
    else if (sortBy === "origin") query = query.order("estimated_origin_at", { ascending: true });

    const { data } = await query.limit(50);
    setClaims((data as unknown as Claim[]) ?? []);
    setLoading(false);
  }, [search, statusFilter, sortBy, categoryFilter]);

  const loadWatchlistDetails = useCallback(async (ids: string[]) => {
    if (!ids.length) { setWatchlistClaims([]); return; }
    const { data } = await supabase
      .from("claims")
      .select(`id, title, status, estimated_origin_at, created_at, profiles!claims_submitted_by_fkey ( display_name, username ), categories ( name )`)
      .in("id", ids)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setWatchlistClaims((data as unknown as Claim[]) ?? []);
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: cats } = await supabase.from("categories").select("id, name");
      setCategories(cats ?? []);
    }
    init();
  }, [router]);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("misinfo-watchlist");
    const saved = stored ? JSON.parse(stored) : [];
    setWatchlist(Array.isArray(saved) ? saved : []);
  }, []);

  useEffect(() => {
    if (!watchlist.length) return;
    void Promise.resolve().then(() => { void loadWatchlistDetails(watchlist); });
  }, [loadWatchlistDetails, watchlist]);

  useEffect(() => {
    void Promise.resolve().then(() => { void loadClaims(); });
  }, [loadClaims]);

  const savedViewList = useMemo(() => SAVED_VIEWS, []);
  const watchlistAlertCount = watchlistClaims.filter((c) => ["investigating", "disputed", "confirmed"].includes(c.status)).length;

  const applySavedView = (key: string) => {
    const selected = SAVED_VIEWS.find((v) => v.key === key) ?? SAVED_VIEWS[0];
    setSavedView(selected.key);
    setStatusFilter(selected.status);
    setSortBy(selected.sortBy);
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "36px clamp(20px, 4vw, 64px)" }}>

        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Intelligence Platform</div>
            <h1 className="font-display" style={{ fontSize: "clamp(1.6rem,4vw,2.2rem)", letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
              Claims Explorer
            </h1>
            <p style={{ color: "var(--text-muted)", marginTop: 6, fontSize: 13, maxWidth: 520, lineHeight: 1.6 }}>
              Browse misinformation claims, monitor active investigations, and filter by status or category.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Link href="/claims/new" className="btn-primary" style={{ textDecoration: "none" }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              New Claim
            </Link>
            <div style={{
              padding: "6px 12px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              fontSize: 12, fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              letterSpacing: "0.03em",
            }}>
              {watchlist.length} watching
              {watchlistAlertCount > 0 && <span style={{ color: "var(--accent)", marginLeft: 6 }}>· {watchlistAlertCount} alert{watchlistAlertCount > 1 ? "s" : ""}</span>}
            </div>
          </div>
        </div>

        {/* Saved views */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {savedViewList.map((view) => (
            <button key={view.key} onClick={() => applySavedView(view.key)} className={`saved-view-chip ${savedView === view.key ? "active" : ""}`}>
              {view.label}
            </button>
          ))}
        </div>

        {/* Filter panel */}
        <div className="card" style={{ padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr auto auto" }}>
            {/* Search */}
            <div style={{ position: "relative", gridColumn: "1" }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search claims by title..."
                className="input-field"
                style={{ paddingLeft: 32, fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-field select" style={{ width: "auto", minWidth: 140 }}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-field" style={{ width: "auto", minWidth: 130 }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="origin">By origin date</option>
            </select>
          </div>

          {/* Status filters */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {["all", "unverified", "investigating", "confirmed", "debunked", "disputed", "archived"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`filter-chip ${statusFilter === s ? "active" : ""}`}>
                {s === "all" ? "ALL" : (STATUS_META[s]?.label ?? s.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {/* Claim list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 88, borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        ) : claims.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "2.5rem", marginBottom: 12, fontFamily: "var(--font-mono)" }}>[ 0 RESULTS ]</div>
            <p style={{ marginBottom: 16 }}>No claims match this view.</p>
            <Link href="/claims/new" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
              Submit the first claim
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {claims.map((claim, idx) => {
              const meta = STATUS_META[claim.status] ?? STATUS_META.unverified;
              const conf = confidenceForStatus(claim.status);
              return (
                <Link
                  key={claim.id}
                  href={`/claims/${claim.id}`}
                  className="card card-clickable animate-fade-up"
                  style={{
                    display: "block",
                    padding: "14px 18px",
                    textDecoration: "none",
                    animationDelay: `${idx * 25}ms`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Status + category row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <span className={`status-pill ${meta.cls}`}>
                          <span className="status-dot" />
                          {meta.label}
                        </span>
                        {claim.categories && (
                          <span style={{
                            fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
                            color: "var(--text-muted)", textTransform: "uppercase",
                          }}>
                            {claim.categories.name}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 style={{
                        fontSize: 15, fontWeight: 600, color: "var(--text-primary)",
                        letterSpacing: "-0.01em", lineHeight: 1.3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontFamily: "var(--font-ui)",
                      }}>
                        {claim.title}
                      </h3>

                      {/* Meta row */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        marginTop: 7, fontFamily: "var(--font-mono)",
                        fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.03em",
                        flexWrap: "wrap",
                      }}>
                        <span>@{claim.profiles?.username ?? "unknown"}</span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>{timeAgo(claim.created_at)}</span>
                        {claim.estimated_origin_at && (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span>Origin: {new Date(claim.estimated_origin_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Confidence */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                      <div style={{
                        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                        color: conf >= 70 ? "var(--danger)" : conf >= 50 ? "var(--warning)" : "var(--text-muted)",
                        letterSpacing: "0.04em",
                        background: "var(--bg-inset)", padding: "3px 8px",
                        borderRadius: "var(--radius-xs)", border: "1px solid var(--border)",
                      }}>
                        {conf}% CONF
                      </div>
                      <svg width="14" height="14" fill="none" stroke="var(--text-disabled)" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaimsPageWrapper() {
  return (
    <Suspense>
      <ClaimsPage />
    </Suspense>
  );
}
