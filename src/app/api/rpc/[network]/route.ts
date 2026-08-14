import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_BODY = 48 * 1024;
const WINDOW_MS = 60_000;
const MAX_HITS = 90;

const ALLOWED = new Set([
  "starknet_call",
  "starknet_chainId",
  "starknet_specVersion",
  "starknet_blockNumber",
  "starknet_blockHashAndNumber",
  "starknet_getBlockWithTxHashes",
  "starknet_getBlockWithTxs",
  "starknet_getBlockTransactionCount",
  "starknet_getTransactionByHash",
  "starknet_getTransactionReceipt",
  "starknet_getTransactionStatus",
  "starknet_getClass",
  "starknet_getClassAt",
  "starknet_getClassHashAt",
  "starknet_getNonce",
  "starknet_getStorageAt",
  "starknet_getEvents",
  "starknet_getStateUpdate",
  "starknet_estimateFee",
  "starknet_simulateTransactions",
  "starknet_syncing",
]);

const hits = new Map<string, { n: number; t: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || now - cur.t > WINDOW_MS) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  cur.n += 1;
  return cur.n > MAX_HITS;
}

function methodsOk(payload: unknown): boolean {
  const items = Array.isArray(payload) ? payload : [payload];
  if (items.length === 0 || items.length > 20) return false;
  return items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const method = (item as { method?: unknown }).method;
    return typeof method === "string" && ALLOWED.has(method);
  });
}

function upstream(network: string): string | null {
  const key = process.env.PROVIDER_URL;
  if (!key) return null;
  if (network === "mainnet") {
    return `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/${key}`;
  }
  if (network === "sepolia") {
    return `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/${key}`;
  }
  return null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ network: string }> },
) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return Response.json({ error: "Too many RPC requests" }, { status: 429 });
  }

  const { network } = await ctx.params;
  const url = upstream(network);
  if (!url) {
    return Response.json({ error: "RPC is not configured" }, { status: 503 });
  }

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) {
    return Response.json({ error: "RPC body too large" }, { status: 413 });
  }

  const body = await req.text();
  if (body.length > MAX_BODY) {
    return Response.json({ error: "RPC body too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON-RPC body" }, { status: 400 });
  }
  if (!methodsOk(payload)) {
    return Response.json({ error: "RPC method not allowed" }, { status: 403 });
  }

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}
