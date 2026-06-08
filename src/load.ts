import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { validateVisualPlan } from "./validate.js";
import type { ValidationResult, VisualPlan } from "./types.js";

export interface LoadedVisualPlan {
  plan: VisualPlan;
  validation: ValidationResult;
}

export async function loadVisualPlan(filePath: string): Promise<LoadedVisualPlan> {
  const text = await readFile(filePath, "utf8");
  const parsed = parse(text);
  const validation = validateVisualPlan(parsed);
  return {
    plan: parsed as VisualPlan,
    validation,
  };
}
