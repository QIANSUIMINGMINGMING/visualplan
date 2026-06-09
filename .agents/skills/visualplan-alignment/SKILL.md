---
name: visualplan-alignment
description: Explicit-only VisualPlan alignment workflow. Use only when the user explicitly invokes $visualplan-alignment, asks to visualize the current plan with VisualPlan, align the current goal, review whether the agent understood the request, or create an alignment checkpoint.
---

# VisualPlan Alignment

Use this skill only after an explicit user invocation. It creates an IDE-native
VisualPlan alignment artifact for the current project so the user can Cmd-click
an absolute Markdown path from VSCode, Cursor, or another IDE terminal.

Product repo: `https://github.com/QIANSUIMINGMINGMING/visualplan`
Product issues: `https://github.com/QIANSUIMINGMINGMING/visualplan/issues`

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

1. Inspect the latest user request, visible plan/goal/session context, and repo
   evidence needed for alignment.
2. Write the artifact in the current project at `.visualplan/visualplan.yaml`.
   Include `mode`, `source`, `title`, `intent`, `objects`, `relations`,
   `space`, `focus`, `uncertainties`, and `revisions`.
3. Use stable IDs for every addressable object, relation, and uncertainty. Good
   IDs look like `edit_surface`, `rel_plan_to_validation`, and `unc_goal_gap`.
4. Include at least one explicit boundary or uncertainty when the user is
   asking for alignment.
5. Validate and render:

   ```bash
   mkdir -p .visualplan
   visualplan validate .visualplan/visualplan.yaml --json
   visualplan render .visualplan/visualplan.yaml --out-dir .visualplan/render --json
   ```

6. Return `primaryPath` first, then `svgPath`, key `objectIds`, `relationIds`,
   `uncertaintyIds`, and warnings. Stop before implementation until the user
   approves or corrects the artifact.

## Follow-Up Issue Flow

When using VisualPlan in any project reveals a VisualPlan product bug, workflow
gap, missing feature, bad default, or confusing behavior, create a GitHub issue
in `QIANSUIMINGMINGMING/visualplan`, not in the current project, unless the
user explicitly asks otherwise. Include the originating project context,
VisualPlan command, `primaryPath` or relevant stable IDs, observed behavior,
expected behavior, and acceptance checks.

Later, open a Codex session in the VisualPlan repository and fix those issues
one by one from that directory.

## Quality Bar

- The artifact must expose agent-user alignment: intent, assumptions,
  boundaries, risk, evidence, uncertainty, or success criteria.
- Do not output only a linear TODO list.
- Do not start a browser review server, Caddy relay, or persistent service.
- Do not use this skill unless the user explicitly invoked it.
