"use client";
import { useEffect, useId, useRef, useState } from "react";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  /** Defaults to today — dates after this are disabled. */
  maxDate?: Date;
  /** Earliest selectable year in the quick-jump dropdown. Defaults to 1900. */
  minYear?: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateString(s: string): Date | null {
  if (!s || !DATE_FORMAT_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // reject things like 2024-02-31 that overflow into the next month
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function DatePicker({ value, onChange, placeholder, maxDate, minYear = 1900 }: DatePickerProps) {
  const popupId = useId();
  const [open, setOpen] = useState(false);
  const [inputError, setInputError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const today = startOfToday();
  const max = maxDate ?? today;
  const selected = parseDateString(value);
  const [viewDate, setViewDate] = useState(() => selected ?? today);
  const [rawText, setRawText] = useState(value);

  // Keep the typed text and visible month in sync with the committed value
  // whenever it changes externally (calendar pick, parent reset, popup
  // opening) — adjusted during render instead of an effect, same pattern
  // used by Navbar's prevPathname.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setRawText(value);
    setInputError("");
  }
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

  function commitTyped(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setInputError("");
      onChange("");
      return;
    }
    const parsed = parseDateString(trimmed);
    if (!parsed) {
      setInputError("Use the YYYY-MM-DD format.");
      return;
    }
    if (parsed.getTime() > max.getTime()) {
      setInputError("That date is in the future.");
      return;
    }
    setInputError("");
    onChange(trimmed);
    setViewDate(parsed);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); setRawText(value); setInputError(""); }
    if (e.key === "Enter") { e.preventDefault(); commitTyped(rawText); }
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const nextMonthStart = new Date(year, month + 1, 1);
  const canGoNext = nextMonthStart <= max;
  const yearOptions: number[] = [];
  for (let y = max.getFullYear(); y >= minYear; y--) yearOptions.push(y);

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          role="combobox"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => commitTyped(rawText)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder ?? "YYYY-MM-DD"}
          className="input-field"
          style={{ width: "100%", paddingRight: 34 }}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popupId}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          tabIndex={-1}
          aria-label="Open calendar"
          style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
            display: "flex", alignItems: "center", padding: 4,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M3 10h18M8 2v4M16 2v4" />
          </svg>
        </button>
      </div>
      {inputError && <p style={{ fontSize: "0.7rem", color: "var(--danger)", marginTop: 4 }}>{inputError}</p>}

      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-label="Choose a date"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
            background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)", padding: "14px", boxShadow: "var(--shadow-lg)",
            width: "280px", maxWidth: "calc(100vw - 32px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", gap: 6 }}>
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="btn-ghost" style={{ padding: "4px 8px" }} aria-label="Previous month">
              ‹
            </button>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{MONTH_NAMES[month]}</span>
            <select
              value={year}
              onChange={(e) => setViewDate(new Date(Number(e.target.value), month, 1))}
              className="input-field"
              style={{ fontSize: "0.78rem", padding: "3px 6px", width: "auto" }}
              aria-label="Jump to year"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
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
