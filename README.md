# Runbook Studio

Runbook Studio is a single-page web app where a working procedure is held as structured data and can be authored, run and improved by a person and an AI agent together. It is Landing Pad Digital's entry to the WebMCP Challenge.

Live app: https://runbook.landingpad.digital

The app exposes thirteen tools on `document.modelContext`, the WebMCP API. An agent can read a runbook, rewrite it, run it step by step, record where reality no longer matches the written procedure, and turn what it found into an amendment. The person sees every change happen on the page as it happens.

## The problem

Procedures go stale. An onboarding checklist written when the CRM was first set up still says "open the Pipeline tab" two years after that tab was renamed. Nobody fixes it, because the person running the procedure is busy running it, and the person who owns the document is not there. The knowledge of what actually happened lives in someone's head and evaporates.

Runbook Studio closes that loop:

1. **Write** the procedure with the agent, as ordered steps with optional checks and branches.
2. **Run** it with the agent. At each step, confirm the check or record a blocker: what was found instead.
3. **Amend** it from what the run found. A blocker becomes a rewritten step, and the runbook is accurate again.

The step model is domain-neutral. The three bundled examples show a CRM onboarding procedure, a database restore and a cooking recipe, and the same tools work on all of them. The lead story is operational procedures, because that is where staleness costs the most.

## Why this suits WebMCP

A runbook is exactly the kind of thing an agent should help with and exactly the kind of thing it should not do alone. Scraping the page or driving the UI by pixel gives the agent no idea which step is current, what a check means or which step a branch points at. With WebMCP the page hands the agent typed tools with model-readable descriptions, and the page stays the source of truth: every change flows through the same store the person edits, and every change is highlighted so the person can see what the agent did.

The person and the agent also share the run. Either can advance a step, either can report a blocker, and either can apply the fix. Nothing about the loop assumes the agent is on its own.

## How WebMCP is implemented

- **Namespace.** Tools are registered with `document.modelContext.registerTool()` in `lib/tools.ts` from a client component, `components/WebMcpProvider.tsx`.
- **Lifecycle.** Registration passes an `AbortSignal`; unmounting aborts it and unregisters every tool. The execution-time `signal` is honoured when the browser supplies one, and treated as optional when it does not (Chrome 152 calls `execute` with a single argument).
- **Shared state.** React and the tools share one small external store (`lib/store.ts`) persisted to `localStorage`. Tool calls and human edits are the same operations, so an agent change is reflected on the page instantly, with a highlight and a badge on the affected step, a change strip above the list, and a polite live-region announcement.
- **Fallback.** If the browser has no native `document.modelContext`, the app installs `@mcp-b/webmcp-polyfill` so the built-in harness works in any modern browser. When the native API is present the polyfill is not installed.
- **Harness.** `components/HarnessPanel.tsx` discovers tools with `getTools()` and runs them with `executeTool()`, the same calls an in-browser agent makes. It builds a form from each tool's `inputSchema` and logs every call and result. An optional model mode (`components/ModelInput.tsx` and `app/api/agent/route.ts`) lets a model choose the tool instead; see "Test it" below.
- **Types.** `webmcp-types` from the WebMCP community group, plus a small local declaration for Chromium's `executeTool()`.

## Tools

All thirteen tools take a step by its id or by its position number, so an agent that has just read `list_steps` can refer to "step 5" directly.

| Tool | What it does | Annotations |
|---|---|---|
| `list_steps` | Read the open runbook: title, description and every step in order. `detail: "full"` includes instructions, checks and branches. | read only, untrusted content |
| `get_step` | Read one step in full. | read only, untrusted content |
| `add_step` | Insert a step with a title, instruction, optional check and optional position. | |
| `update_step` | Rewrite a step's title or instruction. | |
| `reorder_steps` | Move a step to a new position; everything renumbers. | |
| `delete_step` | Remove a step; branches that pointed at it are cleared. Refuses to delete the current step of an active run. | |
| `set_check` | Attach, replace or clear the verification check on a step. | |
| `set_branch` | Attach, replace or clear a conditional branch: if the condition holds, jump to the target step. | |
| `start_run` | Begin a run at step 1 and return that step. | untrusted content |
| `advance_run` | Mark the current step done and return the next one. `branchTaken: true` follows the step's branch. Completes the run after the last step. | untrusted content |
| `report_blocker` | Record that reality did not match a step, with a note. Pinned to the step; the run stays where it is. | |
| `list_blockers` | Read open blockers with the step they refer to. `includeResolved: true` shows fixed ones too. | read only, untrusted content |
| `apply_blocker_fix` | Rewrite the blocked step's title, instruction or check, and mark the blocker resolved with a short resolution note. | |

Every tool returns a JSON object with `ok: true` or `ok: false` and a message an agent can act on, such as "No active run. Start a run first."

## Security and the Chrome guidance

The implementation follows the Chrome WebMCP security guidance:

- **Budgets.** Tool names are under 30 characters, tool descriptions under 500, parameter descriptions under 150, and each tool output is kept under 1,500 characters. `list_steps` returns a compact summary by default and trims oversized outputs with a hint to use `get_step`.
- **Annotations.** `readOnlyHint` is set on the read tools so an agent can decide when to confirm with the user. `untrustedContentHint` is set wherever user-written text (step instructions, blocker notes) is returned to the model, because that text can contain anything, including attempts at prompt injection.
- **Origin.** `exposedTo` is left unset, so the tools are available only to the document that registered them. No cross-origin frame can call them.
- **Validation.** Every argument is checked in the tool before it touches state. Unknown steps, missing required fields and invalid positions return a clear error rather than a partial change.
- **No secrets in the core app.** The runbook, the tools and manual mode have no backend, no database and no API keys; everything runs in the browser and persists to `localStorage`. The optional model mode is the one server route, and it holds its key in an environment variable that is never committed.

## Run it locally

```bash
git clone https://github.com/landingpad-digital/runbook-studio.git
cd runbook-studio
npm install
npm run dev
```

Open http://localhost:3000. The WebMCP API is only available in a secure context, and `localhost` counts as one.

To run the production build in Docker:

```bash
docker compose build
docker compose up -d
```

The compose file expects an external `nextcloud-net` network with an nginx-proxy on it. Remove the `networks` section and add a `ports` mapping to run it standalone.

## Test it

### With the built-in harness (no flag, no model)

Open the app in any modern browser. The status pill in the header reads "WebMCP polyfill: 13 tools" or "WebMCP native: 13 tools". In the Agent harness panel choose a tool, fill in the arguments and press Run. The result appears in the log and the change appears on the runbook with a "Changed by agent" badge.

A good sequence to try on the default CRM example:

1. `start_run`, then `advance_run` twice (the second with `branchTaken` ticked at step 2), then `advance_run` again to reach step 5.
2. `report_blocker` with a note such as "There is no Pipeline tab. The stage is set from a Status dropdown in the header."
3. `list_blockers`, then `apply_blocker_fix` with the blocker id and a corrected instruction.

Step 5 is rewritten and the blocker is resolved.

### With model mode (optional, needs your own key)

The harness can also let a real model choose the tools. Type a sentence such as "Step 7 is too vague. Split it into two steps and add a check to each." and press Send. The browser sends the sentence and the output of `getTools()` to a small server route, an OpenAI-compatible model picks a tool, and the browser executes it through `document.modelContext.executeTool()`. The result goes back for the next turn until the model says it is done or six calls have been made. Every call lands in the same log as manual mode, marked "Model".

Model mode needs an OpenAI-compatible endpoint and key, set as environment variables on the server:

| Variable | Meaning |
|---|---|
| `MODEL_API_KEY` | Required. Without it the route reports "not configured" and the input is hidden, so a fresh clone runs in manual mode with no setup. |
| `MODEL_BASE_URL` | Optional. Defaults to `https://api.deepinfra.com/v1/openai`. |
| `MODEL_NAME` | Optional. Defaults to `deepseek-ai/DeepSeek-V4-Flash`. |

Put them in a `.env` file next to `package.json` (it is gitignored) or pass them to the container. The route never executes a tool and never touches the page; it only returns the model's choice. Guardrails: six tool calls per message, a 500 character message limit, 400 output tokens, an in-memory limit of ten messages per hour per address, tool results passed to the model as data with a system prompt that forbids treating them as instructions, and `delete_step` refused unless the message itself asks to delete or remove a step.

### With a WebMCP-enabled browser

- **Google Chrome 149 or later:** enable `chrome://flags/#enable-webmcp-testing`, restart, and open the app. The status pill reads "WebMCP native". Install the [Model Context Tool Inspector](https://github.com/beaufortfrancois/model-context-tool-inspector) extension to see the tools and execute them from the side panel, or use an agent that speaks WebMCP.
- **ChatGPT desktop app:** open the app in its in-app browser, which supports WebMCP by default, and ask it to run the onboarding runbook and fix whatever it finds.

### Automated

The project was verified with Playwright driving Chrome for Testing 152 headless with `--enable-features=WebMCP`, calling every tool through `executeTool()` and checking the DOM after each call, and again without the flag through the polyfill.

## Notes on browser behaviour

Observed on Chrome for Testing 152.0.7977.75:

- `document.modelContext` is the live namespace. `navigator.modelContext` is not present.
- The API is undefined outside a secure context. A page loaded via `about:blank` has no `modelContext`.
- `execute` is called with a single argument; no execution-time `signal` is passed.
- `getTools()` returns each tool's `inputSchema` as a JSON string, not an object. The harness accepts both.

## Accessibility and agent legibility

The page uses semantic elements and a sensible heading order, every control has an accessible name, the whole app works from the keyboard (with skip links to the run controls and the harness), and every change is announced through a polite live region. This serves assistive technology and it serves agents for the same reason: both consume the page as structure rather than pixels.

## Examples

Three generic runbooks ship with the app. None contain real client data, internal detail, credentials or infrastructure specifics.

- **Onboarding a new client into the CRM** (loads by default). Eight steps, four checks, one branch. Step 5 refers to a "Pipeline tab" that plausibly no longer exists, so a run produces a real blocker and the amendment loop can be shown end to end.
- **Restoring a database from a backup.** A procedure where checks matter and a wrong step loses data, with a branch to an escalation step when the backup fails verification.
- **Tomato and basil pasta.** Five steps with an ingredient-substitution branch, to show the model is not tied to any one field of work.

Use "Reset example" to restore any of them to the shipped content.

## Licence

MIT. See [LICENSE](LICENSE).
