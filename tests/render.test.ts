import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { renderMarkdown, renderSvg, renderToFiles } from "../src/render.js";
import type { VisualPlan } from "../src/types.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function loadFixture(): VisualPlan {
  return parse(readFileSync(resolve(root, "examples/research_code_alignment.yaml"), "utf8")) as VisualPlan;
}

describe("visualplan renderer", () => {
  it("preserves stable object and relation IDs in SVG", () => {
    const plan = loadFixture();
    const svg = renderSvg(plan);

    expect(svg).toContain('data-id="object:agent_model"');
    expect(svg).toContain('data-id="relation:rel_model_to_change"');
    expect(svg).toContain("Proposed Change Surface");
    expect(svg).toContain("Visual conventions");
  });

  it("renders review details and unresolved questions in Markdown", () => {
    const plan = loadFixture();
    const markdown = renderMarkdown(plan, "/tmp/visualplan.md", "/tmp/visualplan.svg");

    expect(markdown).toContain("## Uncertainties");
    expect(markdown).toContain("`unc_edge_cases`");
    expect(markdown).toContain("`rel_gap_to_scope`");
    expect(markdown).toContain("![VisualPlan diagram](./visualplan.svg)");
  });

  it("writes default output filenames", async () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "visualplan-render-"));
    try {
      const plan = loadFixture();
      const inputPath = resolve(tempDir, "visualplan.yaml");
      const output = await renderToFiles(inputPath, plan, { outDir: tempDir });

      expect(output.primaryPath).toBe(output.markdownPath);
      expect(isAbsolute(output.markdownPath)).toBe(true);
      expect(isAbsolute(output.svgPath)).toBe(true);
      expect(output.markdownPath.endsWith("visualplan.md")).toBe(true);
      expect(output.svgPath.endsWith("visualplan.svg")).toBe(true);
      expect(readFileSync(output.markdownPath, "utf8")).toContain("Research Code Understanding Alignment");
      expect(readFileSync(output.svgPath, "utf8")).toContain('data-id="object:agent_model"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
