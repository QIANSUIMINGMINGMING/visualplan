import { watch, type FSWatcher } from "node:fs";
import { loadVisualPlan } from "./load.js";
import { renderToFiles, type RenderToFilesOptions } from "./render.js";
import type { OutputPaths } from "./types.js";

export interface VisualPlanWatcher {
  close: () => void;
  lastOutput: () => OutputPaths | undefined;
}

export interface WatchOptions extends RenderToFilesOptions {
  logger?: (message: string) => void;
  debounceMs?: number;
}

async function renderOnce(inputPath: string, options: WatchOptions): Promise<OutputPaths> {
  const loaded = await loadVisualPlan(inputPath);
  if (!loaded.validation.ok) {
    const details = loaded.validation.errors
      .map((error) => `${error.path}: ${error.message}`)
      .join("\n");
    throw new Error(`VisualPlan validation failed:\n${details}`);
  }
  const output = await renderToFiles(inputPath, loaded.plan, {
    ...options,
  });
  options.logger?.(`rendered ${output.primaryPath} and ${output.svgPath}`);
  return output;
}

export async function watchVisualPlan(inputPath: string, options: WatchOptions = {}): Promise<VisualPlanWatcher> {
  let output = await renderOnce(inputPath, options);
  let timeout: NodeJS.Timeout | undefined;
  let watcher: FSWatcher | undefined;
  let closed = false;

  const schedule = (): void => {
    if (closed) {
      return;
    }
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      void renderOnce(inputPath, options)
        .then((nextOutput) => {
          output = nextOutput;
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          options.logger?.(`render skipped: ${message}`);
        });
    }, options.debounceMs ?? 120);
  };

  watcher = watch(inputPath, { persistent: true }, schedule);

  return {
    close: () => {
      closed = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      watcher?.close();
    },
    lastOutput: () => output,
  };
}
