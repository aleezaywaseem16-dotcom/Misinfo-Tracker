"use client";
import { useEffect, useState } from "react";

export default function Toast({ message, duration = 3500 }: { message: string; duration?: number }) {
  // Remount this component when `message` changes (use key on parent) so internal lifecycle handles visibility
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (!message || !visible) return null;

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 9999 }}>
      <div className="card animate-fade-up" style={{ padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)', borderLeft: '3px solid var(--accent)', minWidth: '220px' }}>{message}</div>
    </div>
  );
}
