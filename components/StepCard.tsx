"use client";

import { useState } from "react";
import type { Blocker, Highlight, Runbook, Step } from "@/lib/types";
import * as store from "@/lib/store";

export type RunState = "current" | "done" | "skipped" | "pending";

interface Props {
  step: Step;
  runbook: Runbook;
  highlight: Highlight | null;
  locked: boolean;
  runState?: RunState;
  blockers: Blocker[];
}

function TickIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" style={{ transform: direction === "down" ? "rotate(180deg)" : undefined }}>
      <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StepCard({ step, runbook, highlight, locked, runState, blockers }: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "check" | "branch">("view");
  const [title, setTitle] = useState(step.title);
  const [instruction, setInstruction] = useState(step.instruction);
  const [check, setCheck] = useState(step.check ?? "");
  const [condition, setCondition] = useState(step.branch?.condition ?? "");
  const [target, setTarget] = useState(step.branch?.targetStepId ?? "");

  const isFlash = highlight?.stepId === step.id;
  const classes = ["step"];
  if (isFlash) classes.push(highlight!.source === "agent" ? "flash-agent" : "flash-person");
  if (runState) classes.push(runState);
  if (blockers.length) classes.push("blocked");
  if (mode !== "view") classes.push("editing");

  const targetStep = step.branch ? runbook.steps.find((s) => s.id === step.branch!.targetStepId) : undefined;
  const others = runbook.steps.filter((s) => s.id !== step.id);

  function open(next: typeof mode) {
    setTitle(step.title);
    setInstruction(step.instruction);
    setCheck(step.check ?? "");
    setCondition(step.branch?.condition ?? "");
    setTarget(step.branch?.targetStepId ?? others[0]?.id ?? "");
    setMode(next);
  }

  const stateLabel =
    runState === "current" ? "Current" : runState === "done" ? "Done" : runState === "skipped" ? "Skipped" : null;

  return (
    <li className={classes.join(" ")} data-step-id={step.id} data-testid={`step-${step.order}`} aria-current={runState === "current" ? "step" : undefined}>
      {isFlash && (
        <span className={`change-badge ${highlight!.source}`}>
          {highlight!.source === "agent" ? "Changed by agent" : "Changed"}
        </span>
      )}

      <div className="step-num" aria-hidden="true">
        <span className="num">{step.order}</span>
        {runState === "done" && <span className="state-mark done"><TickIcon /></span>}
      </div>

      <div className="step-body">
        {stateLabel && <span className="sr-only">{stateLabel} step. </span>}
        {mode === "edit" ? (
          <div className="step-edit">
            <div className="field">
              <label htmlFor={`edit-title-${step.id}`}>Title</label>
              <input id={`edit-title-${step.id}`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`edit-instruction-${step.id}`}>Instruction</label>
              <textarea id={`edit-instruction-${step.id}`} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            </div>
            <div className="buttons">
              <button
                className="primary"
                onClick={() => {
                  store.updateStep(step.id, { title, instruction });
                  setMode("view");
                }}
              >
                Save
              </button>
              <button onClick={() => setMode("view")}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h3>{step.title}</h3>
            <p className="instruction">{step.instruction}</p>
          </>
        )}

        {(step.check || step.branch || blockers.length > 0 || mode === "check" || mode === "branch") && (
          <div className="step-meta">
            {mode === "check" ? (
              <div className="inline-form">
                <label htmlFor={`check-${step.id}`}>Check: what must be true before moving on</label>
                <div className="row">
                  <input id={`check-${step.id}`} type="text" value={check} onChange={(e) => setCheck(e.target.value)} placeholder="e.g. The record saves without errors" />
                  <button className="primary small" onClick={() => { store.setCheck(step.id, check); setMode("view"); }}>Save</button>
                  {step.check && <button className="small" onClick={() => { store.setCheck(step.id, null); setMode("view"); }}>Remove check</button>}
                  <button className="small" onClick={() => setMode("view")}>Cancel</button>
                </div>
              </div>
            ) : (
              step.check && (
                <div className="meta-line">
                  <span className="tag check">Check</span>
                  <span>{step.check}</span>
                </div>
              )
            )}

            {mode === "branch" ? (
              <div className="inline-form">
                <label htmlFor={`branch-cond-${step.id}`}>Condition: if this is already true, send the run to another step</label>
                <div className="row">
                  <input id={`branch-cond-${step.id}`} type="text" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="If this is true" />
                  <select aria-label="Target step" value={target} onChange={(e) => setTarget(e.target.value)}>
                    {others.map((s) => (
                      <option key={s.id} value={s.id}>{s.order}. {s.title}</option>
                    ))}
                  </select>
                  <button
                    className="primary small"
                    disabled={!condition.trim() || !target}
                    onClick={() => { store.setBranch(step.id, { condition, targetStepId: target }); setMode("view"); }}
                  >
                    Save
                  </button>
                  {step.branch && <button className="small" onClick={() => { store.setBranch(step.id, null); setMode("view"); }}>Remove condition</button>}
                  <button className="small" onClick={() => setMode("view")}>Cancel</button>
                </div>
              </div>
            ) : (
              step.branch && (
                <div className="meta-line">
                  <span className="tag branch">Condition</span>
                  <span>
                    <span className="kw">If</span> {step.branch.condition}, <span className="kw">go to</span>{" "}
                    {targetStep ? <strong>step {targetStep.order}: {targetStep.title}</strong> : <em>a missing step</em>}
                  </span>
                </div>
              )
            )}

            {blockers.map((b) => (
              <div key={b.id} className="meta-line">
                <span className="tag blocker">Blocker</span>
                <span>{b.note}</span>
              </div>
            ))}
          </div>
        )}

        {!locked && mode === "view" && (
          <div className="step-actions" aria-label={`Actions for step ${step.order}`}>
            <button className="small icon-button" aria-label={`Move step ${step.order} up`} title="Move up" disabled={step.order === 1} onClick={() => store.moveStep(step.id, step.order - 1)}><ArrowIcon direction="up" /></button>
            <button className="small icon-button" aria-label={`Move step ${step.order} down`} title="Move down" disabled={step.order === runbook.steps.length} onClick={() => store.moveStep(step.id, step.order + 1)}><ArrowIcon direction="down" /></button>
            <button className="small" onClick={() => open("edit")}>Edit</button>
            <button className="small" onClick={() => open("check")}>{step.check ? "Edit check" : "Add check"}</button>
            <button className="small" disabled={others.length === 0} onClick={() => open("branch")}>{step.branch ? "Edit condition" : "Add condition"}</button>
            <button className="small danger push-right" onClick={() => store.deleteStep(step.id)}>Delete</button>
          </div>
        )}
      </div>
    </li>
  );
}
