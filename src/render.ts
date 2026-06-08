import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  OutputPaths,
  RenderOptions,
  VisualObject,
  VisualPlan,
  VisualRelation,
} from "./types.js";

const svgNamespace = "http://www.w3.org/2000/svg";

interface SizedObject extends VisualObject {
  width: number;
  height: number;
}

interface RenderedFiles {
  htmlPath: string;
  svgPath: string;
}

export interface RenderToFilesOptions extends RenderOptions {
  outDir?: string;
  htmlPath?: string;
  svgPath?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function objectSize(object: VisualObject): { width: number; height: number } {
  if (object.width && object.height) {
    return { width: object.width, height: object.height };
  }

  const defaults: Record<string, { width: number; height: number }> = {
    node: { width: 200, height: 112 },
    region: { width: 300, height: 190 },
    boundary: { width: 210, height: 120 },
    evidence: { width: 220, height: 126 },
    uncertainty: { width: 220, height: 126 },
  };

  return {
    width: object.width ?? defaults[object.kind].width,
    height: object.height ?? defaults[object.kind].height,
  };
}

function sizedObjects(plan: VisualPlan): SizedObject[] {
  return plan.objects.map((object) => ({
    ...object,
    ...objectSize(object),
  }));
}

function objectStyle(kind: string, focused: boolean): { fill: string; stroke: string; dash: string; strokeWidth: number } {
  const styles: Record<string, { fill: string; stroke: string; dash: string }> = {
    node: { fill: "#ffffff", stroke: "#344054", dash: "" },
    region: { fill: "#f4f6f8", stroke: "#98a2b3", dash: "8 6" },
    boundary: { fill: "#fff7ed", stroke: "#f97316", dash: "7 5" },
    evidence: { fill: "#eff8ff", stroke: "#0ea5e9", dash: "" },
    uncertainty: { fill: "#fffbeb", stroke: "#d97706", dash: "5 4" },
  };
  const style = styles[kind] ?? styles.node;
  return {
    ...style,
    strokeWidth: focused ? 3 : 1.6,
  };
}

function relationStyle(type: string, focused: boolean): { stroke: string; dash: string; marker: string; strokeWidth: number } {
  const styles: Record<string, { stroke: string; dash: string; marker: string }> = {
    flow: { stroke: "#2563eb", dash: "", marker: "arrow-blue" },
    contain: { stroke: "#667085", dash: "6 5", marker: "arrow-gray" },
    depend: { stroke: "#475467", dash: "", marker: "arrow-gray" },
    conflict: { stroke: "#dc2626", dash: "4 4", marker: "arrow-red" },
    forbid: { stroke: "#b91c1c", dash: "9 5", marker: "arrow-red" },
    map: { stroke: "#16a34a", dash: "", marker: "arrow-green" },
    feedback: { stroke: "#0f766e", dash: "6 4", marker: "arrow-teal" },
    order: { stroke: "#7c3aed", dash: "", marker: "arrow-purple" },
  };
  const style = styles[type] ?? styles.depend;
  return {
    ...style,
    strokeWidth: focused ? 3 : 2,
  };
}

function center(object: SizedObject): { x: number; y: number } {
  return {
    x: object.x + object.width / 2,
    y: object.y + object.height / 2,
  };
}

function relationPath(from: SizedObject, to: SizedObject): { d: string; labelX: number; labelY: number } {
  const source = center(from);
  const target = center(to);
  const xDirection = target.x >= source.x ? 1 : -1;
  const yDirection = target.y >= source.y ? 1 : -1;
  const x1 = source.x + (from.width / 2) * xDirection;
  const y1 = source.y;
  const x2 = target.x - (to.width / 2) * xDirection;
  const y2 = target.y;

  if (Math.abs(y2 - y1) < 12) {
    return {
      d: `M${x1},${y1} L${x2},${y2}`,
      labelX: (x1 + x2) / 2,
      labelY: y1 - 10,
    };
  }

  const midX = (x1 + x2) / 2;
  return {
    d: `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`,
    labelX: midX,
    labelY: y1 + ((y2 - y1) / 2) - 10 * yDirection,
  };
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, 4);
}

function renderObject(object: SizedObject, focusedIds: Set<string>): string {
  const focused = focusedIds.has(object.id);
  const style = objectStyle(object.kind, focused);
  const lines = wrapText(object.label, Math.max(14, Math.floor(object.width / 10)));
  const summaryLines = object.summary ? wrapText(object.summary, Math.max(18, Math.floor(object.width / 8))) : [];
  const regionClass = object.kind === "region" ? " region-object" : "";
  const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
  const textY = object.kind === "region" ? object.y + 28 : object.y + 30;
  const kindY = object.kind === "region" ? object.y + object.height - 14 : object.y + object.height - 14;

  const label = lines
    .map((line, index) => {
      const y = textY + index * 16;
      return `<text x="${object.x + 14}" y="${y}" font-size="13" font-weight="700" fill="#182230">${escapeHtml(line)}</text>`;
    })
    .join("");

  const maxSummaryLines = object.kind === "region"
    ? 2
    : Math.max(1, Math.floor((kindY - (textY + lines.length * 16) - 12) / 14));
  const summary = summaryLines
    .slice(0, maxSummaryLines)
    .map((line, index) => {
      const y = textY + lines.length * 16 + 12 + index * 14;
      return `<text x="${object.x + 14}" y="${y}" font-size="11" fill="#475467">${escapeHtml(line)}</text>`;
    })
    .join("");

  return [
    `<g class="visual-object${regionClass}" data-id="object:${escapeHtml(object.id)}" data-label="${escapeHtml(object.label)}">`,
    `<rect x="${object.x}" y="${object.y}" width="${object.width}" height="${object.height}" rx="7" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}"${dash} />`,
    label,
    summary,
    `<text x="${object.x + 14}" y="${kindY}" font-size="10" fill="#667085">${escapeHtml(object.kind)} / ${escapeHtml(object.id)}</text>`,
    "</g>",
  ].join("");
}

function renderRelation(
  relation: VisualRelation,
  objectsById: Map<string, SizedObject>,
  focusedIds: Set<string>,
): string {
  const from = objectsById.get(relation.from);
  const to = objectsById.get(relation.to);
  if (!from || !to) {
    return "";
  }

  const focused = focusedIds.has(relation.id);
  const style = relationStyle(relation.type, focused);
  const path = relationPath(from, to);
  const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
  const label = relation.label ?? relation.type;

  return [
    `<g class="visual-relation" data-id="relation:${escapeHtml(relation.id)}" data-label="${escapeHtml(label)}">`,
    `<path d="${path.d}" fill="none" stroke="${style.stroke}" stroke-width="${style.strokeWidth}"${dash} marker-end="url(#${style.marker})" />`,
    `<rect x="${path.labelX - 52}" y="${path.labelY - 16}" width="104" height="20" rx="5" fill="#fbfbfc" stroke="#d0d5dd" />`,
    `<text x="${path.labelX}" y="${path.labelY - 2}" text-anchor="middle" font-size="11" fill="${style.stroke}">${escapeHtml(label)}</text>`,
    "</g>",
  ].join("");
}

function marker(id: string, color: string): string {
  return [
    `<marker id="${id}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">`,
    `<path d="M0,0 L0,6 L9,3 z" fill="${color}" />`,
    "</marker>",
  ].join("");
}

function renderLegend(x: number, y: number): string {
  const items = [
    ["boundary", "#fff7ed", "#f97316", "dashed boundary"],
    ["uncertainty", "#fffbeb", "#d97706", "open question"],
    ["conflict", "#ffffff", "#dc2626", "conflict relation"],
    ["forbid", "#ffffff", "#b91c1c", "forbidden relation"],
    ["focus", "#ffffff", "#16a34a", "accepted focus"],
  ];

  return [
    `<g class="legend" data-id="legend">`,
    `<text x="${x}" y="${y}" font-size="13" font-weight="700" fill="#182230">Visual conventions</text>`,
    ...items.map((item, index) => {
      const itemY = y + 22 + index * 22;
      return [
        `<rect x="${x}" y="${itemY - 12}" width="18" height="14" rx="3" fill="${item[1]}" stroke="${item[2]}" stroke-width="1.5" />`,
        `<text x="${x + 28}" y="${itemY}" font-size="11" fill="#475467">${escapeHtml(item[3])}</text>`,
      ].join("");
    }),
    "</g>",
  ].join("");
}

export function renderSvg(plan: VisualPlan, options: RenderOptions = {}): string {
  const objects = sizedObjects(plan);
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  const focusedIds = new Set<string>([
    ...plan.focus.primary_path,
    ...plan.focus.key_boundaries,
    ...plan.focus.accepted,
  ]);

  const maxX = Math.max(...objects.map((object) => object.x + object.width), 820);
  const maxY = Math.max(...objects.map((object) => object.y + object.height), 560);
  const width = Math.ceil(maxX + 220);
  const height = Math.ceil(maxY + 130);
  const relationSvg = plan.relations
    .map((relation) => renderRelation(relation, objectsById, focusedIds))
    .join("");
  const regionSvg = objects
    .filter((object) => object.kind === "region")
    .map((object) => renderObject(object, focusedIds))
    .join("");
  const nonRegionSvg = objects
    .filter((object) => object.kind !== "region")
    .map((object) => renderObject(object, focusedIds))
    .join("");
  const generatedAt = options.generatedAt?.toISOString() ?? new Date(0).toISOString();

  return [
    `<svg xmlns="${svgNamespace}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="visualplan-title visualplan-desc">`,
    "<defs>",
    marker("arrow-blue", "#2563eb"),
    marker("arrow-gray", "#475467"),
    marker("arrow-red", "#b91c1c"),
    marker("arrow-green", "#16a34a"),
    marker("arrow-teal", "#0f766e"),
    marker("arrow-purple", "#7c3aed"),
    "</defs>",
    `<title id="visualplan-title">${escapeHtml(plan.title)}</title>`,
    `<desc id="visualplan-desc">${escapeHtml(plan.intent)}</desc>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#fbfbfc" />`,
    `<text x="48" y="44" font-size="22" font-weight="700" fill="#101828">${escapeHtml(plan.title)}</text>`,
    `<text x="48" y="68" font-size="12" fill="#667085">generated ${escapeHtml(generatedAt)}</text>`,
    `<g transform="translate(0,24)">`,
    regionSvg,
    relationSvg,
    nonRegionSvg,
    renderLegend(width - 210, 72),
    "</g>",
    "</svg>",
  ].join("");
}

function idBadge(id: string): string {
  return `<code>${escapeHtml(id)}</code>`;
}

function renderSource(source: VisualPlan["source"]): string {
  if (!source) {
    return "";
  }
  const rows = [
    ["agent", source.agent],
    ["surface", source.surface],
    ["prompt", source.prompt],
    ["goal", source.goal],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (rows.length === 0) {
    return "";
  }

  return rows
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
}

function renderSidePanel(plan: VisualPlan): string {
  const objectItems = plan.objects
    .map((object) => `<li>${idBadge(object.id)} <strong>${escapeHtml(object.label)}</strong><span>${escapeHtml(object.kind)}</span></li>`)
    .join("");
  const relationItems = plan.relations
    .map((relation) => {
      const label = relation.label ? ` - ${relation.label}` : "";
      return `<li>${idBadge(relation.id)} <strong>${escapeHtml(relation.from)} ${escapeHtml(relation.type)} ${escapeHtml(relation.to)}</strong><span>${escapeHtml(label)}</span></li>`;
    })
    .join("");
  const uncertaintyItems = plan.uncertainties
    .map((uncertainty) => `<li>${idBadge(uncertainty.id)} <strong>${escapeHtml(uncertainty.target)}</strong><span>${escapeHtml(uncertainty.question)}</span></li>`)
    .join("");
  const revisionItems = plan.revisions
    .map((revision) => `<li>${idBadge(revision.id)} <strong>${escapeHtml(revision.date)} ${escapeHtml(revision.source)}</strong><span>${escapeHtml(revision.note)}</span></li>`)
    .join("");

  return [
    `<aside class="side-panel">`,
    `<section><h2>Alignment</h2><p>Mode: ${idBadge(plan.mode ?? "custom")}</p>${renderSource(plan.source) ? `<dl>${renderSource(plan.source)}</dl>` : ""}</section>`,
    `<section><h2>Intent</h2><p>${escapeHtml(plan.intent)}</p></section>`,
    `<section><h2>Space</h2><dl><dt>x axis</dt><dd>${escapeHtml(plan.space.x_axis)}</dd><dt>y axis</dt><dd>${escapeHtml(plan.space.y_axis)}</dd><dt>containment</dt><dd>${escapeHtml(plan.space.containment)}</dd><dt>proximity</dt><dd>${escapeHtml(plan.space.proximity)}</dd></dl></section>`,
    `<section><h2>Focus</h2><p>Primary path: ${plan.focus.primary_path.map(idBadge).join(" ") || "none"}</p><p>Boundaries: ${plan.focus.key_boundaries.map(idBadge).join(" ") || "none"}</p><p>Unresolved: ${plan.focus.unresolved.map(idBadge).join(" ") || "none"}</p></section>`,
    `<section><h2>Objects</h2><ul>${objectItems}</ul></section>`,
    `<section><h2>Relations</h2><ul>${relationItems}</ul></section>`,
    `<section><h2>Unresolved Questions</h2><ul>${uncertaintyItems}</ul></section>`,
    `<section><h2>Revision History</h2><ul>${revisionItems}</ul></section>`,
    `</aside>`,
  ].join("");
}

function watchRefreshScript(enabled: boolean): string {
  if (!enabled) {
    return "";
  }
  return [
    "<script>",
    "setTimeout(() => { window.location.reload(); }, 1500);",
    "</script>",
  ].join("");
}

export function renderHtml(plan: VisualPlan, svg: string, options: RenderOptions = {}): string {
  return [
    "<!doctype html>",
    `<html lang="en">`,
    "<head>",
    `<meta charset="utf-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `<title>${escapeHtml(plan.title)} - VisualPlan</title>`,
    "<style>",
    `:root { color-scheme: light; --text: #101828; --muted: #667085; --border: #d0d5dd; --surface: #ffffff; --band: #f8fafc; }`,
    `* { box-sizing: border-box; }`,
    `body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--text); background: #eaecf0; }`,
    `.layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; min-height: 100vh; }`,
    `.canvas { overflow: auto; padding: 20px; background: #f2f4f7; }`,
    `.canvas svg { display: block; min-width: 900px; max-width: none; background: #fbfbfc; border: 1px solid var(--border); }`,
    `.side-panel { background: var(--surface); border-left: 1px solid var(--border); padding: 18px; overflow: auto; max-height: 100vh; }`,
    `section { border-bottom: 1px solid #eaecf0; padding: 0 0 14px; margin: 0 0 14px; }`,
    `h2 { font-size: 13px; margin: 0 0 9px; text-transform: uppercase; color: #344054; letter-spacing: 0; }`,
    `p, dd, li { font-size: 13px; line-height: 1.45; color: #344054; }`,
    `dl { margin: 0; } dt { margin-top: 8px; font-size: 11px; color: var(--muted); text-transform: uppercase; } dd { margin: 2px 0 0; }`,
    `ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; } li { display: grid; gap: 2px; } li span { color: var(--muted); }`,
    `code { display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: #175cd3; background: #eff8ff; border: 1px solid #b2ddff; border-radius: 4px; padding: 1px 5px; }`,
    `@media (max-width: 980px) { .layout { grid-template-columns: 1fr; } .side-panel { max-height: none; border-left: 0; border-top: 1px solid var(--border); } }`,
    "</style>",
    "</head>",
    "<body>",
    `<main class="layout">`,
    `<section class="canvas" aria-label="VisualPlan canvas">${svg}</section>`,
    renderSidePanel(plan),
    "</main>",
    watchRefreshScript(Boolean(options.watchMode)),
    "</body>",
    "</html>",
  ].join("");
}

export function outputPathsFor(inputPath: string, options: RenderToFilesOptions = {}): OutputPaths {
  const baseDir = options.outDir ?? dirname(inputPath);
  return {
    htmlPath: options.htmlPath ?? join(baseDir, "visualplan.html"),
    svgPath: options.svgPath ?? join(baseDir, "visualplan.svg"),
  };
}

export async function renderToFiles(
  inputPath: string,
  plan: VisualPlan,
  options: RenderToFilesOptions = {},
): Promise<RenderedFiles> {
  const paths = outputPathsFor(inputPath, options);
  await mkdir(dirname(paths.htmlPath), { recursive: true });
  await mkdir(dirname(paths.svgPath), { recursive: true });
  const svg = renderSvg(plan, options);
  const html = renderHtml(plan, svg, options);
  await writeFile(paths.svgPath, svg, "utf8");
  await writeFile(paths.htmlPath, html, "utf8");
  return paths;
}
