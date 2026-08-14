export type StoredPack = {
  dropId: string;
  network: string;
  token: string;
  decimals?: number;
  total: string;
  slots: number;
  expiry: number;
  password: string;
  refundSecret: string;
  random: boolean;
  createdAt: number;
  creator?: string;
};

const KEY = "redpacket.v2";
const LEGACY_KEYS = ["redpocket.v2", "sealpack.v2"];

function readAll(): StoredPack[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      localStorage.getItem(KEY) ??
      LEGACY_KEYS.map((k) => localStorage.getItem(k)).find((v) => v != null);
    return raw ? (JSON.parse(raw) as StoredPack[]) : [];
  } catch {
    return [];
  }
}

function writeAll(packs: StoredPack[]) {
  localStorage.setItem(KEY, JSON.stringify(packs));
  for (const k of LEGACY_KEYS) localStorage.removeItem(k);
}

export function savePack(pack: StoredPack) {
  const packs = readAll().filter((p) => p.dropId !== pack.dropId);
  packs.unshift(pack);
  writeAll(packs);
}

export function listPacks(): StoredPack[] {
  return readAll();
}

export function claimUrl(origin: string, dropId: string, password: string): string {
  return `${origin}/claim/${dropId}#p=${encodeURIComponent(password)}`;
}

/** Chat/social copy. Does not include the refund secret. */
export function shareCopy(p: {
  share: string;
  password: string;
  amountLabel?: string;
  slots?: number;
  network?: string;
}): string {
  const detail = [
    p.amountLabel,
    p.slots ? `${p.slots} share${p.slots === 1 ? "" : "s"}` : null,
    p.network,
  ]
    .filter((x): x is string => Boolean(x))
    .join(" · ");
  return [
    "🧧 Redpacket",
    "Claim into your STRK20 shielded balance.",
    detail ? detail : null,
    `Password: ${p.password}`,
    "",
    p.share,
    "",
    "Open in Ready. One wallet, one claim. Funds land in your shielded balance, not your public wallet.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function backupPlaintext(p: {
  dropId: string;
  password: string;
  refundSecret: string;
  share: string;
  network?: string;
}): string {
  return [
    "Redpacket backup — keep this file private.",
    p.network ? `Network: ${p.network}` : null,
    `Claim link: ${p.share}`,
    `Redpacket ID: ${p.dropId}`,
    `Password: ${p.password}`,
    `Refund secret: ${p.refundSecret}`,
    "",
    "Send only the claim link.",
    "Keep the refund secret. After expiry, refund with the same wallet that created the Redpacket.",
    "Another browser will not have this.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function downloadBackup(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function passwordFromHash(hash: string): string {
  const raw = hash.replace(/^#/, "");
  if (!raw) return "";
  try {
    const params = new URLSearchParams(raw.includes("=") ? raw : `p=${raw}`);
    return params.get("p") ?? decodeURIComponent(raw);
  } catch {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
}
