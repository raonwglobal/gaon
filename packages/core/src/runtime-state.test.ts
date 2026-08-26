import { describe, it, expect } from "vitest";
import {
  setPlatformConfig,
  getPlatformConfig,
  setEnabledPlugins,
  runtimeState,
} from "./runtime-state.js";

describe("runtime-state", () => {
  it("updates platform config as single source", () => {
    setPlatformConfig({
      allowedOrigins: ["https://example.com"],
      rateLimitPerMin: 30,
      maxSessions: 50,
    });
    const cfg = getPlatformConfig();
    expect(cfg.allowedOrigins).toEqual(["https://example.com"]);
    expect(cfg.rateLimitPerMin).toBe(30);
    expect(cfg.maxSessions).toBe(50);
  });

  it("sets enabled plugins list", () => {
    setEnabledPlugins(["weather", "echo"]);
    expect(runtimeState.enabledPlugins).toEqual(["weather", "echo"]);
  });
});
