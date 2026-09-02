"use client";

/**
 * WebMCP tool definitions for Runbook Studio.
 *
 * Descriptions are written for a model, not a developer. They follow the
 * Chrome guidance on budgets: tool names up to 30 characters, tool
 * descriptions up to 500, parameter descriptions up to 150, and each output
 * kept under 1,500 characters. Read-only tools carry readOnlyHint. Tools that
 * hand user-written text back to the model carry untrustedContentHint.
 */

import * as store from "./store";
import { resolveStep } from "./runbook";
import type { Runbook, Step } from "./types";

export const OUTPUT_BUDGET = 1500;

type Args = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (args: Args, signal?: AbortSignal) => unknown;
}

/* ---------- helpers ---------- */

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function fail(message: string) {
  return { ok: false, error: message };
}

function stepRef(rb: Runbook, v: unknown): Step | undefined {
  if (typeof v === "number") return resolveStep(rb, v);
  if (typeof v === "string" && v.trim()) return resolveStep(rb, v.trim());
  return undefined;
}

function stepSummary(s: Step) {
  return {
    id: s.id,
    order: s.order,
    title: s.title,
    hasCheck: Boolean(s.check),
    branchesTo: s.branch ? s.branch.targetStepId : null,
  };
}

function stepFull(s: Step) {
  return {
    id: s.id,
    order: s.order,
    title: s.title,
    instruction: s.instruction,
    check: s.check ?? null,
    branch: s.branch ?? null,
  };
}

/** Keep any output under the Chrome budget by truncating long text fields. */
function clip(text: string, max = 240) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

const NO_STEP =
  "No step matches that reference. Call list_steps and use a step id or its position number.";

/* ---------- tool definitions ---------- */

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "list_steps",
    description:
      "Read the runbook the person currently has open: its title, description and every step in order. " +
      "Returns step ids, positions, titles and whether each has a check or a branch. " +
      "Pass detail=\"full\" to also get each instruction, check and branch. Call this first before editing or running.",
    inputSchema: {
      type: "object",
      properties: {
        detail: {
          type: "string",
          enum: ["summary", "full"],
          description: "\"summary\" (default) keeps the answer short. \"full\" includes every instruction, check and branch.",
        },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (args) => {
      const rb = store.activeRunbook();
      const full = str(args.detail) === "full";
      const steps = full ? rb.steps.map(stepFull) : rb.steps.map(stepSummary);
      return {
        ok: true,
        runbook: { id: rb.id, title: rb.title, description: clip(rb.description), stepCount: rb.steps.length },
        run: runSummary(),
        steps,
      };
    },
  },
  {
    name: "get_step",
    description:
      "Read one step of the open runbook in full: title, instruction, check and branch. " +
      "Use it when you need the exact wording of a step before rewriting it or judging whether reality matched it.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: { type: "string", description: "The step id from list_steps, or its position number such as \"3\"." },
      },
      required: ["stepId"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (args) => {
      const rb = store.activeRunbook();
      const s = stepRef(rb, args.stepId);
      if (!s) return fail(NO_STEP);
      return { ok: true, step: stepFull(s) };
    },
  },
  {
    name: "add_step",
    description:
      "Insert a new step into the open runbook. Give a short imperative title and a clear instruction a person can follow. " +
      "Optionally add a check (what must be true before moving on) and a position; without a position the step goes at the end. " +
      "Existing steps renumber and the page highlights the new step.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short imperative title, for example \"Verify the backup checksum\"." },
        instruction: { type: "string", description: "What the person should do at this step, in one to three sentences." },
        check: { type: "string", description: "Optional. A plain-language condition that must be true before the next step." },
        position: { type: "integer", minimum: 1, description: "Optional 1-based position. Existing steps at and after it shift down." },
      },
      required: ["title", "instruction"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (args) => {
      const title = str(args.title)?.trim();
      const instruction = str(args.instruction)?.trim();
      if (!title || !instruction) return fail("Both title and instruction are required.");
      const step = store.addStep({ title, instruction, check: str(args.check), position: num(args.position) }, "agent");
      return { ok: true, message: `Added step ${step.order}.`, step: stepFull(step) };
    },
  },
  {
    name: "update_step",
    description:
      "Rewrite the title or instruction of an existing step, or both. Use this to correct wording, add detail, " +
      "or bring a step back in line with how the work is really done. Checks and branches are left untouched; " +
      "use set_check or set_branch for those.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: { type: "string", description: "The step id from list_steps, or its position number." },
        title: { type: "string", description: "New title. Omit to keep the current one." },
        instruction: { type: "string", description: "New instruction. Omit to keep the current one." },
      },
      required: ["stepId"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (args) => {
      const rb = store.activeRunbook();
      const s = stepRef(rb, args.stepId);
      if (!s) return fail(NO_STEP);
      const title = str(args.title);
      const instruction = str(args.instruction);
      if (title === undefined && instruction === undefined) return fail("Provide a new title, a new instruction, or both.");
      store.updateStep(s.id, { title, instruction }, "agent");
      return { ok: true, message: `Updated step ${s.order}.`, step: stepFull(resolveStep(store.activeRunbook(), s.id)!) };
    },
  },
  {
    name: "reorder_steps",
    description:
      "Move one step to a new position in the open runbook. Every step renumbers afterwards, so read list_steps again " +
      "before referring to positions. Branch targets follow the step they point at.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: { type: "string", description: "The step id from list_steps, or its current position number." },
        newPosition: { type: "integer", minimum: 1, description: "The 1-based position the step should occupy after the move." },
      },
      required: ["stepId", "newPosition"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (args) => {
      const rb = store.activeRunbook();
      const s = stepRef(rb, args.stepId);
      if (!s) return fail(NO_STEP);
      const pos = num(args.newPosition);
      if (pos === undefined || pos < 1) return fail("newPosition must be a whole number of 1 or more.");
      store.moveStep(s.id, pos, "agent");
      const after = store.activeRunbook();
      return { ok: true, message: `Moved "${s.title}" to position ${resolveStep(after, s.id)!.order}.`, steps: after.steps.map(stepSummary) };
    },
  },
  {
    name: "delete_step",
    description:
      "Remove a step from the open runbook permanently. Any branch that pointed at it is cleared. " +
      "Prefer update_step when the step is merely wrong; delete only when it no longer belongs in the procedure.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: { type: "string", description: "The step id from list_steps, or its position number." },
      },
      required: ["stepId"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (args) => {
      const rb = store.activeRunbook();
      const s = stepRef(rb, args.stepId);
      if (!s) return fail(NO_STEP);
      const run = store.getState().run;
      if (run && run.status === "active" && run.currentStepId === s.id) {
        return fail("That step is the current step of an active run. Advance or abandon the run first.");
      }
      store.deleteStep(s.id, "agent");
      return { ok: true, message: `Deleted step ${s.order}, "${s.title}".`, remaining: store.activeRunbook().steps.length };
    },
  },
  {
    name: "set_check",
    description:
      "Attach a verification check to a step, replace its existing check, or clear it. A check is a plain-language " +
      "condition that must be true before moving to the next step, such as \"The invoice total matches the order\". " +
      "Pass an empty string to clear.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: { type: "string", description: "The step id from list_steps, or its position number." },
        check: { type: "string", description: "The condition to verify, or an empty string to remove the check." },
      },
      required: ["stepId", "check"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (args) => {
      const rb = store.activeRunbook();
      const s = stepRef(rb, args.stepId);
      if (!s) return fail(NO_STEP);
      const check = str(args.check);
      if (check === undefined) return fail("check must be a string. Use an empty string to clear.");
      store.setCheck(s.id, check.trim() ? check : null, "agent");
      return { ok: true, message: check.trim() ? `Check set on step ${s.order}.` : `Check cleared on step ${s.order}.` };
    },
  },
  {
    name: "set_branch",
    description:
      "Attach a conditional branch to a step, replace it, or clear it. A branch says: if this condition holds when the " +
      "step is reached, jump to the target step instead of continuing. Use it for exceptions such as an existing record " +
      "or a missing ingredient. Pass an empty condition to clear.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: { type: "string", description: "The step that carries the branch: its id or position number." },
        condition: { type: "string", description: "Plain-language condition under which to jump, or an empty string to clear." },
        targetStepId: { type: "string", description: "The step to jump to: its id or position number. Required unless clearing." },
      },
      required: ["stepId", "condition"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (args) => {
      const rb = store.activeRunbook();
      const s = stepRef(rb, args.stepId);
      if (!s) return fail(NO_STEP);
      const condition = str(args.condition) ?? "";
      if (!condition.trim()) {
        store.setBranch(s.id, null, "agent");
        return { ok: true, message: `Branch cleared on step ${s.order}.` };
      }
      const target = stepRef(rb, args.targetStepId);
      if (!target) return fail("targetStepId must name another step in this runbook.");
      if (target.id === s.id) return fail("A step cannot branch to itself.");
      store.setBranch(s.id, { condition, targetStepId: target.id }, "agent");
      return { ok: true, message: `Step ${s.order} now branches to step ${target.order} when: ${clip(condition, 120)}` };
    },
  },
  {
    name: "start_run",
    description:
      "Begin running the open runbook from step 1 and return that step in full. While a run is active the page shows " +
      "which step is current. Use advance_run to move on and report_blocker when reality does not match a step. " +
      "Starting a new run replaces any run already in progress.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: () => {
      const rb = store.activeRunbook();
      if (rb.steps.length === 0) return fail("This runbook has no steps to run. Add steps first.");
      const run = store.startRun("agent");
      const first = resolveStep(rb, run.currentStepId!)!;
      return { ok: true, runId: run.id, message: "Run started.", currentStep: stepFull(first) };
    },
  },
  {
    name: "advance_run",
    description:
      "Mark the current step of the active run as done and move to the next one, returning it in full. If the current " +
      "step has a branch and its condition held, pass branchTaken=true to jump to the branch target instead. " +
      "Confirm the step's check before advancing. When no steps remain the run completes.",
    inputSchema: {
      type: "object",
      properties: {
        branchTaken: { type: "boolean", description: "True if the current step's branch condition held and the jump should be taken." },
        note: { type: "string", description: "Optional short note on how the step went, recorded in the run log." },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: (args) => {
      try {
        const { run, next, previous } = store.advanceRun(
          { branchTaken: Boolean(args.branchTaken), note: str(args.note) },
          "agent",
        );
        if (!next) {
          return { ok: true, runId: run.id, status: run.status, message: `Step ${previous!.order} done. The run is complete.`, currentStep: null };
        }
        return { ok: true, runId: run.id, status: run.status, message: `Step ${previous!.order} done.`, currentStep: stepFull(next) };
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  },
  {
    name: "report_blocker",
    description:
      "Record that reality did not match a step during a run: a missing screen, a renamed option, a check that cannot " +
      "pass. Say plainly what was found instead. The blocker is pinned to that step on the page so it can be turned " +
      "into a fix later with apply_blocker_fix. The run stays on the same step.",
    inputSchema: {
      type: "object",
      properties: {
        stepId: { type: "string", description: "The step that did not match: its id or position number. Defaults to the current run step." },
        note: { type: "string", description: "What was actually found and why the step could not be followed as written." },
      },
      required: ["note"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (args) => {
      const rb = store.activeRunbook();
      const note = str(args.note)?.trim();
      if (!note) return fail("A note describing what was found is required.");
      const run = store.getState().run;
      const s = args.stepId !== undefined && args.stepId !== ""
        ? stepRef(rb, args.stepId)
        : run?.currentStepId ? resolveStep(rb, run.currentStepId) : undefined;
      if (!s) return fail("No step to pin the blocker to. Give a stepId or start a run first.");
      const b = store.reportBlocker(s.id, note, "agent");
      return { ok: true, blockerId: b.id, message: `Blocker recorded against step ${s.order}, "${s.title}".` };
    },
  },
  {
    name: "list_blockers",
    description:
      "Read the blockers recorded against steps of the open runbook that have not yet been fixed. Each includes the " +
      "step it refers to and the note about what was found. Use the blockerId with apply_blocker_fix.",
    inputSchema: {
      type: "object",
      properties: {
        includeResolved: { type: "boolean", description: "True to also list blockers that have already been turned into fixes." },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (args) => {
      const s = store.getState();
      const rb = store.activeRunbook(s);
      const all = s.blockers.filter((b) => rb.steps.some((st) => st.id === b.stepId));
      const list = (args.includeResolved ? all : all.filter((b) => !b.resolvedAt)).map((b) => {
        const st = resolveStep(rb, b.stepId)!;
        return {
          blockerId: b.id,
          stepId: st.id,
          stepOrder: st.order,
          stepTitle: st.title,
          note: clip(b.note),
          resolved: Boolean(b.resolvedAt),
          resolution: b.resolution ? clip(b.resolution, 120) : undefined,
        };
      });
      return { ok: true, count: list.length, blockers: list };
    },
  },
  {
    name: "apply_blocker_fix",
    description:
      "Turn a blocker into an amendment: rewrite the step the blocker refers to so it matches what was actually found, " +
      "optionally update its check, and mark the blocker resolved. Give a short resolution note saying what changed. " +
      "This closes the loop between running a procedure and keeping it accurate.",
    inputSchema: {
      type: "object",
      properties: {
        blockerId: { type: "string", description: "The blocker id from list_blockers or report_blocker." },
        title: { type: "string", description: "New step title. Omit to keep it." },
        instruction: { type: "string", description: "New step instruction that reflects reality. Omit to keep it." },
        check: { type: "string", description: "New check for the step, or an empty string to clear it. Omit to keep it." },
        resolution: { type: "string", description: "One sentence on what was changed and why." },
      },
      required: ["blockerId"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (args) => {
      const blockerId = str(args.blockerId)?.trim();
      if (!blockerId) return fail("blockerId is required. Call list_blockers to find it.");
      const title = str(args.title);
      const instruction = str(args.instruction);
      const check = str(args.check);
      if (title === undefined && instruction === undefined && check === undefined) {
        return fail("Provide at least one of title, instruction or check so the step actually changes.");
      }
      try {
        const { step } = store.applyBlockerFix(
          blockerId,
          { title, instruction, check: check === undefined ? undefined : check.trim() ? check : null, resolution: str(args.resolution) },
          "agent",
        );
        return { ok: true, message: `Step ${step.order} amended and blocker resolved.`, step: stepFull(step) };
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  },
];

function runSummary() {
  const run = store.getState().run;
  const rb = store.activeRunbook();
  if (!run || run.runbookId !== rb.id) return null;
  return { runId: run.id, status: run.status, currentStepId: run.currentStepId };
}

/**
 * Serialise a tool result. Chrome stringifies whatever execute returns, so we
 * return objects and let the platform serialise them, but enforce the output
 * budget here so the model never receives an oversized payload.
 */
export function withBudget(result: unknown): unknown {
  const text = JSON.stringify(result);
  if (text.length <= OUTPUT_BUDGET) return result;
  const obj = result as { steps?: unknown[]; blockers?: unknown[] };
  if (Array.isArray(obj.steps) || Array.isArray(obj.blockers)) {
    const key = Array.isArray(obj.steps) ? "steps" : "blockers";
    const list = (obj as Record<string, unknown[]>)[key];
    let n = list.length;
    while (n > 1) {
      n -= 1;
      const trimmed = { ...obj, [key]: list.slice(0, n), truncated: true, hint: `Only the first ${n} of ${list.length} returned. Ask for a specific step with get_step.` };
      if (JSON.stringify(trimmed).length <= OUTPUT_BUDGET) return trimmed;
    }
  }
  return { ok: true, truncated: true, text: text.slice(0, OUTPUT_BUDGET - 60) + "…" };
}

/** Register every tool on a model context. Aborting the signal unregisters them all. */
export async function registerRunbookTools(mc: WebMCP.ModelContext, signal: AbortSignal): Promise<string[]> {
  const names: string[] = [];
  for (const def of toolDefinitions) {
    await mc.registerTool(
      {
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
        // Chrome 152 calls execute with a single argument, so options may be undefined.
        execute: async (input, options) => {
          const execSignal = (options as { signal?: AbortSignal } | undefined)?.signal;
          if (execSignal?.aborted) return fail("Cancelled before the tool ran.");
          return withBudget(await def.execute((input ?? {}) as Args, execSignal));
        },
      },
      { signal },
    );
    names.push(def.name);
  }
  return names;
}
