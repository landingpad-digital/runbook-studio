import { RunbookEditor } from "@/components/RunbookEditor";
import { WebMcpProvider } from "@/components/WebMcpProvider";
import { WebMcpStatusPill } from "@/components/WebMcpStatusPill";

export default function Home() {
  return (
    <main className="app">
      <WebMcpProvider />
      <header className="topbar">
        <div className="brand">
          <h1>Runbook Studio</h1>
          <span>Procedures a person and an agent author, run and improve together</span>
        </div>
        <div className="topbar-actions">
          <WebMcpStatusPill />
        </div>
      </header>
      <div className="layout">
        <RunbookEditor />
        <aside>
          <div className="panel">
            <h2>Agent</h2>
            <p className="muted small-text">The agent harness and run controls arrive in the next tasks.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
