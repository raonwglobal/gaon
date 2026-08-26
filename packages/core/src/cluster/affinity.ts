import { createHash } from "node:crypto";

/**
 * Session affinity helpers for multi-instance deployments.
 *
 * Modes:
 * - sticky-header: client sends X-Session-Owner: <instanceId>
 * - consistent-hash: sessionId hashes to a peer in CLUSTER_PEERS
 */

export function getInstanceId(): string {
  return process.env.INSTANCE_ID || process.env.HOSTNAME || "solo";
}

export function listPeers(): string[] {
  const raw = process.env.CLUSTER_PEERS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hashToPeer(sessionId: string, peers: string[]): string {
  if (peers.length === 0) return getInstanceId();
  const h = createHash("sha256").update(sessionId).digest();
  const idx = h.readUInt32BE(0) % peers.length;
  return peers[idx];
}

export function shouldOwnSession(sessionId: string): boolean {
  const peers = listPeers();
  if (peers.length === 0) return true;
  return hashToPeer(sessionId, peers) === getInstanceId();
}

export function affinityHeaders(sessionId: string): Record<string, string> {
  return {
    "X-Instance-Id": getInstanceId(),
    "X-Session-Owner": hashToPeer(sessionId, listPeers().length ? listPeers() : [getInstanceId()]),
  };
}
