import { describe, it, expect, beforeEach } from "vitest";
import { runtimeCatalog } from "./catalog.js";

describe("RuntimeCatalog", () => {
  beforeEach(() => {
    runtimeCatalog.replaceAll([]);
  });

  it("upserts and lists ready plugins", () => {
    runtimeCatalog.upsert({
      id: "weather",
      version: "1.0.0",
      endpoint: "http://127.0.0.1:18001",
      status: "ready",
    });
    expect(runtimeCatalog.getEpoch()).toBeGreaterThan(0);
    expect(runtimeCatalog.readyPlugins()).toHaveLength(1);
    expect(runtimeCatalog.get("weather")?.endpoint).toContain("18001");
  });

  it("atomic replace supports hot-reload semantics", () => {
    runtimeCatalog.upsert({
      id: "weather",
      version: "1.0.0",
      endpoint: "http://127.0.0.1:18001",
      status: "ready",
    });
    const e1 = runtimeCatalog.getEpoch();
    runtimeCatalog.upsert({
      id: "weather",
      version: "2.0.0",
      endpoint: "http://127.0.0.1:18002",
      status: "ready",
    });
    expect(runtimeCatalog.getEpoch()).toBeGreaterThan(e1);
    expect(runtimeCatalog.get("weather")?.version).toBe("2.0.0");
    expect(runtimeCatalog.get("weather")?.endpoint).toContain("18002");
  });

  it("remove clears plugin", () => {
    runtimeCatalog.upsert({
      id: "echo",
      version: "1",
      endpoint: "http://127.0.0.1:1",
      status: "ready",
    });
    expect(runtimeCatalog.remove("echo")).toBe(true);
    expect(runtimeCatalog.get("echo")).toBeUndefined();
  });
});
