import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
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

export interface RenderToFilesOptions extends RenderOptions {
  outDir?: string;
  markdownPath?: string;
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

function escapeMarkdown(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("<", "\\<")
    .replaceAll(">", "\\>")
    .replaceAll("|", "\\|");
}

function bullet(value: string): string {
  return value ? escapeMarkdown(value) : "none";
}

function listIds(ids: string[]): string {
  return ids.length > 0 ? ids.map((id) => `\`${id}\``).join(", ") : "none";
}

function markdownLinkPath(fromMarkdownPath: string, toPath: string): string {
  const relativePath = relative(dirname(fromMarkdownPath), toPath).replaceAll("\\", "/");
  const normalized = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  return encodeURI(normalized);
}

function renderMarkdownSource(source: VisualPlan["source"]): string[] {
  if (!source) {
    return [];
  }
  const rows = [
    ["agent", source.agent],
    ["surface", source.surface],
    ["prompt", source.prompt],
    ["goal", source.goal],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (rows.length === 0) {
    return [];
  }

  return rows
    .map(([key, value]) => `- ${key}: ${bullet(value)}`);
}

export function renderMarkdown(
  plan: VisualPlan,
  markdownPath: string,
  svgPath: string,
  options: RenderOptions = {},
): string {
  const svgLink = markdownLinkPath(markdownPath, svgPath);
  const sourceLines = renderMarkdownSource(plan.source);
  const generatedAt = options.generatedAt?.toISOString() ?? new Date(0).toISOString();

  return [
    `# ${escapeMarkdown(plan.title)}`,
    "",
    `![VisualPlan diagram](${svgLink})`,
    "",
    `[Open SVG](${svgLink})`,
    "",
    "## Alignment",
    "",
    `- Mode: \`${plan.mode ?? "custom"}\``,
    ...sourceLines,
    "",
    "## Intent",
    "",
    bullet(plan.intent),
    "",
    "## Space",
    "",
    `- X axis: ${bullet(plan.space.x_axis)}`,
    `- Y axis: ${bullet(plan.space.y_axis)}`,
    `- Containment: ${bullet(plan.space.containment)}`,
    `- Proximity: ${bullet(plan.space.proximity)}`,
    "",
    "## Focus",
    "",
    `- Primary path: ${listIds(plan.focus.primary_path)}`,
    `- Key boundaries: ${listIds(plan.focus.key_boundaries)}`,
    `- Unresolved: ${listIds(plan.focus.unresolved)}`,
    `- Accepted: ${listIds(plan.focus.accepted)}`,
    "",
    "## Objects",
    "",
    ...plan.objects.map((object) => [
      `### \`${object.id}\` ${escapeMarkdown(object.label)}`,
      "",
      `- Kind: \`${object.kind}\``,
      `- Summary: ${bullet(object.summary ?? "")}`,
      `- Position: x=${object.x}, y=${object.y}`,
      "",
    ].join("\n")),
    "## Relations",
    "",
    ...plan.relations.map((relation) => [
      `### \`${relation.id}\``,
      "",
      `- Type: \`${relation.type}\``,
      `- From: \`${relation.from}\``,
      `- To: \`${relation.to}\``,
      `- Label: ${bullet(relation.label ?? "")}`,
      `- Summary: ${bullet(relation.summary ?? "")}`,
      `- Evidence: ${bullet(relation.evidence ?? "")}`,
      "",
    ].join("\n")),
    "## Uncertainties",
    "",
    ...plan.uncertainties.map((uncertainty) => [
      `### \`${uncertainty.id}\``,
      "",
      `- Target: \`${uncertainty.target}\``,
      `- Question: ${bullet(uncertainty.question)}`,
      `- Impact: ${bullet(uncertainty.impact ?? "")}`,
      `- Status: \`${uncertainty.status ?? "open"}\``,
      "",
    ].join("\n")),
    "## Revisions",
    "",
    ...plan.revisions.map((revision) => [
      `### \`${revision.id}\``,
      "",
      `- Date: ${bullet(revision.date)}`,
      `- Source: ${bullet(revision.source)}`,
      `- Note: ${bullet(revision.note)}`,
      `- Changed objects: ${listIds(revision.changed_objects)}`,
      `- Changed relations: ${listIds(revision.changed_relations)}`,
      "",
    ].join("\n")),
    "<!--",
    `Generated by VisualPlan at ${generatedAt}.`,
    "Correct the alignment by referring to object, relation, and uncertainty IDs.",
    "-->",
    "",
  ].join("\n");
}

export function outputPathsFor(inputPath: string, options: RenderToFilesOptions = {}): OutputPaths {
  const baseDir = resolve(options.outDir ?? dirname(resolve(inputPath)));
  const markdownPath = resolve(options.markdownPath ?? join(baseDir, "visualplan.md"));
  const svgPath = resolve(options.svgPath ?? join(baseDir, "visualplan.svg"));
  return {
    primaryPath: markdownPath,
    markdownPath,
    svgPath,
  };
}

export async function renderToFiles(
  inputPath: string,
  plan: VisualPlan,
  options: RenderToFilesOptions = {},
): Promise<OutputPaths> {
  const paths = outputPathsFor(inputPath, options);
  await mkdir(dirname(paths.markdownPath), { recursive: true });
  await mkdir(dirname(paths.svgPath), { recursive: true });
  const svg = renderSvg(plan, options);
  const markdown = renderMarkdown(plan, paths.markdownPath, paths.svgPath, options);
  await writeFile(paths.svgPath, svg, "utf8");
  await writeFile(paths.markdownPath, markdown, "utf8");
  return paths;
}
