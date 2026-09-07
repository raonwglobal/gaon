import { createServer, type IncomingMessage } from "node:http";
import { installPlugin, type InstallRequest } from "./install.js";

const PORT = Number(process.env.INSTALL_WORKER_PORT ?? 3002);
const INTERNAL_TOKEN =
  process.env.INTERNAL_TOKEN || process.env.ADMIN_TOKEN || "";

function authorized(req: IncomingMessage): boolean {
  // Empty token = open (local / AUTH_DISABLED style deployments)
  if (!INTERNAL_TOKEN) return true;
  const token =
    req.headers["x-internal-token"] ||
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : undefined);
  return token === INTERNAL_TOKEN;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0];

  if (req.method === "GET" && (path === "/health" || path === "/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "install-worker",
        signatureRequired: process.env.PLUGIN_SIGNATURE_REQUIRED === "true",
        auth: INTERNAL_TOKEN ? "token" : "open",
      })
    );
    return;
  }

  if (req.method === "POST" && path === "/install") {
    if (!authorized(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    try {
      const body = JSON.parse(await readBody(req)) as InstallRequest;
      if (!body?.id || !body?.source?.type || !body?.source?.ref) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "id, source.type, source.ref required" })
        );
        return;
      }
      const result = await installPlugin(body);
      res.writeHead(result.ok ? 200 : 422, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        })
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`install-worker listening on :${PORT}`);
  if (!INTERNAL_TOKEN) {
    console.warn("[install-worker] INTERNAL_TOKEN empty — install API is open");
  }
});
