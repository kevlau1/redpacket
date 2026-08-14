import { num, type RpcProvider } from "starknet";
import { helperForIndex } from "./constants";
import { claimedTicket } from "./crypto";
import { isZeroAddress } from "./strk20";

export type OnchainPack = {
  passwordHash: string;
  token: string;
  remaining: bigint;
  slotsLeft: number;
  expiry: bigint;
  refundHash: string;
  random: boolean;
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
    const [passwordHash, token, remaining, slotsLeft, expiry, refundHash, random] =
      resultArray(res);
    const hash = num.toBigInt(passwordHash);
    return {
      passwordHash: num.toHex(passwordHash),
      token: num.toHex(token),
      remaining: num.toBigInt(remaining),
      slotsLeft: Number(num.toBigInt(slotsLeft)),
      expiry: num.toBigInt(expiry),
      refundHash: num.toHex(refundHash),
      random: num.toBigInt(random) !== 0n,
      exists: hash !== 0n,
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

export async function fetchClaimed(
  provider: RpcProvider,
  providerIndex: number,
  dropId: string,
  account: string,
): Promise<boolean | null> {
  const helper = helperForIndex(providerIndex);
  if (isZeroAddress(helper)) return null;
  try {
    const res = await provider.callContract({
      contractAddress: helper,
      entrypoint: "is_claimed",
      calldata: [claimedTicket(dropId, account)],
    });
    const out = resultArray(res);
    return num.toBigInt(out[0]) !== 0n;
  } catch {
    return null;
  }
}
