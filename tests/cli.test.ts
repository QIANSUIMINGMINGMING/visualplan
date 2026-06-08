import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function run(args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(args, {
    stdout: (message) => {
      stdout += message;
    },
    stderr: (message) => {
      stderr += message;
    },
  });
  return { exitCode, stdout, stderr };
}

describe("visualplan CLI JSON contract", () => {
  it("validates a valid file with JSON output", async () => {
    const result = await run(["validate", "examples/codex_plan_checkpoint.yaml", "--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("validate");
    expect(parsed.mode).toBe("plan");
    expect(parsed.objectIds).toContain("agent_plan");
    expect(parsed.relationIds).toContain("rel_plan_to_edits");
    expect(parsed.uncertaintyIds).toContain("unc_plan_scope");
  });

  it("returns a JSON failure for invalid validation input", async () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "visualplan-cli-invalid-"));
    try {
      const invalidPath = resolve(tempDir, "invalid.yaml");
      writeFileSync(invalidPath, [
        "title: Invalid",
        "intent: Invalid relation endpoint.",
        "objects:",
        "  - id: start",
        "    kind: node",
        "    label: Start",
        "    x: 10",
        "    y: 10",
        "relations:",
        "  - id: rel_missing",
        "    type: depend",
        "    from: start",
        "    to: missing",
        "space:",
        "  x_axis: x",
        "  y_axis: y",
        "  containment: none",
        "  proximity: none",
        "focus:",
        "  primary_path: []",
        "  key_boundaries: []",
        "  unresolved: []",
        "  accepted: []",
        "uncertainties: []",
        "revisions: []",
        "",
      ].join("\n"), "utf8");

      const result = await run(["validate", invalidPath, "--json"]);
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(1);
      expect(parsed.ok).toBe(false);
      expect(parsed.command).toBe("validate");
      expect(parsed.errors.some((error: { message: string }) => error.message.includes("unknown object ID"))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("renders with JSON output and writes HTML/SVG", async () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "visualplan-cli-render-"));
    try {
      const result = await run([
        "render",
        resolve(root, "examples/codex_plan_checkpoint.yaml"),
        "--out-dir",
        tempDir,
        "--json",
      ]);
      const parsed = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(parsed.ok).toBe(true);
      expect(parsed.command).toBe("render");
      expect(parsed.mode).toBe("plan");
      expect(existsSync(parsed.htmlPath)).toBe(true);
      expect(existsSync(parsed.svgPath)).toBe(true);
      expect(readFileSync(parsed.htmlPath, "utf8")).toContain("Codex Plan Alignment Checkpoint");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("lists goal scenarios as JSON", async () => {
    const result = await run(["scenarios", "--mode", "goal", "--json"]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("scenarios");
    expect(parsed.scenarios.map((scenario: { name: string }) => scenario.name)).toEqual(["codex_goal_checkpoint"]);
  });
});
