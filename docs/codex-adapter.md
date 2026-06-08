# Codex Adapter

The first adapter is a repository skill:

```text
.agents/skills/visualplan-alignment/SKILL.md
```

Codex should use it when a user asks for a VisualPlan, an alignment checkpoint,
a visualized plan, goal alignment, or a review of whether the agent understood
the request.

## Natural User Prompts

```text
把你当前 plan 用 VisualPlan 可视化一下，我想检查理解和边界。
围绕当前 goal 做一个 VisualPlan，对齐成功标准、当前状态、风险和下一步。
我不确定你是否理解我的意思，生成一个 VisualPlan 让我 review。
Use $visualplan-alignment to visualize the current goal/plan/session context.
```

## Mode Selection

- Current implementation plan or plan mode: `mode: plan`.
- Active goal or goal mode: `mode: goal`.
- User asks whether Codex understood intent: `mode: session`.
- Architecture boundary/routing/ownership focus: `mode: architecture`.
- Research hypothesis/evidence/experiment focus: `mode: research`.

If the active goal text is not visible, Codex should ask the user to provide it
or expose it before creating a goal-mode artifact.

## Expected Codex Behavior

1. Create `visualplan.yaml`.
2. Run `visualplan validate visualplan.yaml --json`.
3. Run `visualplan review visualplan.yaml --json`.
4. Return the review URL and stable IDs.
5. Stop before implementation until the user approves or corrects the artifact.

The adapter does not intercept Codex built-in `/plan` or `/goal`. It is a
normal skill workflow that uses the stable VisualPlan CLI.
