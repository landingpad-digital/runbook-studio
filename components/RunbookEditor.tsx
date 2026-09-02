"use client";

import { useEffect } from "react";
import * as store from "@/lib/store";
import { RunbookHeader } from "./RunbookHeader";
import { StepCard } from "./StepCard";
import { AddStepForm } from "./AddStepForm";

export function RunbookEditor() {
  const state = store.useAppState();
  useEffect(() => {
    store.hydrate();
  }, []);

  const runbook = store.activeRunbook(state);
  const run = state.run && state.run.runbookId === runbook.id && state.run.status === "active" ? state.run : null;
  const locked = run !== null;

  const doneIds = new Set(
    run ? run.events.filter((e) => (e.kind === "confirmed" || e.kind === "branched") && e.stepId).map((e) => e.stepId as string) : [],
  );

  return (
    <section className={`runbook${store.isRunbookPulsing() ? " pulse" : ""}`}>
      <RunbookHeader runbook={runbook} all={state.runbooks} locked={locked} />
      {runbook.steps.length === 0 ? (
        <div className="empty">This runbook has no steps yet. Add one below, or ask the agent to.</div>
      ) : (
        <ol className="steps">
          {runbook.steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              runbook={runbook}
              highlight={state.highlight}
              locked={locked}
              runState={run ? (run.currentStepId === step.id ? "current" : doneIds.has(step.id) ? "done" : "pending") : undefined}
              blockers={state.blockers.filter((b) => b.stepId === step.id && !b.resolvedAt)}
            />
          ))}
        </ol>
      )}
      {!locked && <AddStepForm stepCount={runbook.steps.length} />}
    </section>
  );
}
