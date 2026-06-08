import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("npm package surface", () => {
  it("declares open-source metadata and package files", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

    expect(pkg.license).toBe("MIT");
    expect(pkg.engines.node).toBe(">=20");
    expect(pkg.files).toContain("dist");
    expect(pkg.files).toContain("schema");
    expect(pkg.files).toContain("examples");
    expect(pkg.files).toContain("docs");
    expect(pkg.files).toContain(".agents/skills");
  });

  it("dry-runs npm pack without private outputs", () => {
    const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    const packed = JSON.parse(result.stdout)[0] as { files: Array<{ path: string }> };
    const paths = packed.files.map((file) => file.path);

    expect(paths).toContain("dist/cli.js");
    expect(paths).toContain("dist/review.js");
    expect(paths).toContain("schema/visualplan.schema.json");
    expect(paths).toContain("examples/codex_goal_checkpoint.yaml");
    expect(paths).toContain(".agents/skills/visualplan-alignment/SKILL.md");
    expect(paths.some((path) => path.startsWith("output/"))).toBe(false);
    expect(paths.some((path) => path.startsWith(".visualplan/"))).toBe(false);
    expect(paths.some((path) => path.startsWith("tools/"))).toBe(false);
  });
});
