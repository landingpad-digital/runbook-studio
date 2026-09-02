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
      <footer className="credit">
        <p>
          Runbook Studio. Built by{" "}
          <a href="https://landingpad.digital/?utm_source=runbook-studio&utm_medium=referral&utm_campaign=webmcp-challenge" target="_blank" rel="noopener noreferrer">
            Landing Pad Digital
          </a>
          . Open source,{" "}
          <a href="https://github.com/landingpad-digital/runbook-studio/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
            MIT licensed
          </a>
          .{" "}
          <a href="https://github.com/landingpad-digital/runbook-studio" target="_blank" rel="noopener noreferrer">
            View the source
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
