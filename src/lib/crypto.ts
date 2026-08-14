import { hash, num, shortString } from "starknet";
import { DROP_ID_TAG, REFUND_TAG } from "./constants";

export const PASSWORD_TAG = "SEALPACK_PASS:V1";

export function poseidon(elements: Array<string | number | bigint>): bigint {
  return BigInt(hash.computePoseidonHashOnElements(elements.map((e) => num.toHex(e))));
}

export function tag(s: string): string {
  return num.toHex(shortString.encodeShortString(s));
}

export function randomFelt(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  bytes[0] &= 0x03;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return num.toHex(BigInt("0x" + hex));
}

/** Domain-separated digest of the human password. Never sent on-chain. */
export function passwordPreimage(password: string): string {
  const text = password.trim();
  if (!text) throw new Error("Password cannot be empty");
  const bytes = new TextEncoder().encode(text);
  const felts: Array<string | bigint> = [tag(PASSWORD_TAG)];
  for (let i = 0; i < bytes.length; i += 31) {
    const chunk = bytes.slice(i, i + 31);
    let v = 0n;
    for (const b of chunk) v = (v << 8n) | BigInt(b);
    felts.push(v);
  }
  return num.toHex(poseidon(felts));
}

export function passwordHash(preimage: string): string {
  return num.toHex(poseidon([tag(PASSWORD_TAG), preimage]));
}

export function refundHash(secret: string): bigint {
  return poseidon([tag(REFUND_TAG), secret]);
}

export function claimedTicket(dropId: string, account: string): string {
  return num.toHex(poseidon([tag("SEALPACK_CLAIMED:V1"), dropId, account]));
}

export function creatorHash(account: string): string {
  return num.toHex(poseidon([tag("SEALPACK_CREATOR:V1"), account]));
}

export function leafUsedTicket(dropId: string, leaf: string): string {
  return num.toHex(poseidon([tag("SEALPACK_USED:V1"), dropId, leaf]));
}

/** One-time ticket for share `index`. Password never goes on-chain. */
export function claimLeaf(preimage: string, index: number): string {
  return num.toHex(poseidon([tag("SEALPACK_LEAF:V1"), preimage, index]));
}

export function claimLeaves(preimage: string, slots: number): string[] {
  return Array.from({ length: slots }, (_, i) => claimLeaf(preimage, i));
}

/** Tree node for ticket `T`. Proof siblings are these, never `T`. */
export function commitLeaf(ticket: string | bigint): string {
  return num.toHex(poseidon([tag("SEALPACK_COMMIT:V1"), ticket]));
}

export function committedLeaves(tickets: string[]): string[] {
  return tickets.map(commitLeaf);
}

export function computeDropId(args: {
  merkleRoot: string;
  refundCommitment: string;
  token: string;
  amount: bigint;
  slots: number;
  expiry: bigint;
  random: boolean;
}): string {
  return num.toHex(
    poseidon([
      tag(DROP_ID_TAG),
      args.merkleRoot,
      args.refundCommitment,
      args.token,
      args.amount,
      args.slots,
      args.expiry,
      args.random ? 1 : 0,
    ]),
  );
}
