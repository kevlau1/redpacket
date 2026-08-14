import { num, type RpcProvider } from "starknet";
import { helperForIndex } from "./constants";
import { claimedTicket, leafUsedTicket } from "./crypto";
import { isZeroAddress } from "./strk20";

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

export async function unusedShareIndex(
  provider: RpcProvider,
  providerIndex: number,
  dropId: string,
  leaves: string[],
): Promise<number | null> {
  const flags = await Promise.all(
    leaves.map((leaf) => fetchTicket(provider, providerIndex, leafUsedTicket(dropId, leaf))),
  );
  const unused = leaves.map((_, i) => i).filter((i) => flags[i] !== true);
  if (unused.length === 0) return null;
  return unused[Math.floor(Math.random() * unused.length)];
}
