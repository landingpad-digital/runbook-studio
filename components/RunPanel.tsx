"use client";

import { useState } from "react";
import type { AppState, Blocker, Runbook, Step } from "@/lib/types";
import * as store from "@/lib/store";
import { findStep } from "@/lib/runbook";

/**
 * Run mode. A run walks the steps in order, honouring branches. At each step
 * the person confirms the check or records a blocker. Blockers are held
 * against their step and turned into amendments afterwards.
 */
export function RunPanel({ state }: { state: AppState }) {
  const runbook = store.activeRunbook(state);
  const run = state.run && state.run.runbookId === runbook.id ? state.run : null;
  const active = run && run.status === "active" ? run : null;
  const current = active?.currentStepId ? findStep(runbook, active.currentStepId) : undefined;
  const openBlockers = store.openBlockers(state);
  const doneCount = active ? active.events.filter((e) => e.kind === "confirmed" || e.kind === "branched").length : 0;

  return (
    <section className="panel run-panel" aria-labelledby="run-heading">
      <div className="panel-head">
        <h2 id="run-heading">Run</h2>
        {active && <span className="status-pill on">Step {current?.order ?? "?"} of {runbook.steps.length}, {doneCount} done</span>}
      </div>

      {!active && (
        <>
          <p className="muted small-text">
            Walk the runbook step by step. Confirm each check, or record a blocker when reality does not match the step.
          </p>
          {run && run.status !== "active" && <RunSummary run={run} runbook={runbook} />}
          <button className="primary" onClick={() => store.startRun("person")} disabled={runbook.steps.length === 0}>
            {run ? "Start a new run" : "Start run"}
          </button>
        </>
      )}

      {active && current && (
        <CurrentStep step={current} runbook={runbook} blockers={openBlockers.filter((b) => b.stepId === current.id && b.runId === active.id)} />
      )}

      {openBlockers.length > 0 && <BlockerList blockers={openBlockers} runbook={runbook} />}
    </section>
  );
}

function CurrentStep({ step, runbook, blockers }: { step: Step; runbook: Runbook; blockers: Blocker[] }) {
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const target = step.branch ? findStep(runbook, step.branch.targetStepId) : undefined;

  function submitBlocker() {
    if (!note.trim()) return;
    store.reportBlocker(step.id, note, "person");
    setNote("");
    setReporting(false);
  }

  return (
    <div className="current-step" data-testid="run-current">
      <p className="eyebrow">Current step {step.order}</p>
      <h3>{step.title}</h3>
      <p>{step.instruction}</p>
      {step.check && (
        <p className="check-line">
          <span className="tag check">Check</span>
          {step.check}
        </p>
      )}
      {step.branch && target && (
        <p className="check-line">
          <span className="tag branch">Branch</span>
          If {step.branch.condition}, go to step {target.order}
        </p>
      )}
      {blockers.length > 0 && (
        <p className="check-line">
          <span className="tag blocker">Blocked</span>
          {blockers[blockers.length - 1].note}
        </p>
      )}

      {!reporting ? (
        <div className="run-actions">
          <button className="primary" onClick={() => store.advanceRun({}, "person")}>
            {step.check ? "Check passed, next step" : "Done, next step"}
          </button>
          {step.branch && target && (
            <button onClick={() => store.advanceRun({ branchTaken: true }, "person")}>
              Take branch to step {target.order}
            </button>
          )}
          <button onClick={() => setReporting(true)}>Report a blocker</button>
          <button className="link" onClick={() => store.abandonRun("person")}>Abandon run</button>
        </div>
      ) : (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitBlocker();
          }}
        >
          <label htmlFor="blocker-note">What did you find instead?</label>
          <textarea id="blocker-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="e.g. There is no Pipeline tab. The stage is set from a Status dropdown in the header." />
          <div className="buttons">
            <button type="submit" className="primary" disabled={!note.trim()}>Record blocker</button>
            <button type="button" onClick={() => setReporting(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function RunSummary({ run, runbook }: { run: NonNullable<AppState["run"]>; runbook: Runbook }) {
  const confirmed = run.events.filter((e) => e.kind === "confirmed" || e.kind === "branched").length;
  const blocked = run.events.filter((e) => e.kind === "blocked").length;
  return (
    <div className="run-summary" data-testid="run-summary">
      <p>
        <strong>Last run {run.status}.</strong> {confirmed} of {runbook.steps.length} steps confirmed, {blocked} blocker{blocked === 1 ? "" : "s"} recorded.
      </p>
      <details>
        <summary>Run log</summary>
        <ol className="run-log">
          {run.events.map((e, i) => {
            const s = e.stepId ? findStep(runbook, e.stepId) : undefined;
            return (
              <li key={i}>
                <span className="muted">{new Date(e.at).toLocaleTimeString("en-GB")}</span> {e.kind}
                {s ? ` step ${s.order}` : ""}
                {e.note ? `: ${e.note}` : ""}
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}

function BlockerList({ blockers, runbook }: { blockers: Blocker[]; runbook: Runbook }) {
  return (
    <div className="blockers" data-testid="blockers">
      <h3>Blockers to resolve ({blockers.length})</h3>
      <p className="muted small-text">Each blocker is pinned to its step. Amending the step from what the run found keeps the runbook honest.</p>
      <ul className="blocker-list">
        {blockers.map((b) => (
          <BlockerItem key={b.id} blocker={b} step={findStep(runbook, b.stepId)!} />
        ))}
      </ul>
    </div>
  );
}

function BlockerItem({ blocker, step }: { blocker: Blocker; step: Step }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(step.title);
  const [instruction, setInstruction] = useState(step.instruction);
  const [check, setCheck] = useState(step.check ?? "");
  const [resolution, setResolution] = useState("");

  function apply() {
    store.applyBlockerFix(
      blocker.id,
      { title, instruction, check: check.trim() ? check : null, resolution: resolution || `Amended from a blocker: ${blocker.note.slice(0, 80)}` },
      "person",
    );
    setOpen(false);
  }

  return (
    <li className="blocker-item">
      <p>
        <strong>Step {step.order}: {step.title}</strong>
      </p>
      <p className="blocker-note">{blocker.note}</p>
      {!open ? (
        <div className="buttons">
          <button className="small primary" onClick={() => { setTitle(step.title); setInstruction(step.instruction); setCheck(step.check ?? ""); setOpen(true); }}>
            Amend step {step.order}
          </button>
          <button className="small" onClick={() => store.dismissBlocker(blocker.id)}>Dismiss</button>
        </div>
      ) : (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <div className="field">
            <label htmlFor={`fix-title-${blocker.id}`}>Title</label>
            <input id={`fix-title-${blocker.id}`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`fix-instruction-${blocker.id}`}>Instruction, as it should read now</label>
            <textarea id={`fix-instruction-${blocker.id}`} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`fix-check-${blocker.id}`}>Check (leave empty for none)</label>
            <input id={`fix-check-${blocker.id}`} type="text" value={check} onChange={(e) => setCheck(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`fix-resolution-${blocker.id}`}>What changed and why (optional)</label>
            <input id={`fix-resolution-${blocker.id}`} type="text" value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </div>
          <div className="buttons">
            <button type="submit" className="primary small" disabled={!title.trim() || !instruction.trim()}>Apply amendment</button>
            <button type="button" className="small" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}
