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
};

const KEY = "redpocket.v2";
const LEGACY_KEY = "sealpack.v2";

function readAll(): StoredPack[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as StoredPack[]) : [];
  } catch {
    return [];
  }
}

function writeAll(packs: StoredPack[]) {
  localStorage.setItem(KEY, JSON.stringify(packs));
  localStorage.removeItem(LEGACY_KEY);
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
