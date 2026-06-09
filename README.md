# VisualPlan

Visual alignment for agent plans, goals, and understanding.

VisualPlan is a local-first npm CLI that turns an agent's current mental model
into structured Markdown plus a deterministic SVG diagram. It helps a user and a
code or research agent align before implementation, during goal pursuit, or when
the user wants to check whether the agent understood the request.

VisualPlan is not a task board, whiteboard, kanban tool, or execution tracker.
The `plan` in VisualPlan is an alignment artifact: objects, relations,
boundaries, risks, uncertainty, and revision notes with stable IDs the user can
correct in chat.

## Alignment Modes

- `plan`: proposed approach, edit surface, boundaries, risks, and validation.
- `goal`: active goal, success criteria, current state, blockers, and next
  checkpoint.
- `session`: user intent vs. agent understanding in an ordinary conversation.
- `architecture`, `research`, `custom`: reserved for specialized artifacts.

## Install

```bash
npm install -g visualplan
```

For local development:

```bash
npm install
npm run build
```

## Quick Start

Create and render an example:

```bash
visualplan init --scenario codex_plan_checkpoint --out visualplan.yaml
visualplan validate visualplan.yaml --json
visualplan render visualplan.yaml --out-dir .visualplan/render --json
```

`render` writes `visualplan.md` and `visualplan.svg`. Paths in JSON are absolute:

```json
{
  "primaryPath": "/abs/path/.visualplan/render/visualplan.md",
  "markdownPath": "/abs/path/.visualplan/render/visualplan.md",
  "svgPath": "/abs/path/.visualplan/render/visualplan.svg"
}
```

In VSCode, Cursor, or another IDE terminal, Cmd-click the absolute
`primaryPath` to inspect the alignment artifact in the IDE.

## Agent Alignment Checkpoints

Natural prompts an agent can respond to:

```text
把你当前 plan 用 VisualPlan 可视化一下，我想检查理解和边界。
围绕当前 goal 做一个 VisualPlan，对齐成功标准、当前状态、风险和下一步。
我不确定你是否理解我的意思，生成一个 VisualPlan 让我 review。
Use $visualplan-alignment to visualize the current goal/plan/session context.
```

The agent should create `visualplan.yaml`, run `visualplan validate`, run
`visualplan render`, return the absolute Markdown path plus key stable IDs, then
stop before implementation until the user approves or corrects the artifact.

## CLI

```bash
visualplan init --scenario <name> [--out <file>]
visualplan scenarios [--mode <mode>] [--json]
visualplan validate <file> [--json]
visualplan render <file> [--out-dir <dir>] [--md <file>] [--svg <file>] [--json]
visualplan watch <file> [--out-dir <dir>] [--md <file>] [--svg <file>] [--json]
```

See [docs/cli.md](docs/cli.md), [docs/agent-native.md](docs/agent-native.md),
and [docs/codex-adapter.md](docs/codex-adapter.md).

## Package Contents

- `schema/visualplan.schema.json`: Draft 2020-12 JSON Schema.
- `src/`: TypeScript CLI, validator, renderer, watcher, and scenario loader.
- `examples/`: scenario fixtures for `visualplan init`.
- `docs/`: CLI, format, rendering, and agent-adapter documentation.
- `.agents/skills/visualplan-alignment`: Codex adapter skill.

## Feedback And Issues

If using VisualPlan inside another project exposes a bug, missing mode, bad
default, or feature request, open an issue in:

```text
https://github.com/QIANSUIMINGMINGMING/visualplan/issues
```

Later, open a Codex session in the VisualPlan repository and fix those issues
one by one from the repo itself.

## Non-Goals

- No interception of built-in Codex `/plan` or `/goal`.
- No MCP server in the first release.
- No GUI canvas editor in the first release.
- No browser review server, private relay, Caddy, systemd, or machine-specific
  deployment defaults.
