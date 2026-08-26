/**
 * Worker-thread entry for sandboxed plugin tool calls.
 * Parent sends: { type:'init', pluginPath, config } then { type:'call', name, arguments }
 */
import { parentPort, workerData } from "node:worker_threads";
import { pathToFileURL } from "node:url";

async function loadPlugin(pluginPath: string, config: Record<string, unknown>) {
  const mod = (await import(pathToFileURL(pluginPath).href)) as Record<string, unknown>;
  const Candidate =
    (mod.default as new () => {
      initialize: (c: Record<string, unknown>) => Promise<void>;
      callTool: (ctx: {
        name: string;
        arguments: Record<string, unknown>;
      }) => Promise<unknown>;
      shutdown: () => Promise<void>;
    }) ||
    (Object.values(mod).find(
      (v) => typeof v === "function" && /Plugin$/.test((v as { name?: string }).name || "")
    ) as new () => {
      initialize: (c: Record<string, unknown>) => Promise<void>;
      callTool: (ctx: {
        name: string;
        arguments: Record<string, unknown>;
      }) => Promise<unknown>;
      shutdown: () => Promise<void>;
    });

  if (!Candidate) throw new Error(`No plugin class in ${pluginPath}`);
  const plugin = new Candidate();
  await plugin.initialize(config ?? {});
  return plugin;
}

let plugin: Awaited<ReturnType<typeof loadPlugin>> | null = null;

parentPort?.on("message", async (msg: {
  type: string;
  pluginPath?: string;
  config?: Record<string, unknown>;
  name?: string;
  arguments?: Record<string, unknown>;
  id?: string;
}) => {
  try {
    if (msg.type === "init") {
      plugin = await loadPlugin(msg.pluginPath!, msg.config ?? {});
      parentPort?.postMessage({ type: "ready", id: msg.id });
      return;
    }
    if (msg.type === "call") {
      if (!plugin) throw new Error("Plugin not initialized");
      const result = await plugin.callTool({
        name: msg.name!,
        arguments: msg.arguments ?? {},
      });
      parentPort?.postMessage({ type: "result", id: msg.id, result });
      return;
    }
    if (msg.type === "shutdown") {
      await plugin?.shutdown();
      parentPort?.postMessage({ type: "bye", id: msg.id });
      return;
    }
  } catch (err) {
    parentPort?.postMessage({
      type: "error",
      id: msg.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// optional preload from workerData
if (workerData?.pluginPath) {
  loadPlugin(workerData.pluginPath, workerData.config ?? {})
    .then((p) => {
      plugin = p;
      parentPort?.postMessage({ type: "ready" });
    })
    .catch((err) => {
      parentPort?.postMessage({
        type: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
