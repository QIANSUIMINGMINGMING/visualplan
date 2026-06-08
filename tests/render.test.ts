import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { renderHtml, renderSvg, renderToFiles } from "../src/render.js";
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

  it("renders side-panel lists and unresolved questions in HTML", () => {
    const plan = loadFixture();
    const svg = renderSvg(plan);
    const html = renderHtml(plan, svg);

    expect(html).toContain("Unresolved Questions");
    expect(html).toContain("unc_edge_cases");
    expect(html).toContain("rel_gap_to_scope");
    expect(html).not.toContain("window.location.reload()");
  });

  it("writes default output filenames", async () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "visualplan-render-"));
    try {
      const plan = loadFixture();
      const inputPath = resolve(tempDir, "visualplan.yaml");
      const output = await renderToFiles(inputPath, plan, { outDir: tempDir });

      expect(output.htmlPath.endsWith("visualplan.html")).toBe(true);
      expect(output.svgPath.endsWith("visualplan.svg")).toBe(true);
      expect(readFileSync(output.htmlPath, "utf8")).toContain("Research Code Understanding Alignment");
      expect(readFileSync(output.svgPath, "utf8")).toContain('data-id="object:agent_model"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
