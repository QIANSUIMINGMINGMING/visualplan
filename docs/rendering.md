# Rendering Specification

The renderer is deterministic. The same `visualplan.yaml` should produce the
same object positions, stable element IDs, relation labels, side-panel lists,
and visible unresolved questions.

## Outputs

Default command:

```bash
visualplan render visualplan.yaml
```

Default outputs next to the input file:

```text
visualplan.html
visualplan.svg
```

`visualplan.html` embeds the SVG inline and adds a side panel. `visualplan.svg`
is the standalone diagram.

## Stable Rendered IDs

Every rendered visual object includes:

```html
data-id="object:<id>"
```

Every rendered relation includes:

```html
data-id="relation:<id>"
```

These attributes are part of the user-agent correction contract.

## Side Panel

The HTML side panel shows:

- Alignment mode and source metadata when present.
- Intent.
- Spatial semantics.
- Focus lists.
- Object list.
- Relation list.
- Unresolved questions.
- Revision history.

The panel is not a secondary documentation page. It is the user-addressable
index for chat corrections.

## Visual Conventions

| Semantic | Rendering |
|---|---|
| `region` | Large light-gray dashed container. |
| `boundary` | Orange dashed object. |
| `uncertainty` | Amber dashed object and side-panel question. |
| `conflict` | Red dashed relation. |
| `forbid` | Dark-red dashed relation. |
| Focused object or relation | Thicker stroke. |
| Accepted focus | Listed in the focus panel. |

The renderer intentionally avoids freeform drawing semantics. Its job is to
make typed system understanding visible, not to emulate a whiteboard.

## Watch Mode

`visualplan watch <file>` renders immediately, watches the YAML file, and
re-renders on changes. Watch-mode HTML includes a short auto-refresh hook so a
browser or file-portal preview updates without restarting the CLI.

## Review Server

`visualplan review <source>` renders or stages the current artifact under
`.visualplan/review/current` and starts a local Node server. The server exposes
only explicit review routes:

- `/` for current HTML.
- `/visualplan.svg` for current SVG when present.
- `/api/current` for metadata JSON.
- `/list` for staged current/history outputs.

The review server does not depend on systemd, Caddy, private relay hosts, or
machine-specific paths.

## Deferred Rendering Features

- Direct canvas editing.
- Automatic layout.
- Drag handles.
- Constraint overlays from extracted code.
- Multi-file diagram composition.
- MCP transport.

These are future extensions, not phase-1 requirements.
