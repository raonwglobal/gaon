import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Role, UserRecord } from "./users.js";
import { userStore, publicUser } from "./users.js";

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const COOKIE_NAME = "gaon_session";

interface Session {
  id: string;
  userId: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

/**
 * Open access when AUTH_DISABLED is true/1/yes/open, OR when unset (default open).
 * Set AUTH_DISABLED=false to require login.
 */
export function isAuthDisabled(): boolean {
  const raw = process.env.AUTH_DISABLED;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return true; // default: open access
  }
  const v = String(raw).toLowerCase().trim();
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return v === "true" || v === "1" || v === "yes" || v === "open";
}

export function openAccessAuth(): AuthContext {
  return {
    user: {
      id: "open-access",
      username: "anonymous",
      role: "admin",
      active: true,
      createdAt: 0,
      updatedAt: 0,
    },
    role: "admin",
    sessionId: "open-access",
    viaLegacyToken: true,
  };
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie || "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export interface AuthContext {
  user: Omit<UserRecord, "passwordHash">;
  role: Role;
  sessionId: string;
  viaLegacyToken?: boolean;
}

export function createSession(userId: string): string {
  const id = randomBytes(32).toString("hex");
  sessions.set(id, {
    id,
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return id;
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function setSessionCookie(res: ServerResponse, sessionId: string): void {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export function resolveAuth(req: IncomingMessage): AuthContext | null {
  if (isAuthDisabled()) {
    return openAccessAuth();
  }

  const cookies = parseCookies(req);
  const sid = cookies[COOKIE_NAME];
  if (sid) {
    const s = sessions.get(sid);
    if (s && s.expiresAt > Date.now()) {
      const user = userStore.findById(s.userId);
      if (user && user.active) {
        return { user: publicUser(user), role: user.role, sessionId: sid };
      }
    } else if (s) {
      sessions.delete(sid);
    }
  }

  const legacy = process.env.ADMIN_TOKEN || "";
  if (legacy && legacy !== "change-me") {
    const header =
      req.headers["x-admin-token"] ||
      (typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/^Bearer\s+/i, "")
        : undefined);
    if (header === legacy) {
      const admin =
        userStore.list().find((u) => u.role === "admin" && u.active) ||
        userStore.findByUsername("admin");
      if (admin) {
        return {
          user: publicUser(admin),
          role: "admin",
          sessionId: "legacy-token",
          viaLegacyToken: true,
        };
      }
      return {
        user: {
          id: "legacy-admin",
          username: "admin",
          role: "admin",
          active: true,
          createdAt: 0,
          updatedAt: 0,
        },
        role: "admin",
        sessionId: "legacy-token",
        viaLegacyToken: true,
      };
    }
  }

  return null;
}

export function requireRole(auth: AuthContext, allowed: Role[]): boolean {
  if (isAuthDisabled()) return true;
  const order: Role[] = ["viewer", "user", "operator", "admin"];
  const need = Math.min(...allowed.map((r) => order.indexOf(r)));
  return order.indexOf(auth.role) >= need;
}

export function canAccessPlugin(
  auth: AuthContext,
  ownerUserId?: string
): boolean {
  if (isAuthDisabled()) return true;
  if (auth.role === "admin" || auth.role === "operator") return true;
  if (!ownerUserId) return false;
  return ownerUserId === auth.user.id;
}
