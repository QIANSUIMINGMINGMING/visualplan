# Rendering Specification

The renderer is deterministic. The same `visualplan.yaml` should produce the
same Markdown sections, SVG object positions, stable element IDs, relation
labels, and visible unresolved questions.

## Outputs

Default command:

```bash
visualplan render visualplan.yaml
```

Default outputs next to the input file:

```text
visualplan.md
visualplan.svg
```

`visualplan.md` is the primary review artifact. It embeds and links the SVG,
then lists alignment mode, source metadata, intent, spatial semantics, focus
lists, objects, relations, uncertainties, and revisions by stable ID.

`visualplan.svg` is the standalone visual map.

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

## Markdown Review Index

The Markdown file shows:

- Alignment mode and source metadata when present.
- Intent.
- Spatial semantics.
- Focus lists.
- Object list.
- Relation list.
- Unresolved questions.
- Revision history.

Agents should show the absolute Markdown path first because it is the artifact
users can Cmd-click from VSCode, Cursor, or another IDE terminal.

## Visual Conventions

| Semantic | Rendering |
|---|---|
| `region` | Large light-gray dashed container. |
| `boundary` | Orange dashed object. |
| `uncertainty` | Amber dashed object and Markdown question. |
| `conflict` | Red dashed relation. |
| `forbid` | Dark-red dashed relation. |
| Focused object or relation | Thicker stroke. |
| Accepted focus | Listed in the focus section. |

The renderer intentionally avoids freeform drawing semantics. Its job is to
make typed system understanding visible, not to emulate a whiteboard.

## Watch Mode

`visualplan watch <file>` renders immediately, watches the YAML file, and
re-renders Markdown/SVG on changes.

## Deferred Rendering Features

- Direct canvas editing.
- Automatic layout.
- Drag handles.
- Constraint overlays from extracted code.
- Multi-file diagram composition.
- MCP transport.
