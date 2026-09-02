"use client";

import { useEffect } from "react";
import { registerRunbookTools } from "@/lib/tools";
import { setWebMcpStatus } from "@/lib/webmcp-status";

/**
 * Registers the runbook tools on document.modelContext. Uses the browser's
 * native implementation when present, otherwise installs the polyfill so the
 * built-in harness works in any modern browser. Unmounting aborts the
 * registration signal, which unregisters every tool.
 */
export function WebMcpProvider() {
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      if (!window.isSecureContext) {
        setWebMcpStatus({
          provider: "none",
          toolNames: [],
          error: "WebMCP needs a secure context. Open this app over HTTPS or on localhost.",
        });
        return;
      }
      let provider: "native" | "polyfill" = "native";
      if (!document.modelContext) {
        const { initializeWebMCPPolyfill } = await import("@mcp-b/webmcp-polyfill");
        initializeWebMCPPolyfill();
        provider = "polyfill";
      }
      const mc = document.modelContext;
      if (!mc) {
        setWebMcpStatus({ provider: "none", toolNames: [], error: "document.modelContext is unavailable." });
        return;
      }
      if (cancelled) return;
      try {
        const names = await registerRunbookTools(mc, controller.signal);
        if (!cancelled) setWebMcpStatus({ provider, toolNames: names });
      } catch (e) {
        setWebMcpStatus({ provider, toolNames: [], error: (e as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return null;
}
