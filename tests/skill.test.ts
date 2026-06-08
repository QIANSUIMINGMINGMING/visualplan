import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { validateVisualPlan } from "../src/validate.js";
import type { VisualPlan } from "../src/types.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function loadExample(name: string): VisualPlan {
  return parse(readFileSync(resolve(root, "examples", name), "utf8")) as VisualPlan;
}

describe("visualplan Codex skill and alignment examples", () => {
  it("front-loads the expected trigger language", () => {
    const text = readFileSync(resolve(root, ".agents/skills/visualplan-alignment/SKILL.md"), "utf8");

    expect(text).toMatch(/visualize the current plan/i);
    expect(text).toMatch(/align the current goal/i);
    expect(text).toMatch(/review whether the agent understood/i);
    expect(text).toMatch(/alignment checkpoint/i);
  });

  it("provides plan, goal, and session examples with stable IDs", () => {
    const examples = [
      ["codex_plan_checkpoint.yaml", "plan"],
      ["codex_goal_checkpoint.yaml", "goal"],
      ["session_intent_alignment.yaml", "session"],
    ] as const;

    for (const [file, mode] of examples) {
      const plan = loadExample(file);
      const validation = validateVisualPlan(plan);

      expect(validation.ok, file).toBe(true);
      expect(plan.mode).toBe(mode);
      expect(plan.objects.length, file).toBeGreaterThanOrEqual(5);
      expect(plan.relations.length, file).toBeGreaterThanOrEqual(4);
      expect(plan.uncertainties.length, file).toBeGreaterThanOrEqual(1);
      expect(plan.relations.every((relation) => relation.id.startsWith("rel_")), file).toBe(true);
      expect(plan.uncertainties.every((uncertainty) => uncertainty.id.startsWith("unc_")), file).toBe(true);
    }
  });
});
