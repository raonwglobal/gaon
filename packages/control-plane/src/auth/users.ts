import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { hashPassword, verifyPassword } from "./password.js";

export type Role = "admin" | "operator" | "user" | "viewer";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

const dataPath =
  process.env.USERS_PATH ||
  join(process.cwd(), "data", "users.json");

const users = new Map<string, UserRecord>();

function persist(): void {
  mkdirSync(dirname(dataPath), { recursive: true });
  writeFileSync(
    dataPath,
    JSON.stringify({ users: [...users.values()] }, null, 2),
    "utf8"
  );
}

function load(): void {
  if (!existsSync(dataPath)) return;
  try {
    const raw = JSON.parse(readFileSync(dataPath, "utf8")) as {
      users?: UserRecord[];
    };
    users.clear();
    for (const u of raw.users ?? []) users.set(u.id, u);
  } catch (err) {
    console.error("[users] load failed:", err);
  }
}

load();

export function publicUser(u: UserRecord): Omit<UserRecord, "passwordHash"> {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

export const userStore = {
  list(): UserRecord[] {
    return [...users.values()];
  },

  findByUsername(username: string): UserRecord | undefined {
    const n = username.trim().toLowerCase();
    return [...users.values()].find((u) => u.username.toLowerCase() === n);
  },

  findById(id: string): UserRecord | undefined {
    return users.get(id);
  },

  create(input: {
    username: string;
    password: string;
    role: Role;
  }): UserRecord {
    if (userStore.findByUsername(input.username)) {
      throw new Error("Username already exists");
    }
    const now = Date.now();
    const record: UserRecord = {
      id: randomUUID(),
      username: input.username.trim(),
      passwordHash: hashPassword(input.password),
      role: input.role,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    users.set(record.id, record);
    persist();
    return record;
  },

  setActive(id: string, active: boolean): UserRecord | null {
    const u = users.get(id);
    if (!u) return null;
    u.active = active;
    u.updatedAt = Date.now();
    persist();
    return u;
  },

  setRole(id: string, role: Role): UserRecord | null {
    const u = users.get(id);
    if (!u) return null;
    u.role = role;
    u.updatedAt = Date.now();
    persist();
    return u;
  },

  verify(username: string, password: string): UserRecord | null {
    const u = userStore.findByUsername(username);
    if (!u || !u.active) return null;
    if (!verifyPassword(password, u.passwordHash)) return null;
    return u;
  },

  ensureBootstrapAdmin(): void {
    if (users.size > 0) return;
    const username =
      process.env.BOOTSTRAP_ADMIN_USER ||
      process.env.ADMIN_USER ||
      "admin";
    const password =
      process.env.BOOTSTRAP_ADMIN_PASSWORD ||
      process.env.ADMIN_PASSWORD ||
      process.env.ADMIN_TOKEN ||
      "";
    if (!password || password === "change-me") {
      console.warn(
        "[users] No users and no strong BOOTSTRAP_ADMIN_PASSWORD. " +
          "Set BOOTSTRAP_ADMIN_PASSWORD to create the first admin."
      );
      return;
    }
    userStore.create({ username, password, role: "admin" });
    console.log(`[users] bootstrap admin created: ${username}`);
  },
};

userStore.ensureBootstrapAdmin();
