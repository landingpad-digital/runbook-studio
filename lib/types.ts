/** Core data model for Runbook Studio. Domain-neutral by design. */

export interface Branch {
  /** Plain-language condition under which the branch is taken. */
  condition: string;
  /** Step to jump to when the condition holds. */
  targetStepId: string;
}

export interface Step {
  id: string;
  /** 1-based position in the runbook. Kept in sync with array order. */
  order: number;
  title: string;
  instruction: string;
  /** Plain-text verification condition. Absent when there is nothing to verify. */
  check?: string;
  branch?: Branch;
}

export interface Runbook {
  id: string;
  title: string;
  description: string;
  steps: Step[];
}

export type RunStatus = "active" | "completed" | "abandoned";

export interface RunEvent {
  at: string;
  stepId: string | null;
  kind: "started" | "confirmed" | "branched" | "blocked" | "completed" | "abandoned";
  note?: string;
}

export interface Run {
  id: string;
  runbookId: string;
  status: RunStatus;
  currentStepId: string | null;
  startedAt: string;
  finishedAt?: string;
  events: RunEvent[];
}

export interface Blocker {
  id: string;
  runId: string;
  stepId: string;
  /** What reality looked like when it did not match the step. */
  note: string;
  createdAt: string;
  /** Set when the blocker has been turned into an amendment. */
  resolvedAt?: string;
  resolution?: string;
}

export interface Highlight {
  stepId: string;
  /** Who made the change, so the UI can label it. */
  source: "person" | "agent";
  at: number;
  /** Short sentence describing the change, for the badge and the live region. */
  message: string;
}

export interface Announcement {
  text: string;
  /** Increments so that identical text is still re-announced. */
  n: number;
}

export interface AppState {
  runbooks: Runbook[];
  activeRunbookId: string;
  run: Run | null;
  blockers: Blocker[];
  highlight: Highlight | null;
  announcement: Announcement | null;
}
