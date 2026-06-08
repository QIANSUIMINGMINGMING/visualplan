# Contributing

VisualPlan is a small TypeScript CLI for visual alignment artifacts. Keep
changes focused on the schema, renderer, CLI contract, examples, and agent
adapter workflows.

## Development

```bash
npm install
npm run build
npm test
```

Before release-oriented changes, also run:

```bash
npm audit --audit-level=moderate
npm pack --dry-run
```

## Guidelines

- Keep `visualplan.yaml` as the source of truth.
- Preserve stable object, relation, and uncertainty IDs.
- Do not turn VisualPlan into a task board or execution tracker.
- Keep examples small, reviewable, and grounded in agent-user alignment.
- Do not add private deployment defaults, machine paths, or hosted URLs.
