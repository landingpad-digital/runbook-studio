"use client";

import { useWebMcpStatus } from "@/lib/webmcp-status";

export function WebMcpStatusPill() {
  const s = useWebMcpStatus();
  if (s.error) return <span className="status-pill" title={s.error}>WebMCP unavailable</span>;
  if (s.provider === "none") return <span className="status-pill">WebMCP starting</span>;
  return (
    <span className="status-pill on" title={`${s.toolNames.length} tools registered on document.modelContext`}>
      WebMCP {s.provider === "native" ? "native" : "polyfill"}: {s.toolNames.length} tools
    </span>
  );
}
