"use client";
import { FormEvent, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Claim {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: string;
  estimated_origin_at: string;
  created_at: string;
  created_by: string;
  source_url: string | null;
  source_type: string | null;
  profiles: { display_name: string; username: string; avatar_url: string | null } | null;
  categories: { name: string } | null;
}

interface Evidence {
  id: string;
  title: string | null;
  content: string | null;
  evidence_url: string | null;
  image_url: string | null;
  document_url: string | null;
  created_at: string;
  profiles: { display_name: string; username: string } | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  created_by: string;
  profiles: { display_name: string; username: string; avatar_url: string | null } | null;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function statusRiskText(status: string) {
  switch (status) {
    case "confirmed": return "Impact high";
    case "investigating": return "Investigation active";
    case "disputed": return "Unstable claim";
    case "unverified": return "Needs review";
    case "debunked": return "Resolved";
    default: return "Status unknown";
  }
}

function confidenceScore(status: string, evidenceCount: number, upvotes: number, downvotes: number): number {
  const base: Record<string, number> = { confirmed: 70, investigating: 48, disputed: 38, unverified: 22, debunked: 10, archived: 18 };
  const evidenceBonus = Math.min(evidenceCount * 5, 25);
  const totalVotes = upvotes + downvotes;
  const voteBonus = totalVotes > 0 ? Math.round((upvotes / totalVotes) * 15) : 0;
  return Math.min(95, Math.max(5, (base[status] ?? 30) + evidenceBonus + voteBonus));
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  confidence?: string | number | null;
  sourceUrl?: string | null;
}

interface VoteCounts { upvotes: number; downvotes: number; }

const initialChatMessages: ChatMessage[] = [
  { role: "assistant", text: "Ask about this claim, its evidence, confidence score, or what to monitor next." },
];

const quickChatPrompts = [
  "Summarize the strongest evidence for this claim.",
  "Why is this claim ranked as high risk?",
  "What follow-up action should I take on this claim?",
];

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [userId, setUserId] = useState<string | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({ upvotes: 0, downvotes: 0 });
  const [userVote, setUserVote] = useState<"upvote" | "downvote" | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [watchError, setWatchError] = useState("");
  const [voteError, setVoteError] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const tabsSectionRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<"evidence" | "comments">("evidence");
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);

  // Switches the tab AND scrolls it into view — buttons that jump to a tab
  // from elsewhere on the page (sidebar, summary cards) live far from the
  // tab section itself, so setting state alone leaves the change off-screen
  // and looks like nothing happened.
  function goToTab(tab: "evidence" | "comments") {
    setActiveTab(tab);
    tabsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const loadClaim = useCallback(async () => {
    const { data } = await supabase.from("claims")
      .select(`id, title, description, status, visibility, estimated_origin_at, created_at, created_by, source_url, source_type, profiles!claims_created_by_fkey ( display_name, username, avatar_url ), categories ( name )`)
      .eq("id", id).is("deleted_at", null).single();
    if (data) setClaim(data as unknown as Claim);
  }, [id]);

  const loadEvidence = useCallback(async () => {
    const { data } = await supabase.from("evidence")
      .select(`id, title, content, evidence_url, image_url, document_url, created_at, profiles!evidence_created_by_fkey ( display_name, username )`)
      .eq("claim_id", id).is("deleted_at", null).order("created_at", { ascending: false });
    setEvidence((data as unknown as Evidence[]) ?? []);
  }, [id]);

  const loadVotes = useCallback(async (uid?: string) => {
    const { data: allVotes } = await supabase.from("claim_votes").select("vote_type, user_id").eq("claim_id", id);
    if (allVotes) {
      const votes = allVotes as Array<{ vote_type: string; user_id: string }>;
      setVoteCounts({
        upvotes: votes.filter((v) => v.vote_type === "upvote").length,
        downvotes: votes.filter((v) => v.vote_type === "downvote").length,
      });
      const myVote = uid ? votes.find((v) => v.user_id === uid) : undefined;
      if (myVote) setUserVote(myVote.vote_type as "upvote" | "downvote");
    }
  }, [id]);

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase.from("comments")
      .select(`id, content, created_at, parent_comment_id, created_by, profiles!comments_created_by_fkey ( display_name, username, avatar_url )`)
      .eq("claim_id", id).is("deleted_at", null).order("created_at", { ascending: true });
    if (error) console.error("Failed to load comments:", error.message);
    setComments((data as unknown as Comment[]) ?? []);
  }, [id]);

  const refreshWatchState = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const payload = await res.json();
      const list = (payload?.watchlist ?? []) as Array<{ claim_id: string }>;
      setWatching(list.some((row) => row.claim_id === id));
    } catch {
      /* ignore — watch state just won't be reflected until next load */
    }
  }, [id]);

  // Claims have a public visibility tier with an RLS policy allowing
  // anonymous reads, so viewing a claim must not require being signed in —
  // only the write actions (vote, comment, watchlist) do, and those already
  // guard on userId individually. Same fix as the claims list page.
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      const tasks = [loadClaim(), loadEvidence(), loadComments()];
      if (user) {
        setUserId(user.id);
        tasks.push(loadVotes(user.id), refreshWatchState());
      } else {
        tasks.push(loadVotes());
      }
      await Promise.all(tasks);
      setLoading(false);
    }
    init();
  }, [id, loadClaim, loadEvidence, loadComments, refreshWatchState, loadVotes]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  async function toggleWatch() {
    if (!userId) { setWatchError("Sign in to add claims to your watchlist."); return; }
    setWatchError("");
    const nextWatching = !watching;
    setWatching(nextWatching);
    try {
      const res = await fetch("/api/watchlist", {
        method: nextWatching ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: id }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? "Failed to update watchlist");
    } catch (err) {
      setWatching(!nextWatching);
      setWatchError(err instanceof Error ? err.message : "Failed to update watchlist.");
    }
  }

  async function submitComment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch('/api/comments/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: id, content: newComment.trim() }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? 'Failed to create comment');
      setNewComment("");
      await loadComments();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  }

  function startReply(commentId: string) {
    setReplyingToId(commentId);
    setReplyContent("");
    setCommentError("");
  }

  function cancelReply() {
    setReplyingToId(null);
    setReplyContent("");
  }

  async function submitReply(e: FormEvent<HTMLFormElement>, parentId: string) {
    e.preventDefault();
    if (!userId || !replyContent.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch('/api/comments/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: id, content: replyContent.trim(), parent_comment_id: parentId }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? 'Failed to post reply');
      setReplyingToId(null);
      setReplyContent("");
      await loadComments();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!window.confirm("Delete this comment? This can't be undone.")) return;
    setCommentError("");
    setDeletingCommentId(commentId);
    try {
      const res = await fetch('/api/comments/delete', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? 'Failed to delete comment');
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to delete comment');
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleVote(type: "upvote" | "downvote") {
    if (!userId) return;
    setVoteError("");

    // Optimistic update so the count reflects the click immediately instead of waiting on the round trip.
    const previousCounts = voteCounts;
    const previousVote = userVote;
    const clearing = previousVote === type;
    const optimisticCounts = { ...previousCounts };
    if (previousVote) optimisticCounts[previousVote === "upvote" ? "upvotes" : "downvotes"] -= 1;
    if (!clearing) optimisticCounts[type === "upvote" ? "upvotes" : "downvotes"] += 1;
    setVoteCounts(optimisticCounts);
    setUserVote(clearing ? null : type);

    try {
      const res = await fetch('/api/votes/toggle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: id, vote_type: type }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error ?? 'Vote failed');
      setVoteCounts({ upvotes: payload.upvotes, downvotes: payload.downvotes });
    } catch (err) {
      setVoteCounts(previousCounts);
      setUserVote(previousVote);
      setVoteError(err instanceof Error ? err.message : 'Vote failed. Please try again.');
    }
  }

  const confidence = useMemo(() => confidenceScore(claim?.status ?? "unverified", evidence.length, voteCounts.upvotes, voteCounts.downvotes), [claim?.status, evidence.length, voteCounts]);
  const evidenceSummary = evidence.slice(0, 3);

  const topLevelComments = useMemo(() => comments.filter((c) => !c.parent_comment_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.parent_comment_id) {
        const list = map.get(c.parent_comment_id) ?? [];
        list.push(c);
        map.set(c.parent_comment_id, list);
      }
    }
    return map;
  }, [comments]);

  function buildChatContext(question: string) {
    const summary = claim
      ? `Claim: ${claim.title}\nStatus: ${claim.status}\nConfidence: ${confidence}%\nEvidence count: ${evidence.length}\nDescription: ${claim.description ?? "No description provided."}`
      : "";
    const evidenceText = evidence.slice(0, 3)
      .map((item, index) => `Evidence ${index + 1}: ${item.title ?? "No title"}. ${item.content ?? "No summary available."}`)
      .join("\n");
    return `${summary}${evidenceText ? `\n\nTop evidence:\n${evidenceText}` : ""}\n\nUser question: ${question}`;
  }

  async function handleChatSend(message: string) {
    if (!message.trim()) return;
    const userMessage = message.trim();
    setChatError("");
    setChatMessages((current) => [...current, { role: "user", text: userMessage }]);
    setChatInput("");
    setChatSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: buildChatContext(userMessage) }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "AI service returned an error.");
      }
      const payload = await response.json();
      setChatMessages((current) => [...current, {
        role: "assistant",
        text: payload.response ?? "I couldn't generate a response.",
        confidence: payload.confidence ?? null,
        sourceUrl: payload.sourceUrl ?? null,
      }]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Unable to contact the chat service.");
      setChatMessages((current) => [...current, { role: "assistant", text: "I couldn't connect to the chat service. Please check configuration." }]);
    } finally {
      setChatSending(false);
    }
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleChatSend(chatInput);
  }

  if (loading) return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div className="page-spinner-wrap">
        <div className="page-spinner" />
      </div>
    </div>
  );

  if (!claim) return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 16px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <p>Claim not found.</p>
        <Link href="/claims" className="btn-ghost" style={{ textDecoration: 'none', marginTop: '16px', display: 'inline-flex' }}>← Back to claims</Link>
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(20px, 5vw, 36px) clamp(20px, 4vw, 64px) 48px' }}>

        {/* Breadcrumb navigation bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <Link href="/claims" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.78rem', padding: '5px 10px', flexShrink: 0 }}>
              ← Claims
            </Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {claim.title}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span className={`status-pill status-${claim.status}`}>
              <span className="status-dot" />
              {claim.status}
            </span>
            {claim.categories && (
              <span className="mono" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', padding: '3px 8px' }}>
                {claim.categories.name}
              </span>
            )}
            {claim.created_by === userId && (
              <Link href={`/claims/${id}/edit`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.78rem', padding: '5px 10px' }}>
                Edit
              </Link>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]" style={{ alignItems: 'start' }}>

          {/* ─── LEFT COLUMN: main content ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

            {/* Title + Description + Meta card */}
            <div className="card" style={{ padding: '32px 36px' }}>
              <div className="eyebrow" style={{ marginBottom: '12px' }}>Claim Intelligence</div>
              <h1 style={{
                fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 800,
                color: 'var(--text-primary)', letterSpacing: '-0.035em', lineHeight: 1.18,
                marginBottom: '14px', fontFamily: 'var(--font-display)',
              }}>
                {claim.title}
              </h1>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.95rem', maxWidth: '70ch' }}>
                {claim.description ?? "No description was provided for this claim yet."}
              </p>

              {/* Source */}
              {claim.source_url && (
                <div style={{ marginTop: '18px' }}>
                  <div className="eyebrow" style={{ marginBottom: '8px', fontSize: '0.62rem' }}>Source ({claim.source_type ?? 'link'})</div>
                  {claim.source_type === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={claim.source_url} alt="Claim source" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'block' }} />
                  ) : claim.source_type === 'text' ? (
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                      {claim.source_url}
                    </p>
                  ) : (
                    <a href={claim.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      View source →
                    </a>
                  )}
                </div>
              )}

              {/* Origin date row */}
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Origin: {new Date(claim.estimated_origin_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  by {claim.profiles?.username
                    ? <Link href={`/users/${claim.profiles.username}`} style={{ color: 'var(--text-muted)' }}>@{claim.profiles.username}</Link>
                    : '@unknown'}
                </span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={new Date(claim.created_at).toLocaleString()}>
                  {timeAgo(claim.created_at)} ({new Date(claim.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                </span>
              </div>

              {/* Confidence metrics row */}
              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '12px', marginTop: '22px' }}>
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div className="eyebrow" style={{ marginBottom: '6px', fontSize: '0.62rem' }}>Confidence</div>
                  <div className="data-num" style={{ fontSize: '1.5rem' }}>{confidence}%</div>
                  <div style={{ height: 2, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: '8px' }}>
                    <div style={{ width: `${confidence}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div className="eyebrow" style={{ marginBottom: '6px', fontSize: '0.62rem' }}>Signal</div>
                  <div className="data-num" style={{ fontSize: '1.5rem' }}>{evidence.length}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>evidence items</div>
                </div>
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div className="eyebrow" style={{ marginBottom: '6px', fontSize: '0.62rem' }}>Watchlist</div>
                  <div className="data-num" style={{ fontSize: '1.5rem', color: watching ? 'var(--accent)' : 'var(--text-primary)' }}>{watching ? 'ON' : 'OFF'}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>alert active</div>
                </div>
              </div>
            </div>

            {/* Evidence summary card */}
            <div className="card" style={{ padding: '26px 30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Evidence summary</div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '5px' }}>Key findings</h2>
                </div>
                <button type="button" onClick={() => goToTab("evidence")} className="btn-secondary" style={{ fontSize: '0.78rem', padding: '7px 14px', flexShrink: 0 }}>
                  View all evidence
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: '14px', fontSize: '0.88rem' }}>
                This claim is currently being monitored for status changes and additional evidence. The dashboard uses user input and evidence submissions to surface the strongest narratives.
              </p>
              {evidenceSummary.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {evidenceSummary.map((item) => (
                    <div key={item.id} className="card" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title ?? 'Unnamed evidence item'}
                        </div>
                        <span className="eyebrow" style={{ flexShrink: 0, fontSize: '0.6rem' }} title={new Date(item.created_at).toLocaleString()}>{timeAgo(item.created_at)}</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                        {item.content ?? 'No summary text available.'}
                      </p>
                      {item.evidence_url && (
                        <a href={item.evidence_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                          View source →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  No evidence has been added yet.{' '}
                  <Link href={`/claims/${id}/evidence/new`} style={{ color: 'var(--accent)' }}>Add the first source</Link>
                  {' '}to improve confidence.
                </div>
              )}
            </div>

            {/* Community stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '14px' }}>
              <button type="button" onClick={() => goToTab("comments")} className="card card-clickable" style={{ padding: '20px 24px', textAlign: 'left', color: 'var(--text-primary)', height: '100%' }}>
                <div className="eyebrow" style={{ marginBottom: '8px' }}>Community activity</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1 }}>{comments.length}</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '6px', lineHeight: 1.5 }}>comment{comments.length !== 1 ? 's' : ''} — follow the latest analysis</p>
              </button>
              <button type="button" onClick={() => goToTab("evidence")} className="card card-clickable" style={{ padding: '20px 24px', textAlign: 'left', color: 'var(--text-primary)', height: '100%' }}>
                <div className="eyebrow" style={{ marginBottom: '8px' }}>Evidence collection</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1 }}>{evidence.length}</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '6px', lineHeight: 1.5 }}>source{evidence.length !== 1 ? 's' : ''} — links, screenshots, and data</p>
              </button>
            </div>

            {/* AI Chat card */}
            <div className="card" style={{ padding: '26px 30px' }}>
              <div style={{ marginBottom: '14px' }}>
                <p className="eyebrow">Claim assistant</p>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '5px' }}>Ask the AI about this claim</h2>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '16px' }}>
                {quickChatPrompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => handleChatSend(prompt)} className="filter-chip" disabled={chatSending} style={{ fontSize: '0.72rem' }}>
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="chat-window" style={{ minHeight: chatMessages.length > 1 ? '260px' : '120px' }}>
                {chatMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`message-bubble ${message.role}`}>
                    <span className="message-label">{message.role === "user" ? "You" : "Assistant"}</span>
                    <p>{message.text}</p>
                    {message.confidence && <div className="mono" style={{ marginTop: '8px' }}>Confidence: {message.confidence}</div>}
                    {message.sourceUrl && (
                      <a href={message.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.85rem', marginTop: '8px', display: 'inline-block' }}>
                        View primary source
                      </a>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleChatSubmit} style={{ marginTop: '16px' }}>
                <label htmlFor="claim-chat-input" className="sr-only">Ask about this claim</label>
                <textarea
                  id="claim-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!chatSending && chatInput.trim()) handleChatSend(chatInput);
                    }
                  }}
                  rows={3}
                  placeholder="Ask the assistant about this claim, evidence, or next steps..."
                  className="input-field"
                  style={{ width: '100%' }}
                  disabled={chatSending}
                />
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Uses this claim&apos;s summary and top evidence.</p>
                  <button type="submit" className="btn-primary" disabled={chatSending || !chatInput.trim()}>
                    {chatSending ? 'Thinking...' : 'Send question'}
                  </button>
                </div>
                {chatError && <p style={{ color: 'var(--danger)', marginTop: '10px', fontSize: '0.85rem' }}>{chatError}</p>}
              </form>
            </div>

            {/* Tabs section */}
            <div ref={tabsSectionRef}>
              <div className="tab-bar">
                {(["evidence", "comments"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-item ${activeTab === tab ? 'active' : ''}`}>
                    {tab === 'evidence' ? `Evidence (${evidence.length})` : `Comments (${comments.length})`}
                  </button>
                ))}
              </div>

              {activeTab === "evidence" && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Link href={`/claims/${id}/evidence/new`} className="btn-primary" style={{ textDecoration: 'none', fontSize: '0.82rem', padding: '8px 16px' }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      Add Evidence
                    </Link>
                  </div>
                  {evidence.length === 0 ? (
                    <div className="empty-state">
                      No evidence yet —{' '}
                      <Link href={`/claims/${id}/evidence/new`} style={{ color: 'var(--accent)' }}>add a source</Link>
                      {' '}to improve the confidence signal.
                    </div>
                  ) : evidence.map((item, index) => (
                    <div key={item.id} className="evidence-card" style={{ animationDelay: `${index * 0.04}s` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <span className="mono" title={new Date(item.created_at).toLocaleString()}>{timeAgo(item.created_at)}</span>
                        {item.profiles?.username ? (
                          <Link href={`/users/${item.profiles.username}`} className="mono" style={{ marginLeft: 'auto' }}>{item.profiles.username}</Link>
                        ) : (
                          <span className="mono" style={{ marginLeft: 'auto' }}>source</span>
                        )}
                      </div>
                      {item.title && <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem', marginBottom: '6px' }}>{item.title}</h3>}
                      {item.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.title ?? 'Evidence image'} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'block', marginBottom: '10px' }} />
                      )}
                      {item.document_url && (
                        <a href={item.document_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '0.85rem', marginBottom: '10px' }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                          View attached document →
                        </a>
                      )}
                      {item.content && <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>{item.content}</p>}
                      {item.evidence_url && (
                        <a href={item.evidence_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '0.85rem', marginTop: '14px' }}>
                          View source →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "comments" && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <form onSubmit={submitComment} className="card" style={{ padding: '20px 24px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                      Share an update
                    </label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="What did you find? Add context or a follow-up detail..."
                      rows={4}
                      className="input-field"
                      style={{ width: '100%', marginTop: '12px', resize: 'none' }}
                      maxLength={1000}
                    />
                    <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{newComment.length}/1000</p>
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" disabled={submittingComment || !newComment.trim()} className="btn-primary" style={{ opacity: submittingComment || !newComment.trim() ? 0.6 : 1 }}>
                        {submittingComment ? 'Posting...' : 'Post comment'}
                      </button>
                    </div>
                    {commentError && <p style={{ color: 'var(--danger)', marginTop: '10px', fontSize: '0.85rem' }}>{commentError}</p>}
                  </form>
                  {topLevelComments.length === 0 ? (
                    <div className="empty-state">No comments yet. Start the conversation.</div>
                  ) : topLevelComments.map((comment) => (
                    <div key={comment.id} className="card" style={{ padding: '18px 22px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(190,242,100,0.08)', border: '1px solid rgba(190,242,100,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                          {comment.profiles?.display_name?.charAt(0).toUpperCase() ?? 'U'}
                        </div>
                        <div style={{ flex: 1 }}>
                          {comment.profiles?.username ? (
                            <Link href={`/users/${comment.profiles.username}`} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>{comment.profiles.display_name}</Link>
                          ) : (
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Anonymous</div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} title={new Date(comment.created_at).toLocaleString()}>{timeAgo(comment.created_at)}</div>
                        </div>
                        {comment.created_by === userId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={deletingCommentId === comment.id}
                            className="btn-ghost"
                            style={{ fontSize: '0.72rem', padding: '4px 10px', flexShrink: 0, color: 'var(--danger)', opacity: deletingCommentId === comment.id ? 0.5 : 1 }}
                          >
                            {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>{comment.content}</p>

                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => (replyingToId === comment.id ? cancelReply() : startReply(comment.id))}
                          className="btn-ghost"
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        >
                          {replyingToId === comment.id ? 'Cancel' : 'Reply'}
                        </button>
                      </div>

                      {replyingToId === comment.id && (
                        <form onSubmit={(e) => submitReply(e, comment.id)} style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder={`Reply to ${comment.profiles?.display_name ?? 'this comment'}...`}
                            rows={3}
                            className="input-field"
                            style={{ width: '100%', resize: 'none' }}
                            maxLength={1000}
                            autoFocus
                          />
                          <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>{replyContent.length}/1000</p>
                            <button type="submit" disabled={submittingReply || !replyContent.trim()} className="btn-primary" style={{ fontSize: '0.78rem', padding: '6px 14px', opacity: submittingReply || !replyContent.trim() ? 0.6 : 1 }}>
                              {submittingReply ? 'Posting...' : 'Post reply'}
                            </button>
                          </div>
                        </form>
                      )}

                      {(repliesByParent.get(comment.id) ?? []).length > 0 && (
                        <div style={{ marginTop: '14px', paddingLeft: '20px', borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                            <div key={reply.id}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(190,242,100,0.08)', border: '1px solid rgba(190,242,100,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                                  {reply.profiles?.display_name?.charAt(0).toUpperCase() ?? 'U'}
                                </div>
                                <div style={{ flex: 1 }}>
                                  {reply.profiles?.username ? (
                                    <Link href={`/users/${reply.profiles.username}`} style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>{reply.profiles.display_name}</Link>
                                  ) : (
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Anonymous</span>
                                  )}
                                  <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '8px' }} title={new Date(reply.created_at).toLocaleString()}>{timeAgo(reply.created_at)}</span>
                                </div>
                                {reply.created_by === userId && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(reply.id)}
                                    disabled={deletingCommentId === reply.id}
                                    className="btn-ghost"
                                    style={{ fontSize: '0.68rem', padding: '3px 8px', flexShrink: 0, color: 'var(--danger)', opacity: deletingCommentId === reply.id ? 0.5 : 1 }}
                                  >
                                    {deletingCommentId === reply.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                )}
                              </div>
                              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.88rem' }}>{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT SIDEBAR ─── */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Status + Risk */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div className="eyebrow" style={{ marginBottom: '10px' }}>Status &amp; Risk</div>
              <span className={`status-pill status-${claim.status}`} style={{ fontSize: '0.8rem', display: 'inline-flex' }}>
                <span className="status-dot" />
                {claim.status}
              </span>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '10px' }}>
                {statusRiskText(claim.status)}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '6px', lineHeight: 1.6 }}>
                Combines status, evidence count, and community signal.
              </p>
            </div>

            {/* Community vote */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div className="eyebrow" style={{ marginBottom: '10px' }}>Community vote</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => handleVote('upvote')} className={`vote-btn up${userVote === 'upvote' ? ' active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
                  ▲ {voteCounts.upvotes}
                </button>
                <button type="button" onClick={() => handleVote('downvote')} className={`vote-btn down${userVote === 'downvote' ? ' active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
                  ▼ {voteCounts.downvotes}
                </button>
              </div>
              {voteError && <p style={{ color: 'var(--danger)', marginTop: '10px', fontSize: '0.78rem' }}>{voteError}</p>}
            </div>

            {/* Watchlist */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div className="eyebrow" style={{ marginBottom: '10px' }}>Watchlist</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 600, color: watching ? 'var(--accent)' : 'var(--text-primary)', marginBottom: '6px' }}>
                <svg width="14" height="14" fill={watching ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.5a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 21.04a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                {watching ? 'On your watchlist' : 'Not watching'}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '12px' }}>
                Keep this claim visible on your dashboard and receive an alert badge when it changes. View all watched claims on your <Link href="/watchlist" style={{ color: 'var(--accent)' }}>Watchlist page</Link>.
              </p>
              {watchError && <p style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '0.78rem' }}>{watchError}</p>}
              <button type="button" onClick={toggleWatch} className={watching ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
                {watching ? 'Remove from watchlist' : 'Add to watchlist'}
              </button>
            </div>

            {/* Recent comments preview — gives the sidebar real, useful content
                instead of stretching it artificially to match the main column */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div className="eyebrow">Recent comments</div>
                {comments.length > 0 && (
                  <button type="button" onClick={() => goToTab('comments')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}>
                    View all →
                  </button>
                )}
              </div>
              {topLevelComments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.6 }}>
                  No comments yet —{' '}
                  <button type="button" onClick={() => goToTab('comments')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}>
                    start the conversation
                  </button>.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {topLevelComments.slice(-2).reverse().map((comment) => (
                    <button
                      key={comment.id}
                      type="button"
                      onClick={() => goToTab('comments')}
                      style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}
                    >
                      <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(190,242,100,0.08)', border: '1px solid rgba(190,242,100,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>
                        {comment.profiles?.display_name?.charAt(0).toUpperCase() ?? 'U'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {comment.profiles?.display_name ?? 'Anonymous'}
                          <span className="mono" style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.68rem' }}>{timeAgo(comment.created_at)}</span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5, marginTop: '2px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                          {comment.content}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick details */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div className="eyebrow" style={{ marginBottom: '10px' }}>Quick details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Created by</span>
                  {claim.profiles?.username ? (
                    <Link href={`/users/${claim.profiles.username}`} style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>@{claim.profiles.username}</Link>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>@unknown</span>
                  )}
                </div>
                {[
                  { label: 'Created', value: timeAgo(claim.created_at) },
                  { label: 'Evidence', value: `${evidence.length} source${evidence.length !== 1 ? 's' : ''}` },
                  { label: 'Visibility', value: claim.visibility },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Add evidence CTA */}
            <Link href={`/claims/${id}/evidence/new`} className="btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Add Evidence
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
