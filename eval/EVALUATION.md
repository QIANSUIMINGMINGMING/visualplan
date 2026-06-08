# VisualPlan Phase-1 Evaluation Set

The evaluation question is not whether the diagram looks attractive. The
question is whether VisualPlan reduces human audit effort when a user must
correct the agent's understanding of a complex system.

## Measurement

Compare two conditions:

```text
A: text-only plan
B: VisualPlan YAML plus rendered HTML/SVG
```

Primary success metrics:

- User can identify the incorrect claim faster.
- User can issue a correction by stable ID.
- Agent can update the artifact without re-explaining the whole system.
- Final implementation or research plan has fewer boundary and ownership
  misunderstandings.

Secondary metrics:

- Number of clarification turns.
- Number of changed objects and relations.
- Number of unresolved questions left open at acceptance.
- Whether stable IDs survived render and revision.

## Scenario Set

### 1. Architecture Boundary Misunderstanding

Fixture: `examples/architecture_boundary_misunderstanding.yaml`

Text-only failure mode: the agent says "API talks to worker" without clarifying
whether that is a direct call, enqueue, or forbidden edge.

Success condition: the user can point to `rel_api_worker_forbidden` or
`command_log` and correct the boundary.

### 2. Data Research Hypothesis Space

Fixture: `examples/data_research_hypothesis_space.yaml`

Text-only failure mode: the agent jumps from features to an alpha claim without
showing leakage checks or baseline pressure.

Success condition: the user can target `unc_leakage`, `baseline_model`, or
`rel_state_alpha` and force a market-state-first plan.

### 3. Feedback Loop System

Fixture: `examples/feedback_loop_system.yaml`

Text-only failure mode: the agent treats a feedback loop as a one-way pipeline.

Success condition: the user can target `rel_shift_behavior` and confirm that
the loop is the central structure.

### 4. Ownership Responsibility Map

Fixture: `examples/ownership_responsibility_map.yaml`

Text-only failure mode: the agent edits shared deployment config as though it
were owned by the feature module.

Success condition: the user can target `deployment_config` or
`unc_config_owner` and require cross-owner review.

### 5. Linear Task Plan Rejection

Fixture: `examples/reject_linear_task_plan.yaml`

Text-only failure mode: the agent produces a normal step list when the real
need is structure alignment first.

Success condition: the user can target `rel_task_forbidden` and reject the
execution-first plan.

### 6. Research Code Understanding Alignment

Fixture: `examples/research_code_alignment.yaml`

Text-only failure mode: the agent names files and tasks but does not show what
evidence supports its change surface.

Success condition: the user can target `change_surface`, `evidence_index`, or
`unc_edge_cases` and revise the mental model before code changes.

## Test Plan

Automated tests:

- Schema tests: valid examples pass JSON Schema validation.
- Validator tests: duplicate IDs and unknown relation endpoints fail.
- Renderer tests: stable object and relation IDs appear in SVG/HTML.
- Watch tests: editing YAML updates generated HTML/SVG without restarting the
  watcher.

Human-loop tests:

- Give the user only text plan A and measure correction effort.
- Give the user VisualPlan B and measure correction effort.
- Require the correction to reference at least one object, relation, region, or
  uncertainty ID.
- Confirm the agent can revise YAML and record a revision note.

## Acceptance Criterion

For each scenario, a user can point to an object, relation, region, or
uncertainty ID and request a correction without re-explaining the whole system.
