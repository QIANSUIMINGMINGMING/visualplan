# VisualPlan Format Specification

`visualplan.yaml` is the source of truth. It must be readable by the agent,
auditable by the user, and deterministic enough to render without hidden layout
state.

## Required Top-Level Fields

```yaml
mode: plan | goal | session | architecture | research | custom # optional
source: SourceMetadata # optional
title: string
intent: string
objects: VisualObject[]
relations: VisualRelation[]
space: SpaceSemantics
focus: Focus
uncertainties: Uncertainty[]
revisions: RevisionNote[]
```

`mode` and `source` are optional so older artifacts remain valid. New agent
alignment checkpoints should set `mode`.

```yaml
mode: goal
source:
  agent: Codex
  surface: goal mode
  prompt: User asked to align the active goal before continuing.
  goal: Current visible goal text.
```

Allowed modes:

| Mode | Use |
|---|---|
| `plan` | Proposed approach, edit surface, boundaries, risks, verification. |
| `goal` | Active goal, success criteria, current state, blockers, next checkpoint. |
| `session` | User intent and agent understanding in an ordinary conversation. |
| `architecture` | System structure, ownership, routing, and boundaries. |
| `research` | Hypotheses, evidence, experiments, and uncertainty. |
| `custom` | Any artifact that does not fit the named modes. |

All user-addressable visual elements require stable IDs. IDs must match:

```text
^[a-z][a-z0-9_-]*$
```

Use IDs that are stable under visual rearrangement. Prefer
`rel_api_log`, `command_boundary`, or `unc_owner_gap` over positional names like
`left_box_1`.

## Objects

Objects are the visual anchors a user can point to in chat.

```yaml
- id: command_log
  kind: boundary
  label: Command Log Boundary
  summary: Durable handoff between synchronous API and async workers.
  x: 540
  y: 150
  width: 190
  height: 96
```

Allowed object kinds:

| Kind | Meaning |
|---|---|
| `node` | System component, concept, actor, or model state. |
| `region` | Ownership, evidence, domain, or conceptual area. |
| `boundary` | Constraint, ownership split, synchronization point, or trust boundary. |
| `evidence` | Repo file, command output, paper fact, metric, or source anchor. |
| `uncertainty` | Visible marker for an unresolved question. |

Coordinates are explicit in V1. This keeps rendering deterministic and makes
YAML diffs meaningful.

## Relations

Relations connect objects and carry the system semantics.

```yaml
- id: rel_api_worker_forbidden
  type: forbid
  from: api
  to: worker
  label: must not call
  evidence: src/api/commands.ts:8
```

Allowed relation types:

| Type | Meaning |
|---|---|
| `flow` | Data, control, request, or material movement. |
| `contain` | Region or owner contains an object. |
| `depend` | One object depends on another. |
| `conflict` | Two claims or surfaces disagree. |
| `forbid` | The relation should not exist or must not be used. |
| `map` | Evidence or representation maps to a claim. |
| `feedback` | Downstream state influences upstream state. |
| `order` | One alignment condition must precede another. |

Relations are first-class addressable elements. A user correction can target
`rel_state_alpha` without re-describing the whole diagram.

## Space Semantics

The `space` block explains what visual position means:

```yaml
space:
  x_axis: Left is observed evidence; right is proposed action.
  y_axis: Top is the agent claim; bottom is correction and uncertainty.
  containment: Regions indicate evidence or ownership domains, not task phases.
  proximity: Nearby objects are assumed tightly coupled until corrected.
```

This prevents the renderer from becoming a generic flowchart. The same diagram
shape can mean different things depending on spatial semantics.

## Focus

The `focus` block tells the user where the agent wants attention.

```yaml
focus:
  primary_path:
    - rel_evidence_to_model
    - rel_model_to_change
  key_boundaries:
    - change_surface
  unresolved:
    - unc_edge_cases
  accepted:
    - agent_model
```

`primary_path` and `key_boundaries` are highlighted in the SVG. `unresolved`
usually references uncertainty IDs. `accepted` records pieces the user has
already approved.

## Uncertainties

Uncertainties are explicit questions, not vague warnings.

```yaml
- id: unc_edge_cases
  target: gap_marker
  question: Which uninspected files could invalidate the proposed change surface?
  impact: A missed edge case would make implementation overconfident.
  status: open
```

Allowed statuses are `open`, `accepted`, and `resolved`.

## Revisions

Every user correction should create or update a revision note.

```yaml
- id: rev_user_boundary_fix
  date: "2026-06-08"
  source: user
  note: User clarified that the API may enqueue commands but must not call worker directly.
  changed_objects:
    - command_log
  changed_relations:
    - rel_api_worker_forbidden
```

Revision notes make the artifact useful across sessions without creating a
separate project-memory workflow.
