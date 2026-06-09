#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { loadVisualPlan } from "./load.js";
import { renderToFiles } from "./render.js";
import { initScenario, listScenarioInfos } from "./init.js";
import { watchVisualPlan } from "./watch.js";
import {
  alignmentModes,
  type AlignmentMode,
  type OutputPaths,
  type ValidationIssue,
  type VisualPlan,
} from "./types.js";

interface ParsedOptions {
  values: Record<string, string | boolean>;
  positionals: string[];
}

interface CliIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

interface JsonSuccess {
  ok: true;
  command: string;
  mode: AlignmentMode;
  inputPath: string | null;
  primaryPath: string | null;
  markdownPath: string | null;
  svgPath: string | null;
  objectIds: string[];
  relationIds: string[];
  uncertaintyIds: string[];
  warnings: ValidationIssue[];
  scenarios?: Array<{ name: string; mode: AlignmentMode; title?: string }>;
}

interface JsonFailure {
  ok: false;
  command: string;
  errors: ValidationIssue[];
  exitCode: number;
}

class CommandError extends Error {
  issues: ValidationIssue[];
  exitCode: number;

  constructor(message: string, issues: ValidationIssue[], exitCode = 1) {
    super(message);
    this.name = "CommandError";
    this.issues = issues;
    this.exitCode = exitCode;
  }
}

const alignmentModeSet = new Set<string>(alignmentModes);

function parseOptions(args: string[]): ParsedOptions {
  const values: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const equalsIndex = arg.indexOf("=");
    if (equalsIndex > 2) {
      values[arg.slice(2, equalsIndex)] = arg.slice(equalsIndex + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else {
      values[key] = true;
    }
  }
  return { values, positionals };
}

function usage(): string {
  return [
    "VisualPlan",
    "",
    "Commands:",
    "  visualplan init --scenario <name> [--out <file>]",
    "  visualplan scenarios [--mode <mode>] [--json]",
    "  visualplan validate <file> [--json]",
    "  visualplan render <file> [--out-dir <dir>] [--md <file>] [--svg <file>] [--json]",
    "  visualplan watch <file> [--out-dir <dir>] [--md <file>] [--svg <file>] [--json]",
  ].join("\n");
}

function optionString(options: ParsedOptions, key: string): string | undefined {
  const value = options.values[key];
  return typeof value === "string" ? value : undefined;
}

function optionMode(options: ParsedOptions, key: string): AlignmentMode | undefined {
  const value = optionString(options, key);
  if (value === undefined) {
    return undefined;
  }
  if (!alignmentModeSet.has(value)) {
    throw new CommandError(`invalid --${key}: ${value}`, [
      { path: `--${key}`, message: `must be one of ${alignmentModes.join(", ")}` },
    ]);
  }
  return value as AlignmentMode;
}

function wantsJson(args: string[]): boolean {
  return args.includes("--json");
}

function modeFor(plan: VisualPlan): AlignmentMode {
  return plan.mode ?? "custom";
}

function idsFor(plan: VisualPlan): Pick<JsonSuccess, "objectIds" | "relationIds" | "uncertaintyIds"> {
  return {
    objectIds: plan.objects.map((object) => object.id),
    relationIds: plan.relations.map((relation) => relation.id),
    uncertaintyIds: plan.uncertainties.map((uncertainty) => uncertainty.id),
  };
}

function successBase(command: string, mode: AlignmentMode): JsonSuccess {
  return {
    ok: true,
    command,
    mode,
    inputPath: null,
    primaryPath: null,
    markdownPath: null,
    svgPath: null,
    objectIds: [],
    relationIds: [],
    uncertaintyIds: [],
    warnings: [],
  };
}

function writeJson(io: CliIo, value: JsonSuccess | JsonFailure): void {
  io.stdout(`${JSON.stringify(value, null, 2)}\n`);
}

function validationDetails(errors: ValidationIssue[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join("\n");
}

function throwValidation(errors: ValidationIssue[]): never {
  throw new CommandError(`VisualPlan validation failed:\n${validationDetails(errors)}`, errors);
}

async function loadValidPlan(filePath: string): Promise<{
  plan: VisualPlan;
  warnings: ValidationIssue[];
}> {
  const loaded = await loadVisualPlan(filePath);
  if (!loaded.validation.ok) {
    throwValidation(loaded.validation.errors);
  }
  return {
    plan: loaded.plan,
    warnings: loaded.validation.warnings,
  };
}

function rejectOptions(options: ParsedOptions, keys: string[], message: string): void {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(options.values, key)) {
      throw new CommandError(`unsupported --${key}`, [
        { path: `--${key}`, message },
      ]);
    }
  }
}

async function renderCommand(args: string[], io: CliIo, json: boolean): Promise<void> {
  const options = parseOptions(args);
  rejectOptions(options, ["html"], "HTML output has been removed; use --md for the Markdown review file");
  const filePath = options.positionals[0];
  if (!filePath) {
    throw new CommandError(`missing file\n\n${usage()}`, [
      { path: "$.inputPath", message: "missing file" },
    ]);
  }

  const loaded = await loadValidPlan(filePath);
  loaded.warnings.forEach((warning) => {
    if (!json) {
      io.stderr(`warning ${warning.path}: ${warning.message}\n`);
    }
  });

  const output = await renderToFiles(filePath, loaded.plan, {
    outDir: optionString(options, "out-dir"),
    markdownPath: optionString(options, "md"),
    svgPath: optionString(options, "svg"),
    generatedAt: new Date(),
  });

  if (json) {
    writeJson(io, {
      ...successBase("render", modeFor(loaded.plan)),
      inputPath: resolve(filePath),
      primaryPath: output.primaryPath,
      markdownPath: output.markdownPath,
      svgPath: output.svgPath,
      ...idsFor(loaded.plan),
      warnings: loaded.warnings,
    });
    return;
  }

  io.stdout(`${output.primaryPath}\n`);
  io.stdout(`wrote ${output.svgPath}\n`);
}

async function validateCommand(args: string[], io: CliIo, json: boolean): Promise<void> {
  const options = parseOptions(args);
  const filePath = options.positionals[0];
  if (!filePath) {
    throw new CommandError(`missing file\n\n${usage()}`, [
      { path: "$.inputPath", message: "missing file" },
    ]);
  }

  const loaded = await loadVisualPlan(filePath);
  if (!loaded.validation.ok) {
    throwValidation(loaded.validation.errors);
  }

  if (json) {
    writeJson(io, {
      ...successBase("validate", modeFor(loaded.plan)),
      inputPath: resolve(filePath),
      ...idsFor(loaded.plan),
      warnings: loaded.validation.warnings,
    });
    return;
  }

  io.stdout(`valid ${filePath}\n`);
  loaded.validation.warnings.forEach((warning) => {
    io.stderr(`warning ${warning.path}: ${warning.message}\n`);
  });
}

async function watchCommand(args: string[], io: CliIo, json: boolean): Promise<void> {
  const options = parseOptions(args);
  rejectOptions(options, ["html"], "HTML output has been removed; use --md for the Markdown review file");
  rejectOptions(options, ["port", "host"], "watch no longer starts a local browser review server");
  const filePath = options.positionals[0];
  if (!filePath) {
    throw new CommandError(`missing file\n\n${usage()}`, [
      { path: "$.inputPath", message: "missing file" },
    ]);
  }

  const loaded = await loadValidPlan(filePath);
  const watcher = await watchVisualPlan(filePath, {
    outDir: optionString(options, "out-dir"),
    markdownPath: optionString(options, "md"),
    svgPath: optionString(options, "svg"),
    generatedAt: new Date(),
    logger: (message) => {
      if (!json) {
        io.stdout(`${message}\n`);
      }
    },
  });
  const output = watcher.lastOutput() as OutputPaths;

  if (json) {
    writeJson(io, {
      ...successBase("watch", modeFor(loaded.plan)),
      inputPath: resolve(filePath),
      primaryPath: output.primaryPath,
      markdownPath: output.markdownPath,
      svgPath: output.svgPath,
      ...idsFor(loaded.plan),
      warnings: loaded.warnings,
    });
  } else {
    io.stdout("watching for changes\n");
  }

  const close = (): void => {
    watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

async function initCommand(args: string[], io: CliIo, json: boolean): Promise<void> {
  const options = parseOptions(args);
  if (options.values.list === true) {
    await scenariosCommand(args, io, json);
    return;
  }

  const scenario = optionString(options, "scenario");
  if (!scenario) {
    throw new CommandError(`missing --scenario\n\n${usage()}`, [
      { path: "--scenario", message: "missing scenario" },
    ]);
  }
  const outPath = optionString(options, "out") ?? "visualplan.yaml";
  const written = await initScenario(scenario, outPath);

  if (json) {
    writeJson(io, {
      ...successBase("init", "custom"),
      inputPath: resolve(written),
    });
    return;
  }

  io.stdout(`wrote ${written}\n`);
}

async function scenariosCommand(args: string[], io: CliIo, json: boolean): Promise<void> {
  const options = parseOptions(args);
  const mode = optionMode(options, "mode");
  const scenarios = await listScenarioInfos(mode);

  if (json) {
    writeJson(io, {
      ...successBase("scenarios", mode ?? "custom"),
      scenarios,
    });
    return;
  }

  io.stdout(`${scenarios.map((scenario) => scenario.name).join("\n")}\n`);
}

function failureFor(command: string, error: unknown): JsonFailure {
  if (error instanceof CommandError) {
    return {
      ok: false,
      command,
      errors: error.issues,
      exitCode: error.exitCode,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    command,
    errors: [{ path: "$", message }],
    exitCode: 1,
  };
}

export async function runCli(argv = process.argv.slice(2), io: CliIo = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
}): Promise<number> {
  const [command, ...args] = argv;
  const json = wantsJson(argv);
  const commandName = command ?? "help";

  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      io.stdout(`${usage()}\n`);
      return 0;
    }

    if (command === "render") {
      await renderCommand(args, io, json);
      return 0;
    }
    if (command === "validate") {
      await validateCommand(args, io, json);
      return 0;
    }
    if (command === "watch") {
      await watchCommand(args, io, json);
      return 0;
    }
    if (command === "init") {
      await initCommand(args, io, json);
      return 0;
    }
    if (command === "scenarios") {
      await scenariosCommand(args, io, json);
      return 0;
    }
    throw new CommandError(`unknown command '${command}'\n\n${usage()}`, [
      { path: "$.command", message: `unknown command '${command}'` },
    ]);
  } catch (error) {
    const failure = failureFor(commandName, error);
    if (json) {
      writeJson(io, failure);
    } else {
      io.stderr(`${failure.errors.map((issue) => issue.message).join("\n")}\n`);
    }
    return failure.exitCode;
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const exitCode = await runCli(argv);
  process.exitCode = exitCode;
}

function realPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

const directRunPath = process.argv[1] ? realPath(process.argv[1]) : "";
if (directRunPath === realPath(fileURLToPath(import.meta.url))) {
  void main();
}
