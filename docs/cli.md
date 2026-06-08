# CLI Specification

VisualPlan is a Node.js CLI. It reads `visualplan.yaml`, validates the
structured grammar, writes deterministic HTML/SVG, and can serve a local review
URL for user-agent alignment.

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
visualplan render <file> [--out-dir <dir>] [--html <file>] [--svg <file>] [--json]
```

Writes `visualplan.html` and `visualplan.svg`. Rendered objects and relations
preserve stable `data-id` attributes for chat corrections.

### Watch

```bash
visualplan watch <file> [--out-dir <dir>] [--port <port>] [--host <host>] [--json]
```

Renders once, watches the YAML file, and re-renders on edits. If `--port` is
provided, it also serves the current output with the same local review server.

### Review

```bash
visualplan review <file-or-output-dir-or-html> [--port 8502] [--host 127.0.0.1] [--out-dir .visualplan/review] [--no-server] [--json]
```

If the source is YAML, VisualPlan validates and renders it into
`.visualplan/review/current`. If the source is a rendered output directory or
HTML file, VisualPlan stages it into the same current directory. The command
then starts a local server.

Use `--no-server` when a persistent review service is already running and the
command should only update the shared `current` review directory.

Routes:

- `/`: current review HTML.
- `/api/current`: current review metadata JSON.
- `/list`: previous/current staged reviews.
- `/outputs/<id>/visualplan.html`: specific staged review output.

## JSON Contract

Successful command output includes these stable fields:

```json
{
  "ok": true,
  "command": "render",
  "mode": "plan",
  "inputPath": "/abs/path/visualplan.yaml",
  "htmlPath": "/abs/path/visualplan.html",
  "svgPath": "/abs/path/visualplan.svg",
  "localUrl": null,
  "objectIds": ["agent_plan"],
  "relationIds": ["rel_plan_to_edits"],
  "uncertaintyIds": ["unc_plan_scope"],
  "warnings": []
}
```

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
