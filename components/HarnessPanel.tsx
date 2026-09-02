"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWebMcpStatus } from "@/lib/webmcp-status";

/**
 * Built-in agent harness. Discovers tools with document.modelContext.getTools()
 * and runs them with executeTool(), the same way an in-browser agent would.
 * Manual mode needs no model, no key and no browser flag: with the polyfill
 * installed it works in any modern browser.
 */

interface SchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  minimum?: number;
}

interface InputSchema {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

interface LogEntry {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  result: string;
  ok: boolean;
  ms: number;
  at: string;
}

let logCounter = 0;

export function HarnessPanel() {
  const status = useWebMcpStatus();
  const [tools, setTools] = useState<WebMCP.RegisteredTool[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string>("");

  const discover = useCallback(async () => {
    const mc = document.modelContext;
    if (!mc) return;
    try {
      const list = await mc.getTools();
      setTools(list);
      setDiscoveryError("");
    } catch (e) {
      setDiscoveryError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (status.provider === "none") return;
    const initial = setTimeout(() => void discover(), 0);
    const mc = document.modelContext;
    if (!mc) return;
    const onChange = () => void discover();
    mc.addEventListener("toolchange", onChange);
    return () => {
      clearTimeout(initial);
      mc.removeEventListener("toolchange", onChange);
    };
  }, [status.provider, status.toolNames.length, discover]);

  const tool = useMemo(() => tools.find((t) => t.name === selected), [tools, selected]);
  const schema = parseSchema(tool?.inputSchema);
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  function choose(name: string) {
    setSelected(name);
    setValues({});
  }

  function buildArgs(): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    for (const [key, p] of Object.entries(props)) {
      const v = values[key];
      if (p.type === "boolean") {
        if (v === true) args[key] = true;
        continue;
      }
      if (typeof v !== "string" || v === "") continue;
      if (p.type === "integer" || p.type === "number") {
        const n = Number(v);
        if (Number.isFinite(n)) args[key] = n;
        continue;
      }
      args[key] = v;
    }
    return args;
  }

  async function execute() {
    if (!tool) return;
    const mc = document.modelContext;
    if (!mc || typeof mc.executeTool !== "function") {
      setDiscoveryError("This browser's model context has no executeTool(). The polyfill provides one.");
      return;
    }
    const args = buildArgs();
    const started = performance.now();
    setBusy(true);
    let result = "";
    let ok = true;
    try {
      const raw = await mc.executeTool(tool, JSON.stringify(args));
      result = pretty(raw);
      try {
        const parsed = JSON.parse(raw ?? "");
        if (parsed && parsed.ok === false) ok = false;
      } catch {
        // Not JSON. Leave as text.
      }
    } catch (e) {
      ok = false;
      result = (e as Error).message;
    } finally {
      setBusy(false);
    }
    setLog((l) => [
      { id: ++logCounter, tool: tool.name, args, result, ok, ms: Math.round(performance.now() - started), at: new Date().toLocaleTimeString("en-GB") },
      ...l,
    ].slice(0, 30));
  }

  const missingRequired = [...required].filter((k) => {
    const v = values[k];
    return v === undefined || v === "" || v === false;
  });

  return (
    <section className="panel harness" aria-labelledby="harness-heading">
      <div className="harness-head">
        <h2 id="harness-heading" tabIndex={-1}>Agent harness</h2>
        <p className="muted small-text">
          Discovers the page&apos;s tools with <code>getTools()</code> and runs them with <code>executeTool()</code>, exactly as an
          agent would. No model or browser flag needed.
        </p>
      </div>

      {discoveryError && <p className="error-text" role="alert">{discoveryError}</p>}

      <div className="field">
        <label htmlFor="harness-tool">Tool ({tools.length} registered)</label>
        <select id="harness-tool" value={selected} onChange={(e) => choose(e.target.value)}>
          <option value="">Choose a tool</option>
          {tools.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      {tool && (
        <form
          className="harness-form"
          onSubmit={(e) => {
            e.preventDefault();
            void execute();
          }}
        >
          <p className="tool-description">{tool.description}</p>
          <p className="small-text muted tool-annotations">
            {tool.annotations?.readOnlyHint ? "Read only." : "Changes the runbook."}{" "}
            {tool.annotations?.untrustedContentHint ? "Returns user-written content." : ""}
          </p>

          {Object.keys(props).length === 0 && <p className="small-text muted">This tool takes no arguments.</p>}

          {Object.entries(props).map(([key, p]) => {
            const id = `arg-${tool.name}-${key}`;
            const label = `${key}${required.has(key) ? " (required)" : ""}`;
            if (p.type === "boolean") {
              return (
                <div className="field checkbox-field" key={key}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={values[key] === true}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))}
                  />
                  <label htmlFor={id}>{label}<span className="muted"> {p.description}</span></label>
                </div>
              );
            }
            if (p.enum) {
              return (
                <div className="field" key={key}>
                  <label htmlFor={id}>{label}</label>
                  <select id={id} value={(values[key] as string) ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}>
                    <option value="">Default</option>
                    {p.enum.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {p.description && <p className="hint">{p.description}</p>}
                </div>
              );
            }
            const long = key === "instruction" || key === "note" || key === "resolution";
            return (
              <div className="field" key={key}>
                <label htmlFor={id}>{label}</label>
                {long ? (
                  <textarea id={id} value={(values[key] as string) ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
                ) : (
                  <input
                    id={id}
                    type="text"
                    inputMode={p.type === "integer" || p.type === "number" ? "numeric" : undefined}
                    value={(values[key] as string) ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  />
                )}
                {p.description && <p className="hint">{p.description}</p>}
              </div>
            );
          })}

          <div className="buttons">
            <button type="submit" className="primary" disabled={busy || missingRequired.length > 0}>
              {busy ? "Running" : `Run ${tool.name}`}
            </button>
            {missingRequired.length > 0 && <span className="small-text muted">Fill in: {missingRequired.join(", ")}</span>}
          </div>
        </form>
      )}

      <div className="harness-log" aria-live="polite" aria-label="Tool call log">
        {log.length === 0 ? (
          <p className="small-text muted">Tool calls and their results appear here.</p>
        ) : (
          <ol className="log-list">
            {log.map((entry) => (
              <li key={entry.id} className={`log-entry ${entry.ok ? "ok" : "failed"}`}>
                <div className="log-head">
                  <code>{entry.tool}</code>
                  <span className="muted small-text">{entry.at}, {entry.ms} ms</span>
                </div>
                <details>
                  <summary>Arguments</summary>
                  <pre>{JSON.stringify(entry.args, null, 2)}</pre>
                </details>
                <pre className="log-result">{entry.result}</pre>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/**
 * Chrome 152 hands back inputSchema as a JSON string from getTools(), while the
 * published types and the polyfill give an object. Accept both.
 */
function parseSchema(raw: unknown): InputSchema {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as InputSchema;
    } catch {
      return {};
    }
  }
  return raw as InputSchema;
}

function pretty(raw: string | null): string {
  if (raw === null || raw === undefined) return "(no result)";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return String(raw);
  }
}
