import { hash, num, type RpcProvider } from "starknet";
import { helperForIndex } from "./constants";
import { claimedTicket, leafUsedTicket } from "./crypto";
import { isZeroAddress } from "./strk20";

type ChainEvent = { from_address: string; keys: string[]; data: string[] };

export type OnchainPack = {
  merkleRoot: string;
  token: string;
  remaining: bigint;
  slots: number;
  slotsLeft: number;
  expiry: bigint;
  refundHash: string;
  random: boolean;
  creatorHash: string;
  exists: boolean;
};

function resultArray(res: unknown): string[] {
  if (Array.isArray(res)) return res as string[];
  return (res as { result: string[] }).result;
}

export async function fetchPack(
  provider: RpcProvider,
  providerIndex: number,
  dropId: string,
): Promise<OnchainPack | null> {
  const helper = helperForIndex(providerIndex);
  if (isZeroAddress(helper)) return null;
  try {
    const res = await provider.callContract({
      contractAddress: helper,
      entrypoint: "get_pack",
      calldata: [num.toHex(dropId)],
    });
    const [merkleRoot, token, remaining, slots, slotsLeft, expiry, refundHash, random, creatorHash] =
      resultArray(res);
    const root = num.toBigInt(merkleRoot);
    return {
      merkleRoot: num.toHex(merkleRoot),
      token: num.toHex(token),
      remaining: num.toBigInt(remaining),
      slots: Number(num.toBigInt(slots)),
      slotsLeft: Number(num.toBigInt(slotsLeft)),
      expiry: num.toBigInt(expiry),
      refundHash: num.toHex(refundHash),
      random: num.toBigInt(random) !== 0n,
      creatorHash: creatorHash ? num.toHex(creatorHash) : "0x0",
      exists: root !== 0n,
    };
  } catch {
    return null;
  }
}

export async function fetchTokenDecimals(
  provider: RpcProvider,
  token: string,
): Promise<number | null> {
  try {
    const res = await provider.callContract({
      contractAddress: token,
      entrypoint: "decimals",
      calldata: [],
    });
    const out = resultArray(res);
    const n = Number(num.toBigInt(out[0]));
    if (!Number.isInteger(n) || n < 0 || n > 36) return null;
    return n;
  } catch {
    return null;
  }
}

export async function fetchTicket(
  provider: RpcProvider,
  providerIndex: number,
  ticket: string,
): Promise<boolean | null> {
  const helper = helperForIndex(providerIndex);
  if (isZeroAddress(helper)) return null;
  try {
    const res = await provider.callContract({
      contractAddress: helper,
      entrypoint: "is_claimed",
      calldata: [ticket],
    });
    const out = resultArray(res);
    return num.toBigInt(out[0]) !== 0n;
  } catch {
    return null;
  }
}

export async function fetchClaimed(
  provider: RpcProvider,
  providerIndex: number,
  dropId: string,
  account: string,
): Promise<boolean | null> {
  return fetchTicket(provider, providerIndex, claimedTicket(dropId, account));
}

export type ShareLookup =
  | { kind: "ok"; index: number }
  | { kind: "all-used" }
  | { kind: "unreadable" };

function shuffledIndices(n: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Probes tickets in random order and stops at the first one the chain reports
 * unused, so a fresh pack costs one call instead of one per share. A read that
 * fails is never treated as unused — that would send a transaction doomed to
 * revert with LEAF_ALREADY_USED.
 */
export async function findUnusedShare(
  provider: RpcProvider,
  providerIndex: number,
  dropId: string,
  tickets: string[],
): Promise<ShareLookup> {
  let unreadable = false;
  for (const i of shuffledIndices(tickets.length)) {
    const used = await fetchTicket(provider, providerIndex, leafUsedTicket(dropId, tickets[i]));
    if (used === false) return { kind: "ok", index: i };
    if (used === null) unreadable = true;
  }
  return unreadable ? { kind: "unreadable" } : { kind: "all-used" };
}

/** Exact payout for a confirmed claim, read from the helper's `Claimed` event. */
export async function fetchClaimedAmount(
  provider: RpcProvider,
  providerIndex: number,
  txHash: string,
  dropId: string,
): Promise<bigint | null> {
  const helper = helperForIndex(providerIndex);
  if (isZeroAddress(helper)) return null;
  try {
    const receipt = (await provider.getTransactionReceipt(txHash)) as unknown as {
      value?: { events?: ChainEvent[] };
      events?: ChainEvent[];
    };
    const events = receipt.value?.events ?? receipt.events ?? [];
    const selector = num.toBigInt(hash.getSelectorFromName("Claimed"));
    const target = num.toBigInt(dropId);
    for (const e of events) {
      if (num.toBigInt(e.from_address) !== num.toBigInt(helper)) continue;
      if (num.toBigInt(e.keys?.[0] ?? 0) !== selector) continue;
      if (num.toBigInt(e.keys?.[1] ?? 0) !== target) continue;
      return num.toBigInt(e.data[0]);
    }
    return null;
  } catch {
    return null;
  }
}
