"use client";

/**
 * A small external store so that React components and WebMCP tools share one
 * source of truth. Tools run outside the React tree, so a plain module-level
 * store with subscribe/getSnapshot is simpler than context.
 */

import { useSyncExternalStore } from "react";
import type { AppState, Blocker, Branch, Highlight, Run, RunEvent, Runbook, Step } from "./types";
import * as ops from "./runbook";
import { seedRunbooks } from "./seeds";
import { newId } from "./id";

const STORAGE_KEY = "runbook-studio:v1";
const HIGHLIGHT_MS = 1800;

type Listener = () => void;
type Source = Highlight["source"];

function initialState(): AppState {
  return {
    runbooks: seedRunbooks.map(cloneRunbook),
    activeRunbookId: seedRunbooks[0].id,
    run: null,
    blockers: [],
    highlight: null,
  };
}

function cloneRunbook(rb: Runbook): Runbook {
  return JSON.parse(JSON.stringify(rb)) as Runbook;
}

let state: AppState = initialState();
let hydrated = false;
const listeners = new Set<Listener>();
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const { highlight: _h, ...rest } = state;
    void _h;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    // Storage may be unavailable (private mode, quota). The app still works in memory.
  }
}

function setState(next: AppState, opts?: { persist?: boolean }) {
  state = next;
  if (opts?.persist !== false) persist();
  emit();
}

/** Load saved state once, on the client. Safe to call repeatedly. */
export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<AppState>;
    if (!Array.isArray(saved.runbooks) || saved.runbooks.length === 0) return;
    const active = saved.runbooks.some((r) => r.id === saved.activeRunbookId)
      ? (saved.activeRunbookId as string)
      : saved.runbooks[0].id;
    setState(
      {
        runbooks: saved.runbooks,
        activeRunbookId: active,
        run: saved.run ?? null,
        blockers: saved.blockers ?? [],
        highlight: null,
      },
      { persist: false },
    );
  } catch {
    // Corrupt storage: keep the seeds.
  }
}

export function getState(): AppState {
  return state;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function activeRunbook(s: AppState = state): Runbook {
  return s.runbooks.find((r) => r.id === s.activeRunbookId) ?? s.runbooks[0];
}

function replaceActive(rb: Runbook) {
  setState({
    ...state,
    runbooks: state.runbooks.map((r) => (r.id === rb.id ? rb : r)),
  });
}

function flash(stepId: string, source: Source) {
  if (highlightTimer) clearTimeout(highlightTimer);
  state = { ...state, highlight: { stepId, source, at: Date.now() } };
  emit();
  highlightTimer = setTimeout(() => {
    state = { ...state, highlight: null };
    emit();
  }, HIGHLIGHT_MS);
}

/* ---------- Runbook editing ---------- */

export function selectRunbook(id: string) {
  if (!state.runbooks.some((r) => r.id === id)) return;
  setState({ ...state, activeRunbookId: id, run: null });
}

export function setRunbookMeta(patch: { title?: string; description?: string }) {
  const rb = activeRunbook();
  replaceActive({
    ...rb,
    title: patch.title !== undefined ? patch.title : rb.title,
    description: patch.description !== undefined ? patch.description : rb.description,
  });
}

export function addStep(
  input: { title: string; instruction: string; check?: string; position?: number },
  source: Source = "person",
): Step {
  const { runbook, step } = ops.addStep(activeRunbook(), input);
  replaceActive(runbook);
  flash(step.id, source);
  return step;
}

export function updateStep(stepId: string, patch: { title?: string; instruction?: string }, source: Source = "person") {
  replaceActive(ops.updateStep(activeRunbook(), stepId, patch));
  flash(stepId, source);
}

export function moveStep(stepId: string, newPosition: number, source: Source = "person") {
  replaceActive(ops.moveStep(activeRunbook(), stepId, newPosition));
  flash(stepId, source);
}

export function deleteStep(stepId: string, source: Source = "person") {
  replaceActive(ops.deleteStep(activeRunbook(), stepId));
  if (source === "agent") flashRunbook();
}

export function setCheck(stepId: string, check: string | null, source: Source = "person") {
  replaceActive(ops.setCheck(activeRunbook(), stepId, check));
  flash(stepId, source);
}

export function setBranch(stepId: string, branch: Branch | null, source: Source = "person") {
  replaceActive(ops.setBranch(activeRunbook(), stepId, branch));
  flash(stepId, source);
}

/** Reset the active runbook back to its seeded content, if it is a seed. */
export function resetActiveToSeed() {
  const seed = seedRunbooks.find((r) => r.id === state.activeRunbookId);
  if (!seed) return;
  setState({
    ...state,
    runbooks: state.runbooks.map((r) => (r.id === seed.id ? cloneRunbook(seed) : r)),
    run: null,
    blockers: state.blockers.filter((b) => {
      const run = b.runId;
      return run !== state.run?.id && !seed.steps.some((s) => s.id === b.stepId);
    }),
  });
}

/** A whole-runbook pulse for changes that have no single step to point at. */
let runbookPulseTimer: ReturnType<typeof setTimeout> | null = null;
let runbookPulse = false;
export function isRunbookPulsing() {
  return runbookPulse;
}
function flashRunbook() {
  runbookPulse = true;
  emit();
  if (runbookPulseTimer) clearTimeout(runbookPulseTimer);
  runbookPulseTimer = setTimeout(() => {
    runbookPulse = false;
    emit();
  }, HIGHLIGHT_MS);
}

/* ---------- Runs and blockers ---------- */

function now() {
  return new Date().toISOString();
}

function pushEvent(run: Run, ev: Omit<RunEvent, "at">): Run {
  return { ...run, events: [...run.events, { at: now(), ...ev }] };
}

export function startRun(source: Source = "person"): Run {
  const rb = activeRunbook();
  const first = rb.steps[0] ?? null;
  let run: Run = {
    id: newId("run"),
    runbookId: rb.id,
    status: first ? "active" : "completed",
    currentStepId: first ? first.id : null,
    startedAt: now(),
    events: [],
  };
  run = pushEvent(run, { kind: "started", stepId: first ? first.id : null });
  if (!first) run = { ...run, finishedAt: now() };
  setState({ ...state, run });
  if (first) flash(first.id, source);
  return run;
}

/**
 * Mark the current step done and move on. If the step has a branch and the
 * caller says the branch condition held, jump to the target. Otherwise take
 * the next step in order.
 */
export function advanceRun(
  opts: { branchTaken?: boolean; note?: string } = {},
  source: Source = "person",
): { run: Run; next: Step | null; previous: Step | null } {
  const run = state.run;
  const rb = activeRunbook();
  if (!run || run.status !== "active" || run.runbookId !== rb.id) {
    throw new Error("No active run. Start a run first.");
  }
  const current = run.currentStepId ? ops.findStep(rb, run.currentStepId) : undefined;
  if (!current) throw new Error("The current step no longer exists in the runbook.");

  let next: Step | undefined;
  let updated = run;
  if (opts.branchTaken && current.branch) {
    next = ops.findStep(rb, current.branch.targetStepId);
    updated = pushEvent(updated, {
      kind: "branched",
      stepId: current.id,
      note: `Condition held: ${current.branch.condition}`,
    });
  } else {
    updated = pushEvent(updated, { kind: "confirmed", stepId: current.id, note: opts.note });
    next = rb.steps[current.order]; // order is 1-based, so this is the following step
  }

  if (next) {
    updated = { ...updated, currentStepId: next.id };
    setState({ ...state, run: updated });
    flash(next.id, source);
  } else {
    updated = pushEvent({ ...updated, currentStepId: null, status: "completed", finishedAt: now() }, {
      kind: "completed",
      stepId: null,
    });
    setState({ ...state, run: updated });
    flashRunbook();
  }
  return { run: updated, next: next ?? null, previous: current };
}

export function abandonRun(source: Source = "person") {
  const run = state.run;
  if (!run || run.status !== "active") return;
  const updated = pushEvent(
    { ...run, status: "abandoned", currentStepId: null, finishedAt: now() },
    { kind: "abandoned", stepId: run.currentStepId },
  );
  setState({ ...state, run: updated });
  void source;
  flashRunbook();
}

export function reportBlocker(stepId: string, note: string, source: Source = "person"): Blocker {
  const rb = activeRunbook();
  const step = ops.findStep(rb, stepId);
  if (!step) throw new Error("That step does not exist in the current runbook.");
  const run = state.run;
  const blocker: Blocker = {
    id: newId("blk"),
    runId: run?.id ?? "no_run",
    stepId,
    note: note.trim(),
    createdAt: now(),
  };
  let nextRun = run;
  if (run && run.status === "active") {
    nextRun = pushEvent(run, { kind: "blocked", stepId, note: blocker.note });
  }
  setState({ ...state, run: nextRun, blockers: [...state.blockers, blocker] });
  flash(stepId, source);
  return blocker;
}

export function openBlockers(s: AppState = state): Blocker[] {
  const rb = activeRunbook(s);
  return s.blockers.filter((b) => !b.resolvedAt && rb.steps.some((st) => st.id === b.stepId));
}

export function applyBlockerFix(
  blockerId: string,
  fix: { title?: string; instruction?: string; check?: string | null; resolution?: string },
  source: Source = "person",
): { blocker: Blocker; step: Step } {
  const blocker = state.blockers.find((b) => b.id === blockerId);
  if (!blocker) throw new Error("No blocker with that id.");
  if (blocker.resolvedAt) throw new Error("That blocker has already been resolved.");
  let rb = activeRunbook();
  if (!ops.findStep(rb, blocker.stepId)) throw new Error("The step this blocker refers to no longer exists.");
  if (fix.title !== undefined || fix.instruction !== undefined) {
    rb = ops.updateStep(rb, blocker.stepId, { title: fix.title, instruction: fix.instruction });
  }
  if (fix.check !== undefined) rb = ops.setCheck(rb, blocker.stepId, fix.check);
  const resolved: Blocker = { ...blocker, resolvedAt: now(), resolution: fix.resolution?.trim() || undefined };
  setState({
    ...state,
    runbooks: state.runbooks.map((r) => (r.id === rb.id ? rb : r)),
    blockers: state.blockers.map((b) => (b.id === blockerId ? resolved : b)),
  });
  flash(blocker.stepId, source);
  return { blocker: resolved, step: ops.findStep(rb, blocker.stepId)! };
}

export function dismissBlocker(blockerId: string) {
  setState({ ...state, blockers: state.blockers.filter((b) => b.id !== blockerId) });
}
