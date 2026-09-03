"use client";

import { useEffect, useState } from "react";
import { addLogEntry, prettyResult } from "@/lib/harness-log";
import { useWebMcpStatus } from "@/lib/webmcp-status";

/**
 * Model mode. A sentence goes to the server route with the page's tool list;
 * the model picks a tool; the browser executes it through
 * document.modelContext.executeTool() and sends the result back for the next
 * turn. Hidden entirely when the server has no model configured.
 */

interface Turn {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

type Phase = "idle" | "thinking" | "running";

export function ModelInput() {
  const status = useWebMcpStatus();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>("");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d: { configured?: boolean; model?: string | null }) => {
        if (cancelled) return;
        setConfigured(Boolean(d.configured));
        setModel(d.model ?? "");
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!configured || status.provider === "none") return null;

  async function run() {
    const message = text.trim();
    const mc = document.modelContext;
    if (!message || !mc || typeof mc.executeTool !== "function") return;
    setPhase("thinking");
    setNote("");
    const transcript: Turn[] = [];
    try {
      const registered = await mc.getTools();
      const tools = registered.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
      for (let turn = 0; turn < 7; turn++) {
        setPhase("thinking");
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, tools, transcript }),
        });
        const data = (await res.json()) as { error?: string; done?: boolean; reply?: string; toolCall?: { name: string; args: Record<string, unknown> } };
        if (!res.ok || data.error) {
          setNote(data.error || "The model request failed.");
          break;
        }
        if (data.done || !data.toolCall) {
          setNote(data.reply || "Done.");
          break;
        }
        const tool = registered.find((t) => t.name === data.toolCall!.name);
        if (!tool) {
          setNote(`Unknown tool ${data.toolCall.name}.`);
          break;
        }
        setPhase("running");
        const started = performance.now();
        let raw = "";
        let ok = true;
        try {
          raw = (await mc.executeTool(tool, JSON.stringify(data.toolCall.args ?? {}))) ?? "";
          try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.ok === false) ok = false;
          } catch {
            // Not JSON. Leave as text.
          }
        } catch (e) {
          ok = false;
          raw = (e as Error).message;
        }
        addLogEntry({ tool: tool.name, args: data.toolCall.args ?? {}, result: prettyResult(raw), ok, ms: Math.round(performance.now() - started), source: "model" });
        transcript.push({ name: tool.name, args: data.toolCall.args ?? {}, result: raw });
      }
    } finally {
      setPhase("idle");
      setText("");
    }
  }

  return (
    <form
      className="model-input"
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <label htmlFor="model-message">Ask the agent</label>
      <div className="row">
        <input
          id="model-message"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Step 7 is too vague. Split it into two steps."
          maxLength={500}
          disabled={phase !== "idle"}
        />
        <button type="submit" className="primary" disabled={phase !== "idle" || !text.trim()}>
          {phase === "idle" ? "Send" : phase === "thinking" ? "Thinking" : "Running"}
        </button>
      </div>
      <p className="hint">
        {note ? note : `A model (${model}) reads the tools below, chooses what to call, and this page executes it.`}
      </p>
    </form>
  );
}
