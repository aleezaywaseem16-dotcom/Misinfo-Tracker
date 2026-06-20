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
  evidence: { count: number }[];
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

function calculateConfidence(status: string, evidenceCount: number): number {
  const base: Record<string, number> = { confirmed: 70, investigating: 48, disputed: 38, unverified: 22, debunked: 10, archived: 18 };
  const evidenceBonus = Math.min(evidenceCount * 5, 25);
  return Math.min(95, Math.max(5, (base[status] ?? 30) + evidenceBonus));
}

const PAGE_SIZE = 12;

function ClaimsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [savedView, setSavedView] = useState("all");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistClaims, setWatchlistClaims] = useState<Claim[]>([]);

  // Wrap each filter setter so changing a filter also resets pagination back to page 1.
  function updateSearch(value: string) { setSearch(value); setPage(0); }
  function updateStatusFilter(value: string) { setStatusFilter(value); setPage(0); }
  function updateSortBy(value: string) { setSortBy(value); setPage(0); }
  function updateCategoryFilter(value: string) { setCategoryFilter(value); setPage(0); }
  function updateDateFrom(value: string) { setDateFrom(value); setPage(0); }
  function updateDateTo(value: string) { setDateTo(value); setPage(0); }

  const loadClaims = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("claims")
      .select(`id, title, description, status, visibility, estimated_origin_at, created_at, category_id, profiles!claims_created_by_fkey ( display_name, username ), categories ( name ), evidence(count)`, { count: "exact" })
      .eq("visibility", "public")
      .is("deleted_at", null);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (categoryFilter !== "all") query = query.eq("category_id", categoryFilter);
    if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
    if (dateFrom) query = query.gte("estimated_origin_at", dateFrom);
    if (dateTo) query = query.lte("estimated_origin_at", `${dateTo}T23:59:59.999Z`);
    if (sortBy === "newest") query = query.order("created_at", { ascending: false });
    else if (sortBy === "oldest") query = query.order("created_at", { ascending: true });
    else if (sortBy === "origin") query = query.order("estimated_origin_at", { ascending: true });

    const from = page * PAGE_SIZE;
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
    setClaims((data as unknown as Claim[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [search, statusFilter, sortBy, categoryFilter, dateFrom, dateTo, page]);

  const loadWatchlistSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      const payload = await res.json();
      if (!res.ok || payload?.error) return;
      const rows = (payload.watchlist ?? []) as Array<{ claim_id: string; claims: Claim | null }>;
      setWatchlist(rows.map((row) => row.claim_id));
      setWatchlistClaims(rows.map((row) => row.claims).filter((c): c is Claim => c !== null));
    } catch {
      /* ignore — watchlist summary is non-critical */
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: cats } = await supabase.from("categories").select("id, name");
      setCategories(cats ?? []);
      void loadWatchlistSummary();
    }
    init();
  }, [router, loadWatchlistSummary]);

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
    setPage(0);
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "clamp(20px, 5vw, 36px) clamp(20px, 4vw, 64px)" }}>

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
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto]" style={{ gap: 12 }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => updateSearch(e.target.value)}
                placeholder="Search claims by title..."
                className="input-field"
                style={{ paddingLeft: 32, fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
            </div>
            <select value={categoryFilter} onChange={(e) => updateCategoryFilter(e.target.value)} className="input-field select w-full sm:w-auto" style={{ minWidth: 140 }}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => updateSortBy(e.target.value)} className="input-field w-full sm:w-auto" style={{ minWidth: 130 }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="origin">By origin date</option>
            </select>
          </div>

          {/* Status filters */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {["all", "unverified", "investigating", "confirmed", "debunked", "disputed", "archived"].map((s) => (
              <button key={s} onClick={() => updateStatusFilter(s)} className={`filter-chip ${statusFilter === s ? "active" : ""}`}>
                {s === "all" ? "ALL" : (STATUS_META[s]?.label ?? s.toUpperCase())}
              </button>
            ))}
          </div>

          {/* Origin date range filter */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto]" style={{ gap: 8, marginTop: 12, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Origin date range
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => updateDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="input-field"
              style={{ fontSize: 12 }}
              aria-label="Origin date from"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => updateDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="input-field"
              style={{ fontSize: 12 }}
              aria-label="Origin date to"
            />
            {(dateFrom || dateTo) && (
              <button type="button" onClick={() => { updateDateFrom(""); updateDateTo(""); }} className="btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }}>
                Clear dates
              </button>
            )}
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
              const conf = calculateConfidence(claim.status, claim.evidence?.[0]?.count ?? 0);
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
                        <span
                          onClick={(e) => { if (claim.profiles?.username) { e.preventDefault(); e.stopPropagation(); router.push(`/users/${claim.profiles.username}`); } }}
                          style={{ cursor: claim.profiles?.username ? "pointer" : "default" }}
                        >
                          @{claim.profiles?.username ?? "unknown"}
                        </span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span title={new Date(claim.created_at).toLocaleString()}>{timeAgo(claim.created_at)}</span>
                        {claim.estimated_origin_at && (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span title={new Date(claim.estimated_origin_at).toLocaleString()}>Origin: {new Date(claim.estimated_origin_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
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

        {/* Pagination */}
        {!loading && totalCount > PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              Page {page + 1} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))} · {totalCount} claims
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary" style={{ fontSize: 13, opacity: page === 0 ? 0.5 : 1 }}>
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => (p + 1 < Math.ceil(totalCount / PAGE_SIZE) ? p + 1 : p))}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
                className="btn-secondary"
                style={{ fontSize: 13, opacity: (page + 1) * PAGE_SIZE >= totalCount ? 0.5 : 1 }}
              >
                Next →
              </button>
            </div>
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
