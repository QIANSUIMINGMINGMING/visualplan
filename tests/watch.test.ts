import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { initScenario } from "../src/init.js";
import { watchVisualPlan } from "../src/watch.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function waitFor(assertion: () => void, timeoutMs = 2500): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolveTimer) => setTimeout(resolveTimer, 60));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

describe("visualplan watch and init", () => {
  it("copies a scenario template", async () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "visualplan-init-"));
    try {
      const outPath = resolve(tempDir, "visualplan.yaml");
      await initScenario("architecture_boundary_misunderstanding", outPath);
      const text = readFileSync(outPath, "utf8");

      expect(text).toContain("Architecture Boundary Misunderstanding");
      expect(text).toContain("rel_api_worker_forbidden");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("re-renders generated Markdown after YAML changes", async () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "visualplan-watch-"));
    const inputPath = resolve(tempDir, "visualplan.yaml");
    const fixture = readFileSync(resolve(root, "examples/research_code_alignment.yaml"), "utf8");
    writeFileSync(inputPath, fixture, "utf8");

    const watcher = await watchVisualPlan(inputPath, {
      outDir: tempDir,
      debounceMs: 40,
      logger: () => undefined,
    });

    try {
      const output = watcher.lastOutput();
      expect(output).toBeDefined();
      expect(readFileSync(output!.markdownPath, "utf8")).toContain("Research Code Understanding Alignment");
      expect(readFileSync(output!.markdownPath, "utf8")).toContain("![VisualPlan diagram](./visualplan.svg)");

      writeFileSync(
        inputPath,
        fixture.replace("Research Code Understanding Alignment", "Updated Alignment Map"),
        "utf8",
      );

      await waitFor(() => {
        const markdown = readFileSync(output!.markdownPath, "utf8");
        expect(markdown).toContain("Updated Alignment Map");
      });
    } finally {
      watcher.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
