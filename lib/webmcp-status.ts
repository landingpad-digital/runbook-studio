"use client";

import { useSyncExternalStore } from "react";

export type Provider = "native" | "polyfill" | "none";

export interface WebMcpStatus {
  provider: Provider;
  toolNames: string[];
  error?: string;
}

let status: WebMcpStatus = { provider: "none", toolNames: [] };
const listeners = new Set<() => void>();

export function setWebMcpStatus(next: WebMcpStatus) {
  status = next;
  for (const l of listeners) l();
}

export function getWebMcpStatus() {
  return status;
}

export function useWebMcpStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getWebMcpStatus,
    getWebMcpStatus,
  );
}
