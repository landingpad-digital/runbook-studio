import { RunbookEditor } from "@/components/RunbookEditor";
import { WebMcpProvider } from "@/components/WebMcpProvider";
import { WebMcpStatusPill } from "@/components/WebMcpStatusPill";
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  return (
    <main className="app">
      <a className="skip-link" href="#run-heading">Skip to run controls</a>
      <a className="skip-link" href="#harness-heading">Skip to agent harness</a>
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
        <Sidebar />
      </div>
    </main>
  );
}
