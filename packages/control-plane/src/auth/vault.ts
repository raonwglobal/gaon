import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export interface SecretMeta {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface SecretRecord extends SecretMeta {
  ciphertext: string;
}

const vaultPath =
  process.env.VAULT_PATH || join(process.cwd(), "data", "vault.json");

function masterKey(): Buffer {
  const raw =
    process.env.VAULT_MASTER_KEY ||
    process.env.BOOTSTRAP_ADMIN_PASSWORD ||
    "dev-only-vault-key-change-me";
  return scryptSync(raw, "gaon-vault-v1", 32);
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

const secrets = new Map<string, SecretRecord>();

function persist(): void {
  mkdirSync(dirname(vaultPath), { recursive: true });
  writeFileSync(
    vaultPath,
    JSON.stringify({ secrets: [...secrets.values()] }, null, 2),
    "utf8"
  );
}

function load(): void {
  if (!existsSync(vaultPath)) return;
  try {
    const raw = JSON.parse(readFileSync(vaultPath, "utf8")) as {
      secrets?: SecretRecord[];
    };
    secrets.clear();
    for (const s of raw.secrets ?? []) secrets.set(s.id, s);
  } catch (err) {
    console.error("[vault] load failed:", err);
  }
}

load();

export const vault = {
  listMeta(userId: string, isAdmin: boolean): SecretMeta[] {
    const all = [...secrets.values()];
    const filtered = isAdmin ? all : all.filter((s) => s.userId === userId);
    return filtered.map(({ ciphertext: _, ...meta }) => meta);
  },

  put(input: {
    userId: string;
    name: string;
    value: string;
    id?: string;
  }): SecretMeta {
    const now = Date.now();
    const id = input.id || randomBytes(8).toString("hex");
    const existing = secrets.get(id);
    const record: SecretRecord = {
      id,
      userId: input.userId,
      name: input.name,
      ciphertext: encrypt(input.value),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    secrets.set(id, record);
    persist();
    const { ciphertext: _, ...meta } = record;
    return meta;
  },

  getPlain(id: string, userId: string, isAdmin: boolean): string | null {
    const s = secrets.get(id);
    if (!s) return null;
    if (!isAdmin && s.userId !== userId) return null;
    try {
      return decrypt(s.ciphertext);
    } catch {
      return null;
    }
  },

  delete(id: string, userId: string, isAdmin: boolean): boolean {
    const s = secrets.get(id);
    if (!s) return false;
    if (!isAdmin && s.userId !== userId) return false;
    secrets.delete(id);
    persist();
    return true;
  },

  listPlainByUser(userId: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const s of secrets.values()) {
      if (s.userId !== userId) continue;
      try {
        out[s.name] = decrypt(s.ciphertext);
      } catch {
        /* skip corrupt */
      }
    }
    return out;
  },
};
