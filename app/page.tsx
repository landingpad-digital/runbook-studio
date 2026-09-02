import { RunbookEditor } from "@/components/RunbookEditor";
import { WebMcpProvider } from "@/components/WebMcpProvider";
import { WebMcpStatusPill } from "@/components/WebMcpStatusPill";
import { HarnessPanel } from "@/components/HarnessPanel";

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
        <aside className="sidebar">
          <HarnessPanel />
        </aside>
      </div>
    </main>
  );
}
