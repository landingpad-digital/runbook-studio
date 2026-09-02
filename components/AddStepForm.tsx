"use client";

import { useState } from "react";
import * as store from "@/lib/store";

export function AddStepForm({ stepCount }: { stepCount: number }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [check, setCheck] = useState("");
  const [position, setPosition] = useState<string>("");

  function submit() {
    if (!title.trim() || !instruction.trim()) return;
    const pos = position ? Number(position) : undefined;
    store.addStep({ title, instruction, check: check || undefined, position: pos });
    setTitle("");
    setInstruction("");
    setCheck("");
    setPosition("");
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="add-step">
        <button className="primary" onClick={() => setOpen(true)}>Add a step</button>
      </div>
    );
  }

  return (
    <div className="panel add-step">
      <h2>New step</h2>
      <div className="field">
        <label htmlFor="new-title">Title</label>
        <input id="new-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label htmlFor="new-instruction">Instruction</label>
        <textarea id="new-instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="new-check">Check (optional)</label>
        <input id="new-check" type="text" value={check} onChange={(e) => setCheck(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="new-position">Position (optional, 1 to {stepCount + 1}; defaults to the end)</label>
        <input id="new-position" type="text" inputMode="numeric" value={position} onChange={(e) => setPosition(e.target.value)} />
      </div>
      <div className="buttons" style={{ display: "flex", gap: 8 }}>
        <button className="primary" disabled={!title.trim() || !instruction.trim()} onClick={submit}>Add step</button>
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
