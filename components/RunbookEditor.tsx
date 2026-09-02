"use client";

import { useEffect } from "react";
import * as store from "@/lib/store";
import { RunbookHeader } from "./RunbookHeader";
import { StepCard, type RunState } from "./StepCard";
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
  const currentOrder = run?.currentStepId ? runbook.steps.find((s) => s.id === run.currentStepId)?.order ?? 0 : 0;

  function runStateFor(stepId: string, order: number): RunState | undefined {
    if (!run) return undefined;
    if (run.currentStepId === stepId) return "current";
    if (doneIds.has(stepId)) return "done";
    if (order < currentOrder) return "skipped";
    return "pending";
  }

  return (
    <section className={`runbook${store.isRunbookPulsing() ? " pulse" : ""}`} aria-labelledby="runbook-title">
      <RunbookHeader runbook={runbook} all={state.runbooks} locked={locked} />

      {/* Announces every change, including those made by an agent, without needing to watch the screen. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
        {state.announcement ? state.announcement.text : ""}
      </div>

      {state.highlight && (
        <p className={`change-strip ${state.highlight.source}`} data-testid="change-strip" aria-hidden="true">
          {state.highlight.message}
        </p>
      )}

      {runbook.steps.length === 0 ? (
        <div className="empty">This runbook has no steps yet. Add one below, or ask the agent to.</div>
      ) : (
        <ol className="steps" aria-label="Steps">
          {runbook.steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              runbook={runbook}
              highlight={state.highlight}
              locked={locked}
              runState={runStateFor(step.id, step.order)}
              blockers={state.blockers.filter((b) => b.stepId === step.id && !b.resolvedAt)}
            />
          ))}
        </ol>
      )}
      {!locked && <AddStepForm stepCount={runbook.steps.length} />}
    </section>
  );
}
