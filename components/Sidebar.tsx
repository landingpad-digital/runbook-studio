"use client";

import * as store from "@/lib/store";
import { RunPanel } from "./RunPanel";
import { HarnessPanel } from "./HarnessPanel";

export function Sidebar() {
  const state = store.useAppState();
  return (
    <aside className="sidebar">
      <RunPanel state={state} />
      <HarnessPanel />
    </aside>
  );
}
