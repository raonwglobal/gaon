import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { loadRuntimeConfig } from "./runtime-config";

async function bootstrap() {
  try {
    const cfg = await loadRuntimeConfig();
    if (cfg.adminToken && !localStorage.getItem("adminToken")) {
      localStorage.setItem("adminToken", cfg.adminToken);
    }
  } catch {
    // ignore — local vite or missing config.json
  }

  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

void bootstrap();
