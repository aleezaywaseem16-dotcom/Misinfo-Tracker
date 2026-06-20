'use client'

import { supabase } from "@/lib/supabase"
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface LiveClaim {
  id: string
  title: string
  status: string
  created_at: string
}

interface Stats {
  total: number
  investigating: number
  evidenceSources: number
  verdicts: number
}

const S_COLOR: Record<string, string> = {
  investigating: '#fbbf24',
  debunked:      '#4ade80',
  confirmed:     '#f87171',
  disputed:      '#fb923c',
  unverified:    '#64748b',
}

const S_LABEL: Record<string, string> = {
  investigating: 'INVEST.',
  debunked:      'DEBUNKED',
  confirmed:     'CONFIRMED',
  disputed:      'DISPUTED',
  unverified:    'UNVERIFIED',
}

function timeAgo(d: string) {
  const date = new Date(d)
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function HomePage() {
  const router = useRouter()
  const [claims, setClaims] = useState<LiveClaim[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, investigating: 0, evidenceSources: 0, verdicts: 0 })
  const [loading, setLoading] = useState(true)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/dashboard')
      else setCheckingSession(false)
    })

    async function load() {
      const [
        { count: total },
        { count: investigating },
        { count: debunked },
        { count: confirmed },
        { count: evidence },
        { data: recentClaims },
      ] = await Promise.all([
        supabase.from('claims').select('*', { count: 'exact', head: true }).eq('visibility', 'public').is('deleted_at', null),
        supabase.from('claims').select('*', { count: 'exact', head: true }).eq('status', 'investigating').eq('visibility', 'public').is('deleted_at', null),
        supabase.from('claims').select('*', { count: 'exact', head: true }).eq('status', 'debunked').eq('visibility', 'public').is('deleted_at', null),
        supabase.from('claims').select('*', { count: 'exact', head: true }).eq('status', 'confirmed').eq('visibility', 'public').is('deleted_at', null),
        supabase.from('evidence').select('*', { count: 'exact', head: true }),
        supabase.from('claims')
          .select('id, title, status, created_at')
          .eq('visibility', 'public')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setStats({
        total: total ?? 0,
        investigating: investigating ?? 0,
        evidenceSources: evidence ?? 0,
        verdicts: (debunked ?? 0) + (confirmed ?? 0),
      })
      setClaims((recentClaims ?? []) as LiveClaim[])
      setLoading(false)
    }

    load()
  }, [router])

  const feedClaims = claims.length >= 2 ? [...claims, ...claims] : claims

  if (checkingSession) {
    return (
      <main className="lp" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(190,242,100,0.15)', borderTopColor: '#bef264', animation: 'cb-spin 0.8s linear infinite' }} />
        <style>{`@keyframes cb-spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  return (
    <main className="lp">

      {/* ━━━ NAV ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <Link href="/" className="lp-logo">
            <span className="lp-bracket">[</span>MISINFO<span className="lp-lo-accent">TRACKER</span><span className="lp-bracket">]</span>
          </Link>
          <div className="lp-nav-r">
            <Link href="/claims" className="lp-nav-link">Browse Claims</Link>
            <Link href="/login" className="lp-nav-cta">Sign In →</Link>
          </div>
        </div>
        <div className="lp-nav-underline" />
      </nav>

      {/* ━━━ HERO — SPLIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-hero">

        {/* Left — headline + stats */}
        <div className="lp-hero-l">
          <p className="lp-badge"><span className="lp-pulse" />LIVE INTELLIGENCE PLATFORM</p>

          <h1 className="lp-h1">
            Track how<br />
            <em className="lp-h1-em">misinformation</em><br />
            spreads.
          </h1>

          <p className="lp-h1-sub">
            Investigate claims, evaluate evidence, and separate facts from misinformation through transparent verification.
          </p>

          <div className="lp-hero-actions">
            <Link href="/login" className="lp-cta-btn">Start Investigating</Link>
            <Link href="/claims" className="lp-ghost-link">Browse Claims →</Link>
          </div>

          {/* Stats row */}
          <div className="lp-stats">
            {[
              { n: loading ? '—' : stats.total.toLocaleString(),           l: 'Claims' },
              { n: loading ? '—' : stats.investigating.toLocaleString(),   l: 'Under Review' },
              { n: loading ? '—' : stats.evidenceSources.toLocaleString(), l: 'Evidence Sources' },
              { n: loading ? '—' : stats.verdicts.toLocaleString(),        l: 'Verdicts' },
            ].map((s, i) => (
              <div key={i} className="lp-stat-wrap">
                {i > 0 && <div className="lp-stat-sep" />}
                <div className="lp-stat">
                  <span className="lp-stat-n">{s.n}</span>
                  <span className="lp-stat-l">{s.l}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vertical rule */}
        <div className="lp-vr" />

        {/* Right — live feed */}
        <div className="lp-hero-r">
          <div className="lp-feed-hd">
            <span className="lp-feed-label">LIVE CLAIMS FEED</span>
            {!loading && <span className="lp-feed-new">{claims.length} recent</span>}
          </div>

          {loading ? (
            <div className="lp-feed-skeletons">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="lp-feed-skel" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          ) : claims.length === 0 ? (
            <div className="lp-feed-empty">No claims yet.</div>
          ) : (
            <div className="lp-feed-outer">
              <div className="lp-feed-inner" style={{ animationDuration: `${Math.max(18, feedClaims.length * 2.5)}s` }}>
                {feedClaims.map((c, i) => (
                  <div key={`${c.id}-${i}`} className={`lp-feed-row${i === 0 ? ' lp-feed-row-latest' : ''}`}>
                    <div className="lp-feed-row-top">
                      <span className="lp-feed-id">{c.id.slice(0, 8).toUpperCase()}</span>
                      <span className="lp-feed-t" title={new Date(c.created_at).toLocaleString()}>{timeAgo(c.created_at)}</span>
                    </div>
                    <div className="lp-feed-title">{c.title}</div>
                    <div className="lp-feed-meta">
                      <span className="lp-feed-dot" style={{ background: S_COLOR[c.status] ?? '#64748b' }} />
                      <span style={{ color: S_COLOR[c.status] ?? '#64748b', fontFamily: "'Space Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                        {S_LABEL[c.status] ?? c.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ TICKER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="lp-ticker">
        <div className="lp-ticker-live">◉ LIVE</div>
        <div className="lp-ticker-track-outer">
          <div className="lp-ticker-track">
            {(claims.length > 0
              ? [...claims, ...claims].map((c) => `${c.title} → ${S_LABEL[c.status] ?? c.status.toUpperCase()}`)
              : ['Loading live claims...', 'Loading live claims...']
            ).map((t, i) => (
              <span key={i} className="lp-tick-item">
                {t}
                <span className="lp-tick-sep">·</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ━━━ 01 — INVESTIGATION TABLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-sec">
        <div className="lp-sec-hd">
          <span className="lp-sec-num">01</span>
          <div>
            <span className="lp-sec-eye">Investigation Board</span>
            <h2 className="lp-sec-title">Claims Under Review</h2>
          </div>
          <Link href="/claims" className="lp-sec-link">View all →</Link>
        </div>

        <div className="lp-table">
          <div className="lp-table-hd">
            <span>CLAIM ID</span>
            <span>TITLE</span>
            <span>STATUS</span>
            <span className="lp-hide-sm">AGE</span>
          </div>
          {loading
            ? [...Array(5)].map((_, i) => (
                <div key={i} className="lp-table-row lp-table-skel">
                  <div className="lp-skel-line" style={{ width: '80px' }} />
                  <div className="lp-skel-line" style={{ width: '60%' }} />
                  <div className="lp-skel-line" style={{ width: '70px' }} />
                  <div className="lp-skel-line lp-hide-sm" style={{ width: '40px' }} />
                </div>
              ))
            : claims.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/claims/${c.id}`} className="lp-table-row lp-table-row-link">
                  <span className="lp-td-id">{c.id.slice(0, 8).toUpperCase()}</span>
                  <span className="lp-td-title">{c.title}</span>
                  <span className="lp-td-status">
                    <span className="lp-td-dot" style={{ background: S_COLOR[c.status] ?? '#64748b' }} />
                    <span style={{ color: S_COLOR[c.status] ?? '#64748b' }}>{S_LABEL[c.status] ?? c.status.toUpperCase()}</span>
                  </span>
                  <span className="lp-td-mono lp-hide-sm" title={new Date(c.created_at).toLocaleString()}>{timeAgo(c.created_at)}</span>
                </Link>
              ))
          }
        </div>
      </section>

      {/* ━━━ 02 — LIFECYCLE PIPELINE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-sec lp-sec-alt">
        <div className="lp-sec-hd">
          <span className="lp-sec-num">02</span>
          <div>
            <span className="lp-sec-eye">Claim Lifecycle</span>
            <h2 className="lp-sec-title">From Submission to Verdict</h2>
          </div>
        </div>

        <div className="lp-pipeline">
          <div className="lp-pipeline-track" />
          {[
            { n: '01', label: 'Submit',      desc: 'A claim is filed with a source URL and category tag.' },
            { n: '02', label: 'Investigate', desc: 'Investigators attach evidence and cast credibility votes.' },
            { n: '03', label: 'Review',      desc: 'Community scrutiny and AI-assisted pattern detection.' },
            { n: '04', label: 'Verdict',     desc: 'Consensus reached — confirmed, debunked, or disputed.' },
            { n: '05', label: 'Archive',     desc: 'Stored for historical record and pattern analysis.' },
          ].map((s) => (
            <div key={s.n} className="lp-step">
              <div className="lp-step-n">{s.n}</div>
              <div className="lp-step-label">{s.label}</div>
              <p className="lp-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ 03 — FEATURES GRID ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-sec">
        <div className="lp-sec-hd">
          <span className="lp-sec-num">03</span>
          <div>
            <span className="lp-sec-eye">Platform Principles</span>
            <h2 className="lp-sec-title">Built for Accountability</h2>
          </div>
        </div>

        <div className="lp-feat-grid">
          {[
            { code: 'TRANSP', n: '01', title: 'Transparent Evidence',   desc: 'Every verdict links directly to its sources. No black-box scoring — you see exactly why a claim was confirmed or debunked.' },
            { code: 'COMMUN', n: '02', title: 'Community Moderation',   desc: 'Reputation-weighted voting ensures experienced contributors have meaningful influence over outcomes.' },
            { code: 'HISTOR', n: '03', title: 'Historical Tracking',    desc: 'Monitor how narratives evolve over time. Catch recycled misinformation before it gains new traction.' },
            { code: 'SOURCE', n: '04', title: 'Source Verification',    desc: 'Automated credibility scoring for every linked domain, updated continuously as source reliability shifts.' },
          ].map((f) => (
            <div key={f.code} className="lp-feat-card">
              <span className="lp-feat-code">{f.code}</span>
              <span className="lp-feat-bg">{f.n}</span>
              <h3 className="lp-feat-title">{f.title}</h3>
              <p className="lp-feat-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="lp-cta">
        <div className="lp-cta-bar" />
        <div className="lp-cta-body">
          <span className="lp-sec-eye">Open to Investigators</span>
          <h2 className="lp-cta-h">
            Misinformation<br />spreads in seconds.
          </h2>
          <p className="lp-cta-sub">Your investigation starts now.</p>
          <div className="lp-cta-actions">
            <Link href="/signup" className="lp-cta-btn">Create Free Account</Link>
            <span className="lp-cta-note">No paywalls. No subscriptions. Verdicts are public.</span>
          </div>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-footer-logo">
            <span className="lp-bracket">[</span>MT<span className="lp-bracket">]</span>
          </span>
          <span className="lp-footer-tag">Detect · Verify · Trust</span>
          <nav className="lp-footer-links">
            <Link href="/claims">Claims</Link>
            <Link href="/login">Sign In</Link>
          </nav>
        </div>
      </footer>

      <style>{`
        /* ── Root ──────────────────────────────────────────────────── */
        * { box-sizing: border-box; }
        .lp {
          min-height: 100vh;
          background: #07080a;
          color: #e8eaf2;
          font-family: 'Space Grotesk', sans-serif;
        }

        /* ── Nav ───────────────────────────────────────────────────── */
        .lp-nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(7,8,10,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .lp-nav-inner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 2.5rem; max-width: 1440px; margin: 0 auto; height: 52px;
        }
        .lp-nav-underline {
          height: 1px;
          background: linear-gradient(90deg, #bef264 0%, rgba(190,242,100,0.15) 40%, transparent 70%);
        }
        .lp-logo {
          font-family: 'Space Mono', monospace;
          font-size: 0.92rem; font-weight: 700; letter-spacing: 0.08em;
          color: #e8eaf2; text-decoration: none;
        }
        .lp-bracket   { color: #bef264; }
        .lp-lo-accent { color: #bef264; }
        .lp-nav-r { display: flex; align-items: center; gap: 1.5rem; }
        .lp-nav-link {
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); text-decoration: none; transition: color 0.15s;
        }
        .lp-nav-link:hover { color: #e8eaf2; }
        .lp-nav-cta {
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase;
          color: #bef264; text-decoration: none;
          border: 1px solid rgba(190,242,100,0.3);
          padding: 5px 13px; border-radius: 2px; transition: all 0.15s;
        }
        .lp-nav-cta:hover { background: rgba(190,242,100,0.08); border-color: #bef264; }

        /* ── Hero ──────────────────────────────────────────────────── */
        /*
         * height = viewport minus nav (53px = 52px inner + 1px underline).
         * The left column uses justify-content:center + padding-bottom:18vh
         * to shift the content centroid to ~42% of viewport — the industry
         * standard "above true center" position used by Stripe / Linear / Vercel.
         */
        .lp-hero {
          display: grid;
          /* was an even 1fr/1fr split, which let the feed compete visually
             with the headline instead of supporting it - headline column
             now gets more weight */
          grid-template-columns: 1.35fr 1px 1fr;
          min-height: calc(100vh - 53px);
          max-width: 1440px;
          margin: 0 auto;
          align-items: center;
          padding: 4rem 0;
        }

        /* Left panel — vertical centering now comes from .lp-hero's own
           align-items:center, so this just needs normal padding instead of
           the old padding-bottom:18vh centroid-shifting hack */
        .lp-hero-l {
          display: flex;
          flex-direction: column;
          padding: 0 4rem;
          gap: 1.5rem;
        }

        .lp-badge {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'Space Mono', monospace;
          font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase;
          color: #bef264; margin: 0; width: fit-content;
        }
        .lp-pulse {
          display: inline-block;
          width: 7px; height: 7px; border-radius: 50%;
          background: #bef264; flex-shrink: 0;
          animation: lp-pulse 2.4s ease-in-out infinite;
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(190,242,100,0.55); }
          60%       { opacity: 0.7; box-shadow: 0 0 0 8px rgba(190,242,100,0); }
        }

        .lp-h1 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(2.6rem, 4vw, 4.2rem);
          font-weight: 800;
          line-height: 1.0;
          letter-spacing: -0.045em;
          color: #e8eaf2;
          margin: 0;
        }
        .lp-h1-em { font-style: normal; color: #bef264; }

        .lp-h1-sub {
          font-size: 1.02rem;
          line-height: 1.7;
          color: rgba(255,255,255,0.48);
          max-width: 480px;
          margin: 0;
        }

        .lp-hero-actions {
          display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;
        }
        .lp-cta-btn {
          display: inline-block;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.88rem; font-weight: 700;
          background: #bef264; color: #070a00;
          padding: 11px 24px; border-radius: 2px;
          text-decoration: none;
          transition: background 0.15s, box-shadow 0.15s;
          border: none; cursor: pointer; white-space: nowrap;
        }
        .lp-cta-btn:hover {
          background: #cffb76;
          box-shadow: 0 0 0 4px rgba(190,242,100,0.2);
        }
        .lp-ghost-link {
          font-family: 'Space Mono', monospace;
          font-size: 0.73rem; letter-spacing: 0.05em;
          color: rgba(255,255,255,0.35); text-decoration: none; transition: color 0.15s;
          white-space: nowrap;
        }
        .lp-ghost-link:hover { color: #e8eaf2; }

        /* Stats row — was easy to miss next to the giant headline (1.45rem
           numbers, hairline separators, no background); now reads as its
           own showcase strip instead of a footnote */
        .lp-stats {
          display: flex; align-items: stretch;
          margin-top: 0.5rem;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 4px;
          gap: 0;
        }
        .lp-stat-wrap { display: flex; align-items: stretch; flex: 1; }
        .lp-stat {
          display: flex; flex-direction: column; gap: 5px;
          padding: 1.1rem 1.25rem;
          flex: 1;
        }
        .lp-stat-n {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 2.1rem; font-weight: 800;
          letter-spacing: -0.04em; color: #e8eaf2; line-height: 1;
        }
        .lp-stat-l {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(255,255,255,0.38);
        }
        .lp-stat-sep {
          width: 1px;
          background: rgba(255,255,255,0.07);
          flex-shrink: 0;
        }

        /* Vertical divider */
        .lp-vr {
          width: 1px; margin: 3.5rem 0; align-self: stretch;
          background: linear-gradient(180deg,
            transparent 0%,
            rgba(190,242,100,0.2) 18%,
            rgba(190,242,100,0.2) 82%,
            transparent 100%
          );
        }

        /* Right panel — live feed. Deliberately narrower and visually
           quieter than the headline column (border instead of a filled
           card) so it reads as supporting context, not a competing block. */
        .lp-hero-r {
          display: flex;
          flex-direction: column;
          padding: 2rem 3.5rem 2rem 3rem;
          max-height: 460px;
          gap: 0.75rem;
          overflow: hidden;
        }
        .lp-feed-hd {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .lp-feed-label {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.17em; text-transform: uppercase;
          color: rgba(255,255,255,0.28);
        }
        .lp-feed-new {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.07em; color: #bef264;
        }
        .lp-feed-skeletons { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }
        .lp-feed-skel {
          height: 62px; border-radius: 2px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: lp-shimmer 1.4s infinite;
        }
        @keyframes lp-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .lp-feed-empty {
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem; color: rgba(255,255,255,0.2);
          padding-top: 1rem;
        }
        .lp-feed-outer {
          flex: 1; overflow: hidden; position: relative; min-height: 0;
        }
        .lp-feed-outer::before, .lp-feed-outer::after {
          content: ''; position: absolute; left: 0; right: 0; z-index: 2; pointer-events: none;
        }
        .lp-feed-outer::before {
          top: 0; height: 40px;
          background: linear-gradient(to bottom, #07080a, transparent);
        }
        .lp-feed-outer::after {
          bottom: 0; height: 60px;
          background: linear-gradient(to top, #07080a, transparent);
        }
        .lp-feed-inner {
          display: flex; flex-direction: column;
          animation: lp-feed 30s linear infinite;
        }
        @keyframes lp-feed {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .lp-feed-row {
          padding: 12px 0 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          display: flex; flex-direction: column; gap: 5px;
          border-left: 2px solid transparent;
          transition: border-left-color 0.2s;
        }
        .lp-feed-row-latest {
          border-left-color: rgba(190,242,100,0.55);
          padding-left: 10px;
          background: linear-gradient(90deg, rgba(190,242,100,0.04) 0%, transparent 55%);
        }
        .lp-feed-row-top { display: flex; justify-content: space-between; align-items: center; }
        .lp-feed-id {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.07em; color: rgba(255,255,255,0.24);
        }
        .lp-feed-t {
          font-family: 'Space Mono', monospace;
          font-size: 0.57rem; color: rgba(255,255,255,0.16);
        }
        .lp-feed-title {
          font-size: 0.88rem; font-weight: 600;
          color: rgba(255,255,255,0.8); line-height: 1.3;
        }
        .lp-feed-meta { display: flex; align-items: center; gap: 7px; }
        .lp-feed-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

        /* ── Ticker ────────────────────────────────────────────────── */
        .lp-ticker {
          display: flex; align-items: stretch; overflow: hidden;
          background: rgba(0,0,0,0.4);
          border-top: 1px solid rgba(190,242,100,0.12);
          border-bottom: 1px solid rgba(190,242,100,0.12);
          height: 34px;
        }
        .lp-ticker-live {
          display: flex; align-items: center; flex-shrink: 0;
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.16em;
          color: #bef264; padding: 0 1.1rem;
          border-right: 1px solid rgba(190,242,100,0.16);
          background: rgba(190,242,100,0.04);
          white-space: nowrap;
        }
        .lp-ticker-track-outer { flex: 1; overflow: hidden; display: flex; align-items: center; }
        .lp-ticker-track {
          display: flex; align-items: center; white-space: nowrap;
          animation: lp-ticker 40s linear infinite;
        }
        @keyframes lp-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lp-tick-item {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.04em;
          color: rgba(255,255,255,0.3); padding: 0 1.5rem;
          display: flex; align-items: center; gap: 1.5rem;
        }
        .lp-tick-sep { color: rgba(190,242,100,0.38); }

        /* ── Sections ──────────────────────────────────────────────── */
        .lp-sec {
          max-width: 1440px; margin: 0 auto;
          padding: 4.5rem 2.5rem;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .lp-sec-alt { background: #05060a; max-width: 100%; padding: 4.5rem 2.5rem; }
        .lp-sec-alt .lp-sec-hd,
        .lp-sec-alt .lp-pipeline { max-width: 1440px; margin-left: auto; margin-right: auto; }
        .lp-sec-hd {
          display: flex; align-items: flex-start; gap: 2rem; margin-bottom: 2.5rem;
        }
        .lp-sec-num {
          font-family: 'Space Mono', monospace;
          font-size: 4rem; font-weight: 700; line-height: 1;
          color: rgba(190,242,100,0.1);
          flex-shrink: 0; margin-top: -0.5rem; letter-spacing: -0.02em;
        }
        .lp-sec-eye {
          display: block;
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase;
          color: #bef264; margin-bottom: 7px;
        }
        .lp-sec-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(1.4rem, 2.8vw, 2.1rem);
          font-weight: 700; letter-spacing: -0.04em;
          color: #e8eaf2; margin: 0;
        }
        .lp-sec-link {
          font-family: 'Space Mono', monospace;
          font-size: 0.68rem; letter-spacing: 0.07em;
          color: rgba(255,255,255,0.28); text-decoration: none;
          margin-left: auto; padding-top: 0.35rem;
          transition: color 0.15s; white-space: nowrap;
        }
        .lp-sec-link:hover { color: #bef264; }

        /* ── Terminal table ────────────────────────────────────────── */
        .lp-table {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 2px; overflow: hidden;
        }
        .lp-table-hd {
          display: grid;
          grid-template-columns: 110px 1fr 130px 80px;
          padding: 10px 18px;
          background: rgba(255,255,255,0.025);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-family: 'Space Mono', monospace;
          font-size: 0.58rem; letter-spacing: 0.15em;
          text-transform: uppercase; color: rgba(255,255,255,0.26);
        }
        .lp-table-row {
          display: grid;
          grid-template-columns: 110px 1fr 130px 80px;
          padding: 14px 18px; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          border-left: 2px solid transparent;
          transition: background 0.12s, border-left-color 0.12s, padding-left 0.12s;
        }
        .lp-table-row-link { text-decoration: none; cursor: pointer; }
        .lp-table-row:last-child { border-bottom: none; }
        .lp-table-row:hover {
          background: rgba(190,242,100,0.03);
          border-left-color: #bef264;
          padding-left: 16px;
        }
        .lp-table-skel { cursor: default; }
        .lp-table-skel:hover { background: transparent; border-left-color: transparent; padding-left: 18px; }
        .lp-skel-line {
          height: 10px; border-radius: 2px;
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: lp-shimmer 1.4s infinite;
        }
        .lp-td-id {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; color: rgba(255,255,255,0.26);
        }
        .lp-td-title {
          font-size: 0.87rem; font-weight: 500;
          color: rgba(255,255,255,0.8);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          padding-right: 1rem;
        }
        .lp-td-status {
          display: flex; align-items: center; gap: 6px;
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.09em;
        }
        .lp-td-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .lp-td-mono {
          font-family: 'Space Mono', monospace;
          font-size: 0.67rem; color: rgba(255,255,255,0.34);
        }

        /* ── Pipeline ──────────────────────────────────────────────── */
        .lp-pipeline {
          display: grid; grid-template-columns: repeat(5, 1fr);
          position: relative;
        }
        .lp-pipeline-track {
          position: absolute; top: 20px; left: 8%; right: 8%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(190,242,100,0.18) 15%, rgba(190,242,100,0.18) 85%, transparent);
          pointer-events: none;
        }
        .lp-step {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          gap: 12px; position: relative; z-index: 1; padding: 0 1rem;
        }
        .lp-step-n {
          width: 40px; height: 40px; border-radius: 2px;
          border: 1px solid rgba(190,242,100,0.32);
          background: #05060a;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem; font-weight: 700; color: #bef264;
          flex-shrink: 0;
        }
        .lp-step-label {
          font-size: 0.92rem; font-weight: 700;
          color: #e8eaf2; letter-spacing: -0.01em;
        }
        .lp-step-desc {
          font-size: 0.77rem; line-height: 1.6;
          color: rgba(255,255,255,0.36); max-width: 155px; margin: 0;
        }

        /* ── Feature grid ──────────────────────────────────────────── */
        .lp-feat-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 1px; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;
        }
        .lp-feat-card {
          background: #07080a; padding: 2.5rem 2.75rem;
          position: relative; overflow: hidden; transition: background 0.2s;
        }
        .lp-feat-card:hover { background: #0b0c0f; }
        .lp-feat-code {
          display: block;
          font-family: 'Space Mono', monospace;
          font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(190,242,100,0.4); margin-bottom: 1.75rem;
        }
        .lp-feat-bg {
          position: absolute; bottom: 0.5rem; right: 1.5rem;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 7rem; font-weight: 800; line-height: 1;
          color: rgba(255,255,255,0.022); letter-spacing: -0.07em;
          pointer-events: none; user-select: none;
        }
        .lp-feat-title {
          font-size: 1.05rem; font-weight: 700;
          color: #e8eaf2; letter-spacing: -0.02em; margin: 0 0 10px;
        }
        .lp-feat-desc {
          font-size: 0.83rem; line-height: 1.7;
          color: rgba(255,255,255,0.4); margin: 0;
        }

        /* ── CTA ───────────────────────────────────────────────────── */
        .lp-cta {
          border-top: 1px solid rgba(255,255,255,0.04);
          display: flex; min-height: 300px;
        }
        .lp-cta-bar { width: 5px; flex-shrink: 0; background: #bef264; }
        .lp-cta-body {
          flex: 1; display: flex; flex-direction: column;
          justify-content: center; gap: 1.25rem;
          padding: 4rem 5rem; background: #05060a;
        }
        .lp-cta-h {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(2rem, 4vw, 3.8rem);
          font-weight: 700; letter-spacing: -0.055em; line-height: 1;
          color: #e8eaf2; margin: 0;
        }
        .lp-cta-sub {
          font-family: 'Space Mono', monospace;
          font-size: 0.8rem; letter-spacing: 0.05em;
          color: #bef264; margin: 0;
        }
        .lp-cta-actions {
          display: flex; align-items: center; gap: 2rem;
          flex-wrap: wrap; margin-top: 0.5rem;
        }
        .lp-cta-note {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.05em;
          color: rgba(255,255,255,0.2);
        }

        /* ── Footer ────────────────────────────────────────────────── */
        .lp-footer {
          border-top: 1px solid rgba(255,255,255,0.04);
          background: #04050a;
        }
        .lp-footer-inner {
          max-width: 1440px; margin: 0 auto; padding: 1.5rem 2.5rem;
          display: flex; align-items: center; gap: 1.5rem;
        }
        .lp-footer-logo {
          font-family: 'Space Mono', monospace;
          font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em;
          color: rgba(255,255,255,0.32);
        }
        .lp-footer-tag {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.1em;
          color: rgba(255,255,255,0.16);
        }
        .lp-footer-links { display: flex; gap: 1.5rem; margin-left: auto; }
        .lp-footer-links a {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.09em; text-transform: uppercase;
          color: rgba(255,255,255,0.2); text-decoration: none; transition: color 0.15s;
        }
        .lp-footer-links a:hover { color: #bef264; }

        /* ── Tablet (≤960px) ───────────────────────────────────────── */
        @media (max-width: 960px) {
          .lp-hero {
            grid-template-columns: 1fr;
            height: auto;
            min-height: calc(100vh - 53px);
          }
          .lp-vr { display: none; }
          .lp-hero-l {
            padding: 4rem 1.75rem 2.5rem;
            gap: 1.25rem;
          }
          .lp-hero-r {
            padding: 2rem 1.75rem 3rem;
            justify-content: flex-start;
            max-height: 380px;
          }
          .lp-table-hd, .lp-table-row { grid-template-columns: 110px 1fr 110px; }
          .lp-hide-sm { display: none; }
          .lp-pipeline { grid-template-columns: 1fr; gap: 2rem; }
          .lp-pipeline-track { display: none; }
          .lp-step { align-items: flex-start; text-align: left; flex-direction: row; gap: 1rem; padding: 0; }
          .lp-step-desc { max-width: none; }
          .lp-feat-grid { grid-template-columns: 1fr; }
          .lp-cta-body { padding: 3rem 1.75rem; }
          .lp-sec { padding: 3rem 1.75rem; }
          .lp-sec-alt { padding: 3rem 1.75rem; }
          .lp-nav-inner { padding: 0 1.25rem; }
          .lp-stats { flex-wrap: wrap; background: none; border: none; gap: 0.75rem; }
          .lp-stat-sep { display: none; }
          .lp-stat-wrap { flex: 1 1 40%; }
          .lp-stat {
            padding: 0.9rem 1rem;
            background: rgba(255,255,255,0.025);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 4px;
          }
        }

        /* ── Mobile (≤600px) ───────────────────────────────────────── */
        @media (max-width: 600px) {
          .lp-hero-l { padding: 3rem 1.25rem 2rem; }
          .lp-h1 { font-size: 2.4rem; }
          .lp-cta-h { font-size: 2rem; }
          .lp-sec-num { font-size: 3rem; }
          .lp-hero-r { padding: 1.5rem 1.25rem 2.5rem; max-height: 320px; }
          .lp-nav-link { display: none; }
          .lp-stat-wrap { flex: 1 1 100%; }
          .lp-stat-n { font-size: 1.7rem; }
        }
      `}</style>
    </main>
  )
}
