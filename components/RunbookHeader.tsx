"use client";

import { useState } from "react";
import type { Runbook } from "@/lib/types";
import * as store from "@/lib/store";

export function RunbookHeader({ runbook, all, locked }: { runbook: Runbook; all: Runbook[]; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(runbook.title);
  const [description, setDescription] = useState(runbook.description);

  function startEdit() {
    setTitle(runbook.title);
    setDescription(runbook.description);
    setEditing(true);
  }

  function save() {
    store.setRunbookMeta({ title: title.trim() || runbook.title, description: description.trim() });
    setEditing(false);
  }

  return (
    <div className="runbook-head">
      <div className="edit-row toolbar">
        <label htmlFor="runbook-select" style={{ margin: 0 }}>Runbook</label>
        <select
          id="runbook-select"
          value={runbook.id}
          onChange={(e) => store.selectRunbook(e.target.value)}
          disabled={locked}
          style={{ maxWidth: 420 }}
        >
          {all.map((r) => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
        {!editing && !locked && (
          <>
            <button className="small" onClick={startEdit}>Edit details</button>
            <button className="small" onClick={() => store.resetActiveToSeed()} title="Restore this example to its original content">Reset example</button>
          </>
        )}
      </div>
      {editing ? (
        <div className="step-edit">
          <div className="field">
            <label htmlFor="rb-title">Title</label>
            <input id="rb-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rb-desc">Description</label>
            <textarea id="rb-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="buttons">
            <button className="primary" onClick={save}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <h2 id="runbook-title">{runbook.title}</h2>
          <p>{runbook.description}</p>
          <p className="explainer">
            Each step can carry a check, which confirms the step worked, and a condition, which sends the run to a
            different step when something is already true.
          </p>
        </>
      )}
    </div>
  );
}
