import {
  alignmentModes,
  objectKinds,
  relationKinds,
  type ValidationIssue,
  type ValidationResult,
  type VisualPlan,
} from "./types.js";

const idPattern = /^[a-z][a-z0-9_-]*$/;
const alignmentModeSet = new Set<string>(alignmentModes);
const objectKindSet = new Set<string>(objectKinds);
const relationKindSet = new Set<string>(relationKinds);

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationIssue[],
): void {
  if (typeof value[key] !== "string" || value[key] === "") {
    errors.push(issue(`${path}.${key}`, "must be a non-empty string"));
  }
}

function requireNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationIssue[],
): void {
  if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
    errors.push(issue(`${path}.${key}`, "must be a finite number"));
  }
}

function validateId(
  id: unknown,
  path: string,
  seen: Set<string>,
  errors: ValidationIssue[],
): string | undefined {
  if (typeof id !== "string" || id === "") {
    errors.push(issue(path, "must be a non-empty stable ID"));
    return undefined;
  }
  if (!idPattern.test(id)) {
    errors.push(issue(path, "must match /^[a-z][a-z0-9_-]*$/"));
  }
  if (seen.has(id)) {
    errors.push(issue(path, `duplicate ID '${id}'`));
  }
  seen.add(id);
  return id;
}

function idsFromFocus(plan: VisualPlan): string[] {
  const focus = plan.focus as unknown as Record<string, unknown>;
  const list = (key: string): string[] => Array.isArray(focus[key])
    ? focus[key].filter((value): value is string => typeof value === "string")
    : [];

  return [
    ...list("primary_path"),
    ...list("key_boundaries"),
    ...list("unresolved"),
    ...list("accepted"),
  ];
}

export function validateVisualPlan(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [issue("$", "document must be an object")],
      warnings,
    };
  }

  requireString(input, "title", "$", errors);
  requireString(input, "intent", "$", errors);

  if (input.mode !== undefined && (typeof input.mode !== "string" || !alignmentModeSet.has(input.mode))) {
    errors.push(issue("$.mode", `must be one of ${alignmentModes.join(", ")}`));
  }
  if (input.source !== undefined) {
    if (!isRecord(input.source)) {
      errors.push(issue("$.source", "must be an object when present"));
    } else {
      const source = input.source;
      const allowedSourceKeys = new Set(["agent", "surface", "prompt", "goal"]);
      Object.keys(source).forEach((key) => {
        if (!allowedSourceKeys.has(key)) {
          errors.push(issue(`$.source.${key}`, "is not allowed"));
        } else if (typeof source[key] !== "string" || source[key] === "") {
          errors.push(issue(`$.source.${key}`, "must be a non-empty string when present"));
        }
      });
    }
  }

  if (!Array.isArray(input.objects)) {
    errors.push(issue("$.objects", "must be an array"));
  }
  if (!Array.isArray(input.relations)) {
    errors.push(issue("$.relations", "must be an array"));
  }
  if (!isRecord(input.space)) {
    errors.push(issue("$.space", "must be an object"));
  }
  if (!isRecord(input.focus)) {
    errors.push(issue("$.focus", "must be an object"));
  }
  if (!Array.isArray(input.uncertainties)) {
    errors.push(issue("$.uncertainties", "must be an array"));
  }
  if (!Array.isArray(input.revisions)) {
    errors.push(issue("$.revisions", "must be an array"));
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const plan = input as unknown as VisualPlan;
  const objectIds = new Set<string>();
  const relationIds = new Set<string>();
  const uncertaintyIds = new Set<string>();
  const revisionIds = new Set<string>();

  plan.objects.forEach((object, index) => {
    const path = `$.objects[${index}]`;
    if (!isRecord(object)) {
      errors.push(issue(path, "must be an object"));
      return;
    }
    validateId(object.id, `${path}.id`, objectIds, errors);
    if (typeof object.kind !== "string" || !objectKindSet.has(object.kind)) {
      errors.push(issue(`${path}.kind`, `must be one of ${objectKinds.join(", ")}`));
    }
    requireString(object, "label", path, errors);
    requireNumber(object, "x", path, errors);
    requireNumber(object, "y", path, errors);
    if (object.width !== undefined && typeof object.width !== "number") {
      errors.push(issue(`${path}.width`, "must be a number when present"));
    }
    if (object.height !== undefined && typeof object.height !== "number") {
      errors.push(issue(`${path}.height`, "must be a number when present"));
    }
  });

  plan.relations.forEach((relation, index) => {
    const path = `$.relations[${index}]`;
    if (!isRecord(relation)) {
      errors.push(issue(path, "must be an object"));
      return;
    }
    validateId(relation.id, `${path}.id`, relationIds, errors);
    if (typeof relation.type !== "string" || !relationKindSet.has(relation.type)) {
      errors.push(issue(`${path}.type`, `must be one of ${relationKinds.join(", ")}`));
    }
    requireString(relation, "from", path, errors);
    requireString(relation, "to", path, errors);
    if (typeof relation.from === "string" && !objectIds.has(relation.from)) {
      errors.push(issue(`${path}.from`, `unknown object ID '${relation.from}'`));
    }
    if (typeof relation.to === "string" && !objectIds.has(relation.to)) {
      errors.push(issue(`${path}.to`, `unknown object ID '${relation.to}'`));
    }
  });

  const requiredSpaceKeys = ["x_axis", "y_axis", "containment", "proximity"] as const;
  requiredSpaceKeys.forEach((key) => requireString(plan.space as unknown as Record<string, unknown>, key, "$.space", errors));

  const focus = plan.focus as unknown as Record<string, unknown>;
  ["primary_path", "key_boundaries", "unresolved", "accepted"].forEach((key) => {
    if (!Array.isArray(focus[key])) {
      errors.push(issue(`$.focus.${key}`, "must be an array"));
    }
  });
  const unresolvedFocus = Array.isArray(focus.unresolved)
    ? focus.unresolved.filter((value): value is string => typeof value === "string")
    : [];

  const addressableIds = new Set<string>([...objectIds, ...relationIds]);

  plan.uncertainties.forEach((uncertainty, index) => {
    const path = `$.uncertainties[${index}]`;
    if (!isRecord(uncertainty)) {
      errors.push(issue(path, "must be an object"));
      return;
    }
    const uncertaintyId = validateId(uncertainty.id, `${path}.id`, uncertaintyIds, errors);
    requireString(uncertainty, "target", path, errors);
    requireString(uncertainty, "question", path, errors);
    if (typeof uncertainty.target === "string" && !addressableIds.has(uncertainty.target)) {
      errors.push(issue(`${path}.target`, `unknown target ID '${uncertainty.target}'`));
    }
    if (uncertainty.status !== undefined) {
      const statuses = new Set(["open", "accepted", "resolved"]);
      if (typeof uncertainty.status !== "string" || !statuses.has(uncertainty.status)) {
        errors.push(issue(`${path}.status`, "must be open, accepted, or resolved"));
      }
    }
    if (uncertaintyId && !unresolvedFocus.includes(uncertaintyId) && uncertainty.status !== "resolved") {
      warnings.push(issue(path, `uncertainty '${uncertaintyId}' is not listed in focus.unresolved`));
    }
  });

  plan.revisions.forEach((revision, index) => {
    const path = `$.revisions[${index}]`;
    if (!isRecord(revision)) {
      errors.push(issue(path, "must be an object"));
      return;
    }
    validateId(revision.id, `${path}.id`, revisionIds, errors);
    requireString(revision, "date", path, errors);
    requireString(revision, "source", path, errors);
    requireString(revision, "note", path, errors);
    if (!Array.isArray(revision.changed_objects)) {
      errors.push(issue(`${path}.changed_objects`, "must be an array"));
    } else {
      revision.changed_objects.forEach((id) => {
        if (typeof id !== "string" || !objectIds.has(id)) {
          errors.push(issue(`${path}.changed_objects`, `unknown object ID '${String(id)}'`));
        }
      });
    }
    if (!Array.isArray(revision.changed_relations)) {
      errors.push(issue(`${path}.changed_relations`, "must be an array"));
    } else {
      revision.changed_relations.forEach((id) => {
        if (typeof id !== "string" || !relationIds.has(id)) {
          errors.push(issue(`${path}.changed_relations`, `unknown relation ID '${String(id)}'`));
        }
      });
    }
  });

  const allFocusableIds = new Set<string>([...objectIds, ...relationIds, ...uncertaintyIds]);
  idsFromFocus(plan).forEach((id) => {
    if (!allFocusableIds.has(id)) {
      warnings.push(issue("$.focus", `focus references unresolved ID '${id}'`));
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
