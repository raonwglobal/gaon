import { describe, it, expect } from "vitest";
import { listPluginDirs, resolvePluginsDir } from "./discover.js";
import { existsSync } from "node:fs";

describe("plugin discovery", () => {
  it("resolves a plugins directory",
    () => {
      const dir = resolvePluginsDir();
      expect(typeof dir).toBe("string");
    }
  );

  it("lists non-template plugin dirs when present", () => {
    const dir = resolvePluginsDir();
    if (!existsSync(dir)) {
      expect(listPluginDirs(dir)).toEqual([]);
      return;
    }
    const found = listPluginDirs(dir);
    for (const p of found) {
      expect(p.id.startsWith("_")).toBe(false);
      expect(p.path.length).toBeGreaterThan(0);
    }
  });
});
