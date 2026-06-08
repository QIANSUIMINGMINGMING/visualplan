---
name: visualplan-alignment
description: Use when the user asks to visualize the current plan with VisualPlan, align the current goal, review whether the agent understood the request, create an alignment checkpoint, or use VisualPlan for plan/goal/session context before implementation.
---

# VisualPlan Alignment

Use VisualPlan to create a reviewable alignment artifact before implementation
or before continuing a risky goal. The artifact should show the agent's current
mental model, not a linear TODO list.

## Choose Mode

- `plan`: user asks to visualize the current plan, implementation approach,
  edit surface, boundaries, risks, or validation gates.
- `goal`: user asks to align the current goal, success criteria, current state,
  blockers, risks, or next step. If the active goal text is not visible, ask
  the user to provide or show it.
- `session`: user asks whether you understood their intent or wants a review of
  your interpretation in an ordinary conversation.
- `architecture`: architecture, routing, ownership, or boundary alignment.
- `research`: hypothesis, evidence, experiment, or uncertainty alignment.
- `custom`: none of the named modes fit.

## Workflow

1. Inspect the latest user prompt, visible conversation context, active plan or
   goal if available, and any relevant repo evidence.
2. Create `visualplan.yaml` with `mode`, `source`, `title`, `intent`,
   `objects`, `relations`, `space`, `focus`, `uncertainties`, and `revisions`.
3. Use stable IDs for every addressable object, relation, and uncertainty. Good
   IDs look like `edit_surface`, `rel_plan_to_validation`, and `unc_goal_gap`.
4. Include at least one explicit boundary or uncertainty when the user is
   asking for alignment.
5. Validate:

   ```bash
   visualplan validate visualplan.yaml --json
   ```

6. Start the local review:

   ```bash
   visualplan review visualplan.yaml --json
   ```

7. Return the `localUrl`, key `objectIds`, `relationIds`, `uncertaintyIds`, and
   warnings. Stop before implementation until the user approves or corrects the
   artifact.

## Quality Bar

- The diagram must represent goals, boundaries, risks, evidence, or
  understanding, not only task order.
- Stable IDs must be useful for user corrections in chat.
- Do not intercept or modify Codex built-in `/plan` or `/goal`; use the
  VisualPlan CLI as a normal tool.
- Do not create an MCP server or private deployment setup for this workflow.
