"use client";

import { useSyncExternalStore } from "react";

/** Shared call log for the agent harness, so manual and model modes write to one list. */
export interface LogEntry {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  result: string;
  ok: boolean;
  ms: number;
  at: string;
  /** Who chose the call. */
  source?: "manual" | "model";
}

let entries: LogEntry[] = [];
let counter = 0;
const listeners = new Set<() => void>();

export function addLogEntry(e: Omit<LogEntry, "id" | "at">) {
  entries = [{ ...e, id: ++counter, at: new Date().toLocaleTimeString("en-GB") }, ...entries].slice(0, 30);
  for (const l of listeners) l();
}

export function useHarnessLog(): LogEntry[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => entries,
    () => entries,
  );
}

/** Serialise a tool result for display, pretty-printing JSON when possible. */
export function prettyResult(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "(no result)";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return String(raw);
  }
}
