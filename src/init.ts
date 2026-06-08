import { copyFile, readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { alignmentModes, type AlignmentMode } from "./types.js";

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

const alignmentModeSet = new Set<string>(alignmentModes);

export interface ScenarioInfo {
  name: string;
  mode: AlignmentMode;
  title?: string;
}

function modeFromUnknown(value: unknown): AlignmentMode {
  return typeof value === "string" && alignmentModeSet.has(value)
    ? value as AlignmentMode
    : "custom";
}

export async function listScenarioInfos(mode?: AlignmentMode): Promise<ScenarioInfo[]> {
  const examplesDir = resolve(packageRoot(), "examples");
  const entries = await readdir(examplesDir);
  const scenarioFiles = entries
    .filter((entry) => entry.endsWith(".yaml"))
    .sort();

  const scenarios = await Promise.all(scenarioFiles.map(async (entry) => {
    const name = entry.replace(/\.yaml$/, "");
    const parsed = parse(await readFile(resolve(examplesDir, entry), "utf8")) as Record<string, unknown>;
    return {
      name,
      mode: modeFromUnknown(parsed.mode),
      title: typeof parsed.title === "string" ? parsed.title : undefined,
    };
  }));

  return mode ? scenarios.filter((scenario) => scenario.mode === mode) : scenarios;
}

export async function listScenarios(mode?: AlignmentMode): Promise<string[]> {
  return (await listScenarioInfos(mode)).map((scenario) => scenario.name);
}

export async function initScenario(scenario: string, outPath = "visualplan.yaml"): Promise<string> {
  const normalizedScenario = scenario.trim();
  if (!normalizedScenario) {
    throw new Error("scenario is required");
  }

  const source = resolve(packageRoot(), "examples", `${normalizedScenario}.yaml`);
  await copyFile(source, outPath);
  return outPath;
}
