# CLI Specification

VisualPlan is a Node.js CLI. It reads `visualplan.yaml`, validates the
structured grammar, and writes deterministic Markdown/SVG artifacts for
user-agent alignment.

## Commands

### Init

```bash
visualplan init --scenario <name> [--out <file>] [--json]
```

Copies an example scenario into `visualplan.yaml` or the requested path.

### Scenarios

```bash
visualplan scenarios [--mode <mode>] [--json]
```

Lists built-in scenario names. `--mode goal` returns goal examples such as
`codex_goal_checkpoint`.

### Validate

```bash
visualplan validate <file> [--json]
```

Validates required fields, stable IDs, references, focus lists, optional
`mode`, and optional `source` metadata.

### Render

```bash
visualplan render <file> [--out-dir <dir>] [--md <file>] [--svg <file>] [--json]
```

Writes `visualplan.md` and `visualplan.svg` by default. Rendered objects and
relations preserve stable IDs in both the Markdown review text and SVG
`data-id` attributes.

Human output prints the absolute Markdown path first so it can be Cmd-clicked
from an IDE terminal.

### Watch

```bash
visualplan watch <file> [--out-dir <dir>] [--md <file>] [--svg <file>] [--json]
```

Renders once, watches the YAML file, and re-renders Markdown/SVG on edits.

## JSON Contract

Successful command output includes these stable fields:

```json
{
  "ok": true,
  "command": "render",
  "mode": "plan",
  "inputPath": "/abs/path/visualplan.yaml",
  "primaryPath": "/abs/path/visualplan.md",
  "markdownPath": "/abs/path/visualplan.md",
  "svgPath": "/abs/path/visualplan.svg",
  "objectIds": ["agent_plan"],
  "relationIds": ["rel_plan_to_edits"],
  "uncertaintyIds": ["unc_plan_scope"],
  "warnings": []
}
```

`primaryPath` is the artifact agents should show first to the user. For the
current renderer it is the same as `markdownPath`.

Failures use:

```json
{
  "ok": false,
  "command": "validate",
  "errors": [
    { "path": "$.relations[0].to", "message": "unknown object ID 'missing'" }
  ],
  "exitCode": 1
}
```

Additional command-specific fields may be present. For example, `scenarios
--json` includes a `scenarios` array.

## Removed Browser Review Command

`visualplan review` and HTML output are not part of the supported CLI surface.
Use `visualplan render` and open the absolute `primaryPath` in the IDE.

## Scenario Modes

Current built-in examples cover:

- `plan`: `codex_plan_checkpoint`, `reject_linear_task_plan`
- `goal`: `codex_goal_checkpoint`
- `session`: `session_intent_alignment`, `research_code_alignment`
- `architecture`: architecture and ownership examples
- `research`: research hypothesis examples

## MCP Direction

No MCP server is included in the first release. The CLI and schema are the
stable transport surface. Future MCP tools should reuse the same schema rather
than introduce a second source of truth.
