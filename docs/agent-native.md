# Agent-Native VisualPlan

VisualPlan is an agent-user alignment layer. It is useful when text alone makes
it hard for a user to see what the agent believes about the goal, plan,
boundaries, risk, or uncertainty.

## When To Use It

Use VisualPlan when the user asks to:

- visualize a current plan before implementation;
- align an active goal and success criteria;
- review whether the agent understood the user's intent;
- expose architecture or research assumptions before acting;
- make risks, blockers, and unresolved questions addressable by stable ID.

Do not use VisualPlan as a task board, TODO list, progress tracker, or
whiteboard replacement.

## Agent Workflow

1. Inspect the current user prompt, visible conversation context, and relevant
   repo evidence.
2. Choose `mode`: `plan`, `goal`, `session`, `architecture`, `research`, or
   `custom`.
3. Create `visualplan.yaml` with stable object, relation, and uncertainty IDs.
4. Validate:

   ```bash
   visualplan validate visualplan.yaml --json
   ```

5. Start review:

   ```bash
visualplan review visualplan.yaml --json
```

If a persistent VisualPlan review service is already running, update it without
binding a new port:

```bash
visualplan review visualplan.yaml --out-dir ~/.local/share/visualplan/review --no-server --json
```

6. Return the local URL, key object/relation/uncertainty IDs, and any warnings.
7. Stop before implementation until the user approves or corrects the artifact.

## Good Artifacts

Good VisualPlan artifacts show:

- what the agent thinks the user wants;
- what evidence or context supports that understanding;
- what will be edited or decided;
- what is explicitly out of scope;
- what could invalidate the plan;
- how the user can correct the artifact by ID.

Bad artifacts are only linear TODO lists, unaddressable prose summaries, or
decorative diagrams without stable IDs.

## JSON Contract

Agents should prefer `--json` and parse `ok`, `localUrl`, `objectIds`,
`relationIds`, `uncertaintyIds`, and `warnings`. On failure, report `errors`
with their `path` and `message`, then fix the YAML before asking for review.

## Optional Relay

VisualPlan only starts a local Node server by default. Teams may add their own
Caddy, SSH tunnel, or relay process around `http://127.0.0.1:8502/`, but the
package does not include private deployment defaults.
