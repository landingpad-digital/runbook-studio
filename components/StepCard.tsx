"use client";

import { useState } from "react";
import type { Blocker, Highlight, Runbook, Step } from "@/lib/types";
import * as store from "@/lib/store";

interface Props {
  step: Step;
  runbook: Runbook;
  highlight: Highlight | null;
  locked: boolean;
  runState?: "current" | "done" | "pending";
  blockers: Blocker[];
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
  if (runState === "current") classes.push("current");
  if (runState === "done") classes.push("done");
  if (blockers.length) classes.push("blocked");

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

  return (
    <li className={classes.join(" ")} data-step-id={step.id} data-testid={`step-${step.order}`}>
      {isFlash && (
        <span className={`change-badge ${highlight!.source}`}>
          {highlight!.source === "agent" ? "Changed by agent" : "Changed"}
        </span>
      )}
      <div className="step-num">{step.order}</div>

      <div className="step-body">
        {mode === "edit" ? (
          <div className="step-edit">
            <div className="field">
              <label>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Instruction</label>
              <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} />
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
            <p>{step.instruction}</p>
          </>
        )}

        <div className="step-meta">
          {mode === "check" ? (
            <div className="inline-form">
              <label>Check: what must be true before moving on</label>
              <div className="row">
                <input type="text" value={check} onChange={(e) => setCheck(e.target.value)} placeholder="e.g. The record saves without errors" />
                <button className="primary small" onClick={() => { store.setCheck(step.id, check); setMode("view"); }}>Save</button>
                <button className="small" onClick={() => setMode("view")}>Cancel</button>
              </div>
            </div>
          ) : (
            step.check && (
              <div>
                <span className="tag check">Check</span>
                {step.check}
              </div>
            )
          )}

          {mode === "branch" ? (
            <div className="inline-form">
              <label>Branch: if a condition holds, jump to another step</label>
              <div className="row">
                <input type="text" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="If this is true" />
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
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
                <button className="small" onClick={() => setMode("view")}>Cancel</button>
              </div>
            </div>
          ) : (
            step.branch && (
              <div>
                <span className="tag branch">Branch</span>
                If {step.branch.condition}, go to{" "}
                {targetStep ? <strong>step {targetStep.order}: {targetStep.title}</strong> : <em>a missing step</em>}
              </div>
            )
          )}

          {blockers.map((b) => (
            <div key={b.id}>
              <span className="tag blocker">Blocker</span>
              {b.note}
            </div>
          ))}
        </div>
      </div>

      {!locked && mode === "view" && (
        <div className="step-actions">
          <div className="row">
            <button className="small" title="Move up" disabled={step.order === 1} onClick={() => store.moveStep(step.id, step.order - 1)}>Up</button>
            <button className="small" title="Move down" disabled={step.order === runbook.steps.length} onClick={() => store.moveStep(step.id, step.order + 1)}>Down</button>
          </div>
          <button className="small" onClick={() => open("edit")}>Edit</button>
          <button className="small" onClick={() => open("check")}>{step.check ? "Edit check" : "Add check"}</button>
          {step.check && <button className="small" onClick={() => store.setCheck(step.id, null)}>Remove check</button>}
          <button className="small" disabled={others.length === 0} onClick={() => open("branch")}>{step.branch ? "Edit branch" : "Add branch"}</button>
          {step.branch && <button className="small" onClick={() => store.setBranch(step.id, null)}>Remove branch</button>}
          <button className="small danger" onClick={() => store.deleteStep(step.id)}>Delete</button>
        </div>
      )}
    </li>
  );
}
