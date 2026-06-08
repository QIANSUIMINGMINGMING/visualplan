import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { loadVisualPlan } from "./load.js";
import { renderToFiles } from "./render.js";
import type { AlignmentMode, ValidationIssue, VisualPlan } from "./types.js";

export interface ReviewMetadata {
  ok: true;
  command: "review";
  mode: AlignmentMode;
  inputPath: string;
  htmlPath: string;
  svgPath: string | null;
  localUrl: string | null;
  objectIds: string[];
  relationIds: string[];
  uncertaintyIds: string[];
  warnings: ValidationIssue[];
  title: string;
  updatedAt: string;
  outputDir: string;
  reviewId: string;
}

export interface ReviewEntry {
  id: string;
  title: string;
  mode: AlignmentMode;
  updatedAt: string;
  htmlPath: string;
  svgPath: string | null;
  url: string;
}

export interface PreparedReview {
  currentDir: string;
  outDir: string;
  metadata: ReviewMetadata;
}

export interface ReviewOptions {
  outDir?: string;
  generatedAt?: Date;
}

export interface ReviewServerOptions {
  host?: string;
  port?: number;
}

export interface ReviewServerHandle {
  server: Server;
  localUrl: string;
  close: () => Promise<void>;
}

export class ReviewInputError extends Error {
  issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "ReviewInputError";
    this.issues = issues;
  }
}

function modeFor(plan: VisualPlan): AlignmentMode {
  return plan.mode ?? "custom";
}

function planIds(plan: VisualPlan): Pick<ReviewMetadata, "objectIds" | "relationIds" | "uncertaintyIds"> {
  return {
    objectIds: plan.objects.map((object) => object.id),
    relationIds: plan.relations.map((relation) => relation.id),
    uncertaintyIds: plan.uncertainties.map((uncertainty) => uncertainty.id),
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function timestampId(date: Date): string {
  return date.toISOString()
    .replace(/\.\d{3}Z$/, "z")
    .replaceAll("-", "")
    .replaceAll(":", "")
    .toLowerCase();
}

function slug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "review";
}

async function safeCopy(source: string, target: string): Promise<void> {
  if (resolve(source) === resolve(target)) {
    return;
  }
  await copyFile(source, target);
}

function extractTitle(html: string): string {
  const match = html.match(/<title>(.*?)<\/title>/is);
  if (!match) {
    return "VisualPlan Review";
  }
  return match[1]
    .replace(/ - VisualPlan$/i, "")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim() || "VisualPlan Review";
}

function extractRenderedIds(html: string): Pick<ReviewMetadata, "objectIds" | "relationIds" | "uncertaintyIds"> {
  const collect = (pattern: RegExp): string[] => {
    const ids = new Set<string>();
    for (const match of html.matchAll(pattern)) {
      ids.add(match[1]);
    }
    return [...ids].sort();
  };

  return {
    objectIds: collect(/data-id="object:([^"]+)"/g),
    relationIds: collect(/data-id="relation:([^"]+)"/g),
    uncertaintyIds: collect(/<code>(unc_[a-z0-9_-]+)<\/code>/g),
  };
}

async function stageExistingReview(sourcePath: string, currentDir: string): Promise<{
  htmlPath: string;
  svgPath: string | null;
  title: string;
  ids: Pick<ReviewMetadata, "objectIds" | "relationIds" | "uncertaintyIds">;
}> {
  const sourceStat = await stat(sourcePath);
  const htmlSource = sourceStat.isDirectory()
    ? join(sourcePath, "visualplan.html")
    : sourcePath;
  const svgCandidate = sourceStat.isDirectory()
    ? join(sourcePath, "visualplan.svg")
    : join(dirname(sourcePath), `${basename(sourcePath, extname(sourcePath))}.svg`);

  if (extname(htmlSource).toLowerCase() !== ".html" || !(await exists(htmlSource))) {
    throw new ReviewInputError(`expected a VisualPlan HTML file or output directory: ${sourcePath}`, [
      { path: "$", message: "expected a VisualPlan HTML file or output directory" },
    ]);
  }

  await mkdir(currentDir, { recursive: true });
  const htmlPath = join(currentDir, "visualplan.html");
  const svgPath = join(currentDir, "visualplan.svg");
  await safeCopy(htmlSource, htmlPath);

  const hasSvg = await exists(svgCandidate);
  if (hasSvg) {
    await safeCopy(svgCandidate, svgPath);
  }

  const html = await readFile(htmlPath, "utf8");
  return {
    htmlPath,
    svgPath: hasSvg ? svgPath : null,
    title: extractTitle(html),
    ids: extractRenderedIds(html),
  };
}

async function writeMetadata(dir: string, metadata: ReviewMetadata): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "review.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

async function readCurrentMetadata(prepared: PreparedReview): Promise<ReviewMetadata> {
  try {
    return JSON.parse(await readFile(join(prepared.currentDir, "review.json"), "utf8")) as ReviewMetadata;
  } catch {
    return prepared.metadata;
  }
}

export async function setReviewLocalUrl(prepared: PreparedReview, localUrl: string): Promise<void> {
  prepared.metadata.localUrl = localUrl;
  await writeMetadata(prepared.currentDir, prepared.metadata);
}

async function snapshotReview(prepared: PreparedReview): Promise<void> {
  const historyDir = join(prepared.outDir, "history", prepared.metadata.reviewId);
  await mkdir(historyDir, { recursive: true });
  const htmlPath = join(historyDir, "visualplan.html");
  const svgPath = prepared.metadata.svgPath ? join(historyDir, "visualplan.svg") : null;
  await safeCopy(prepared.metadata.htmlPath, htmlPath);
  if (prepared.metadata.svgPath && svgPath) {
    await safeCopy(prepared.metadata.svgPath, svgPath);
  }
  await writeMetadata(historyDir, {
    ...prepared.metadata,
    htmlPath,
    svgPath,
  });
}

export async function prepareReview(source: string, options: ReviewOptions = {}): Promise<PreparedReview> {
  const sourcePath = resolve(source);
  if (!(await exists(sourcePath))) {
    throw new ReviewInputError(`source not found: ${sourcePath}`, [
      { path: "$", message: `source not found: ${sourcePath}` },
    ]);
  }

  const generatedAt = options.generatedAt ?? new Date();
  const outDir = resolve(options.outDir ?? ".visualplan/review");
  const currentDir = join(outDir, "current");
  const extension = extname(sourcePath).toLowerCase();
  const reviewId = `${timestampId(generatedAt)}-${slug(basename(sourcePath, extension) || "review")}`;
  let htmlPath: string;
  let svgPath: string | null;
  let title: string;
  let mode: AlignmentMode = "custom";
  let warnings: ValidationIssue[] = [];
  let ids: Pick<ReviewMetadata, "objectIds" | "relationIds" | "uncertaintyIds"> = {
    objectIds: [],
    relationIds: [],
    uncertaintyIds: [],
  };

  if (extension === ".yaml" || extension === ".yml") {
    const loaded = await loadVisualPlan(sourcePath);
    if (!loaded.validation.ok) {
      throw new ReviewInputError("VisualPlan validation failed", loaded.validation.errors);
    }
    const output = await renderToFiles(sourcePath, loaded.plan, {
      outDir: currentDir,
      generatedAt,
    });
    htmlPath = output.htmlPath;
    svgPath = output.svgPath;
    title = loaded.plan.title;
    mode = modeFor(loaded.plan);
    warnings = loaded.validation.warnings;
    ids = planIds(loaded.plan);
  } else {
    const staged = await stageExistingReview(sourcePath, currentDir);
    htmlPath = staged.htmlPath;
    svgPath = staged.svgPath;
    title = staged.title;
    ids = staged.ids;
  }

  const metadata: ReviewMetadata = {
    ok: true,
    command: "review",
    mode,
    inputPath: sourcePath,
    htmlPath,
    svgPath,
    localUrl: null,
    ...ids,
    warnings,
    title,
    updatedAt: generatedAt.toISOString(),
    outputDir: outDir,
    reviewId,
  };
  const prepared = { currentDir, outDir, metadata };
  await writeMetadata(currentDir, metadata);
  await snapshotReview(prepared);
  return prepared;
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function readReviewEntry(id: string, dir: string, url: string): Promise<ReviewEntry | undefined> {
  try {
    const parsed = JSON.parse(await readFile(join(dir, "review.json"), "utf8")) as ReviewMetadata;
    return {
      id,
      title: parsed.title,
      mode: parsed.mode,
      updatedAt: parsed.updatedAt,
      htmlPath: parsed.htmlPath,
      svgPath: parsed.svgPath,
      url,
    };
  } catch {
    return undefined;
  }
}

export async function listReviewEntries(outDir: string): Promise<ReviewEntry[]> {
  const entries: ReviewEntry[] = [];
  const current = await readReviewEntry("current", join(outDir, "current"), "/");
  if (current) {
    entries.push(current);
  }

  const historyRoot = join(outDir, "history");
  if (await exists(historyRoot)) {
    const names = await readdir(historyRoot);
    const historyEntries = await Promise.all(names.sort().reverse().map(async (name) => (
      readReviewEntry(name, join(historyRoot, name), `/outputs/${encodeURIComponent(name)}/visualplan.html`)
    )));
    entries.push(...historyEntries.filter((entry): entry is ReviewEntry => Boolean(entry)));
  }

  return entries;
}

function renderListPage(entries: ReviewEntry[]): string {
  const items = entries.map((entry) => [
    "<li>",
    `<a href="${htmlEscape(entry.url)}">${htmlEscape(entry.title)}</a>`,
    `<span>${htmlEscape(entry.mode)} / ${htmlEscape(entry.updatedAt)} / ${htmlEscape(entry.id)}</span>`,
    "</li>",
  ].join(""));

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<title>VisualPlan Reviews</title>",
    "<style>",
    "body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; color: #101828; background: #f8fafc; }",
    "main { max-width: 920px; margin: 0 auto; padding: 32px 20px; }",
    "h1 { font-size: 24px; margin: 0 0 20px; }",
    "ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }",
    "li { display: grid; gap: 4px; padding: 12px; background: #fff; border: 1px solid #d0d5dd; border-radius: 7px; }",
    "a { color: #175cd3; font-weight: 700; text-decoration: none; }",
    "span { color: #667085; font-size: 12px; }",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    "<h1>VisualPlan Reviews</h1>",
    `<ul>${items.join("")}</ul>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

function send(response: ServerResponse, status: number, body: string, contentType: string, method = "GET"): void {
  response.writeHead(status, {
    "content-type": contentType,
    "x-content-type-options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : body);
}

async function sendFile(response: ServerResponse, path: string, contentType: string, method?: string): Promise<void> {
  try {
    send(response, 200, await readFile(path, "utf8"), contentType, method);
  } catch {
    send(response, 404, "not found\n", "text/plain; charset=utf-8", method);
  }
}

function routeOutputPath(prepared: PreparedReview, parts: string[]): string | undefined {
  if (parts.length !== 3 || parts[0] !== "outputs") {
    return undefined;
  }
  const [, id, file] = parts;
  if (!/^[a-z0-9._-]+$/i.test(id) || !["visualplan.html", "visualplan.svg"].includes(file)) {
    return undefined;
  }
  const dir = id === "current"
    ? prepared.currentDir
    : join(prepared.outDir, "history", id);
  return join(dir, file);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  prepared: PreparedReview,
): Promise<void> {
  const method = request.method ?? "GET";
  if (!["GET", "HEAD"].includes(method)) {
    send(response, 405, "method not allowed\n", "text/plain; charset=utf-8", method);
    return;
  }

  const rawUrl = request.url ?? "/";
  if (rawUrl.includes("..") || /%2e/i.test(rawUrl) || /%5c/i.test(rawUrl)) {
    send(response, 400, "bad request\n", "text/plain; charset=utf-8", method);
    return;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, "http://visualplan.local").pathname);
  } catch {
    send(response, 400, "bad request\n", "text/plain; charset=utf-8", method);
    return;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (pathname.includes("\0") || pathname.includes("\\") || parts.includes("..")) {
    send(response, 400, "bad request\n", "text/plain; charset=utf-8", method);
    return;
  }

  if (pathname === "/" || pathname === "/visualplan.html") {
    await sendFile(response, prepared.metadata.htmlPath, "text/html; charset=utf-8", method);
    return;
  }
  if (pathname === "/visualplan.svg" && prepared.metadata.svgPath) {
    await sendFile(response, prepared.metadata.svgPath, "image/svg+xml; charset=utf-8", method);
    return;
  }
  if (pathname === "/api/current") {
    send(response, 200, `${JSON.stringify(await readCurrentMetadata(prepared), null, 2)}\n`, "application/json; charset=utf-8", method);
    return;
  }
  if (pathname === "/list") {
    send(response, 200, renderListPage(await listReviewEntries(prepared.outDir)), "text/html; charset=utf-8", method);
    return;
  }

  const outputPath = routeOutputPath(prepared, parts);
  if (outputPath) {
    await sendFile(
      response,
      outputPath,
      outputPath.endsWith(".svg") ? "image/svg+xml; charset=utf-8" : "text/html; charset=utf-8",
      method,
    );
    return;
  }

  send(response, 404, "not found\n", "text/plain; charset=utf-8", method);
}

function displayHost(host: string): string {
  return host === "0.0.0.0" ? "127.0.0.1" : host;
}

export async function startReviewServer(
  prepared: PreparedReview,
  options: ReviewServerOptions = {},
): Promise<ReviewServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8502;
  const server = createServer((request, response) => {
    void handleRequest(request, response, prepared).catch(() => {
      if (!response.headersSent) {
        send(response, 500, "internal server error\n", "text/plain; charset=utf-8", request.method);
      } else {
        response.end();
      }
    });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address() as AddressInfo;
  const localUrl = `http://${displayHost(host)}:${address.port}/`;
  await setReviewLocalUrl(prepared, localUrl);

  return {
    server,
    localUrl,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) {
          rejectClose(error);
        } else {
          resolveClose();
        }
      });
    }),
  };
}
