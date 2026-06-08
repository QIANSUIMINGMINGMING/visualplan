import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { validateVisualPlan } from "../src/validate.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const schema = JSON.parse(readFileSync(resolve(root, "schema/visualplan.schema.json"), "utf8"));
const examplesDir = resolve(root, "examples");

function loadExample(name: string): unknown {
  return parse(readFileSync(resolve(examplesDir, name), "utf8"));
}

describe("visualplan schema", () => {
  it("accepts every example fixture", () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(schema);
    const exampleFiles = readdirSync(examplesDir).filter((file) => file.endsWith(".yaml"));

    expect(exampleFiles.length).toBeGreaterThanOrEqual(5);
    for (const file of exampleFiles) {
      const parsed = loadExample(file);
      expect(validate(parsed), file).toBe(true);
      expect(validateVisualPlan(parsed).ok, file).toBe(true);
    }
  });

  it("rejects duplicate stable IDs", () => {
    const parsed = loadExample("research_code_alignment.yaml") as Record<string, unknown>;
    const objects = parsed.objects as Array<Record<string, unknown>>;
    objects[1] = {
      ...objects[1],
      id: objects[0].id,
    };

    const result = validateVisualPlan(parsed);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.message.includes("duplicate ID"))).toBe(true);
  });

  it("rejects unknown relation endpoints", () => {
    const parsed = loadExample("research_code_alignment.yaml") as Record<string, unknown>;
    const relations = parsed.relations as Array<Record<string, unknown>>;
    relations[0] = {
      ...relations[0],
      to: "missing_object",
    };

    const result = validateVisualPlan(parsed);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.message.includes("unknown object ID"))).toBe(true);
  });
});
