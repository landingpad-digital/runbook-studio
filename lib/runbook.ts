import type { Branch, Runbook, Step } from "./types";
import { newId } from "./id";

/** Rewrite the order field so it always matches array position. */
export function renumber(steps: Step[]): Step[] {
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

export function findStep(rb: Runbook, stepId: string): Step | undefined {
  return rb.steps.find((s) => s.id === stepId);
}

/** Resolve a step by id, or by its 1-based order number given as a string or number. */
export function resolveStep(rb: Runbook, ref: string | number): Step | undefined {
  if (typeof ref === "number") return rb.steps[ref - 1];
  const byId = findStep(rb, ref);
  if (byId) return byId;
  const n = Number(ref);
  if (Number.isInteger(n) && n >= 1) return rb.steps[n - 1];
  return undefined;
}

export function addStep(
  rb: Runbook,
  input: { title: string; instruction: string; check?: string; position?: number },
): { runbook: Runbook; step: Step } {
  const step: Step = {
    id: newId("step"),
    order: 0,
    title: input.title.trim(),
    instruction: input.instruction.trim(),
  };
  if (input.check && input.check.trim()) step.check = input.check.trim();
  const steps = [...rb.steps];
  const pos = clampPosition(input.position, steps.length + 1);
  steps.splice(pos - 1, 0, step);
  const renumbered = renumber(steps);
  return { runbook: { ...rb, steps: renumbered }, step: renumbered[pos - 1] };
}

export function updateStep(
  rb: Runbook,
  stepId: string,
  patch: { title?: string; instruction?: string },
): Runbook {
  return {
    ...rb,
    steps: rb.steps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            title: patch.title !== undefined ? patch.title.trim() : s.title,
            instruction: patch.instruction !== undefined ? patch.instruction.trim() : s.instruction,
          }
        : s,
    ),
  };
}

export function moveStep(rb: Runbook, stepId: string, newPosition: number): Runbook {
  const from = rb.steps.findIndex((s) => s.id === stepId);
  if (from < 0) return rb;
  const steps = [...rb.steps];
  const [step] = steps.splice(from, 1);
  const pos = clampPosition(newPosition, steps.length + 1);
  steps.splice(pos - 1, 0, step);
  return { ...rb, steps: renumber(steps) };
}

export function deleteStep(rb: Runbook, stepId: string): Runbook {
  const steps = rb.steps
    .filter((s) => s.id !== stepId)
    .map((s) => (s.branch?.targetStepId === stepId ? { ...s, branch: undefined } : s));
  return { ...rb, steps: renumber(steps) };
}

export function setCheck(rb: Runbook, stepId: string, check: string | null): Runbook {
  return {
    ...rb,
    steps: rb.steps.map((s) => {
      if (s.id !== stepId) return s;
      const next = { ...s };
      if (check && check.trim()) next.check = check.trim();
      else delete next.check;
      return next;
    }),
  };
}

export function setBranch(rb: Runbook, stepId: string, branch: Branch | null): Runbook {
  return {
    ...rb,
    steps: rb.steps.map((s) => {
      if (s.id !== stepId) return s;
      const next = { ...s };
      if (branch) next.branch = { condition: branch.condition.trim(), targetStepId: branch.targetStepId };
      else delete next.branch;
      return next;
    }),
  };
}

function clampPosition(pos: number | undefined, max: number): number {
  if (pos === undefined || !Number.isFinite(pos)) return max;
  return Math.min(Math.max(1, Math.round(pos)), max);
}
