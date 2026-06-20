"use client";
import { useEffect, useRef, useState } from "react";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  /** Defaults to today — dates after this are disabled. */
  maxDate?: Date;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateString(s: string): Date | null {
  if (!s) return null;
  const parts = s.split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DatePicker({ value, onChange, placeholder, maxDate }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const today = startOfToday();
  const max = maxDate ?? today;
  const selected = parseDateString(value);
  const [viewDate, setViewDate] = useState(() => selected ?? today);

  // Reset the visible month to the selected date whenever the popup opens —
  // adjusted during render instead of an effect (see Navbar's prevPathname
  // pattern for the same approach).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setViewDate(selected ?? today);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    if ((e.key === "Enter" || e.key === " ") && !open) {
      e.preventDefault();
      setOpen(true);
    }
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const nextMonthStart = new Date(year, month + 1, 1);
  const canGoNext = nextMonthStart <= max;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div ref={containerRef} style={{ position: "relative" }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        className="input-field"
        style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span style={{ color: selected ? "var(--text-primary)" : "var(--text-disabled)" }}>
          {selected ? selected.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : (placeholder ?? "Select a date")}
        </span>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, color: "var(--text-muted)" }}>
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M3 10h18M8 2v4M16 2v4" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
            background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)", padding: "14px", boxShadow: "var(--shadow-lg)",
            width: "280px", maxWidth: "calc(100vw - 32px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="btn-ghost" style={{ padding: "4px 8px" }} aria-label="Previous month">
              ‹
            </button>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>{MONTH_NAMES[month]} {year}</span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              disabled={!canGoNext}
              className="btn-ghost"
              style={{ padding: "4px 8px", opacity: canGoNext ? 1 : 0.3, cursor: canGoNext ? "pointer" : "not-allowed" }}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} style={{ textAlign: "center", fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{w}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`blank-${i}`} />;
              const isFuture = day > max;
              const isSelected = !!selected && isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={isFuture}
                  onClick={() => { onChange(toDateString(day)); setOpen(false); }}
                  style={{
                    aspectRatio: "1", borderRadius: "6px",
                    border: isToday && !isSelected ? "1px solid var(--accent-border)" : "1px solid transparent",
                    background: isSelected ? "var(--accent)" : "transparent",
                    color: isFuture ? "var(--text-disabled)" : isSelected ? "#070a00" : "var(--text-secondary)",
                    fontSize: "0.78rem", fontWeight: isSelected ? 700 : 500,
                    cursor: isFuture ? "not-allowed" : "pointer",
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={() => { onChange(toDateString(today)); setOpen(false); }} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.75rem", cursor: "pointer", padding: 0 }}>
              Today
            </button>
            {value && (
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer", padding: 0 }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
