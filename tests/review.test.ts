import { mkdtempSync, rmSync } from "node:fs";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { prepareReview, startReviewServer } from "../src/review.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function rawStatus(localUrl: string, path: string): Promise<number> {
  const url = new URL(localUrl);
  return new Promise((resolveStatus, rejectStatus) => {
    const request = get({
      hostname: url.hostname,
      port: url.port,
      path,
    }, (response) => {
      response.resume();
      response.on("end", () => resolveStatus(response.statusCode ?? 0));
    });
    request.on("error", rejectStatus);
  });
}

describe("visualplan review server", () => {
  it("serves current review, metadata, list page, and rejects traversal", async () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), "visualplan-review-"));
    const prepared = await prepareReview(resolve(root, "examples/codex_goal_checkpoint.yaml"), {
      outDir: tempDir,
      generatedAt: new Date("2026-06-09T00:00:00.000Z"),
    });
    const server = await startReviewServer(prepared, { port: 0 });

    try {
      const htmlResponse = await fetch(server.localUrl);
      const html = await htmlResponse.text();
      expect(htmlResponse.status).toBe(200);
      expect(html).toContain("Codex Goal Alignment Checkpoint");

      const apiResponse = await fetch(`${server.localUrl}api/current`);
      const metadata = await apiResponse.json() as { mode: string; localUrl: string; objectIds: string[] };
      expect(apiResponse.status).toBe(200);
      expect(metadata.mode).toBe("goal");
      expect(metadata.localUrl).toBe(server.localUrl);
      expect(metadata.objectIds).toContain("active_goal");

      const listResponse = await fetch(`${server.localUrl}list`);
      const listHtml = await listResponse.text();
      expect(listResponse.status).toBe(200);
      expect(listHtml).toContain("VisualPlan Reviews");
      expect(listHtml).toContain("Codex Goal Alignment Checkpoint");

      await expect(rawStatus(server.localUrl, "/outputs/%2e%2e/current/visualplan.html")).resolves.toBe(400);
    } finally {
      await server.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
