# VisualPlan

Visual alignment for agent plans, goals, and understanding.

VisualPlan is a local-first npm CLI that turns an agent's current mental model
into a structured, reviewable HTML/SVG artifact. It helps a user and a code or
research agent align before implementation, during goal pursuit, or when the
user wants to check whether the agent understood the request.

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

Open `.visualplan/render/visualplan.html` in a browser.

## Fixed Local Review URL

`review` renders YAML or stages an existing rendered output, then starts a local
server for review:

```bash
visualplan review visualplan.yaml --json
```

Default URL:

```text
http://127.0.0.1:8502/
```

Useful endpoints:

- `/`: current review HTML.
- `/api/current`: current review metadata JSON.
- `/list`: current and previous review outputs staged under `.visualplan/review`.

## Agent Alignment Checkpoints

Natural prompts an agent can respond to:

```text
把你当前 plan 用 VisualPlan 可视化一下，我想检查理解和边界。
围绕当前 goal 做一个 VisualPlan，对齐成功标准、当前状态、风险和下一步。
我不确定你是否理解我的意思，生成一个 VisualPlan 让我 review。
Use $visualplan-alignment to visualize the current goal/plan/session context.
```

The agent should create `visualplan.yaml`, run `visualplan validate`, run
`visualplan review`, return the URL and key stable IDs, then stop before
implementation until the user approves or corrects the artifact.

## CLI

```bash
visualplan init --scenario <name> [--out <file>]
visualplan scenarios [--mode <mode>] [--json]
visualplan validate <file> [--json]
visualplan render <file> [--out-dir <dir>] [--html <file>] [--svg <file>] [--json]
visualplan watch <file> [--out-dir <dir>] [--port <port>] [--host <host>] [--json]
visualplan review <file-or-output-dir-or-html> [--port 8502] [--host 127.0.0.1] [--out-dir .visualplan/review] [--json]
```

See [docs/cli.md](docs/cli.md), [docs/agent-native.md](docs/agent-native.md),
and [docs/codex-adapter.md](docs/codex-adapter.md).

## Package Contents

- `schema/visualplan.schema.json`: Draft 2020-12 JSON Schema.
- `src/`: TypeScript CLI, validator, renderer, watcher, and review server.
- `examples/`: scenario fixtures for `visualplan init`.
- `docs/`: CLI, format, rendering, and agent-adapter documentation.
- `.agents/skills/visualplan-alignment`: Codex adapter skill.

## Non-Goals

- No interception of built-in Codex `/plan` or `/goal`.
- No MCP server in the first release.
- No GUI canvas editor in the first release.
- No private relay, Caddy, systemd, or machine-specific deployment defaults.
