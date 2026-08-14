import { num } from "starknet";
import { poseidon } from "./crypto";

function toBig(x: string | bigint | number): bigint {
  return typeof x === "bigint" ? x : num.toBigInt(x);
}

export function hashPair(a: string | bigint, b: string | bigint): bigint {
  const x = toBig(a);
  const y = toBig(b);
  return x < y ? poseidon([x, y]) : poseidon([y, x]);
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** `ceil(log2(nextPow2(slots)))`. 1 share → 0 (empty proof). */
export function merkleHeight(slots: number): number {
  let n = nextPow2(Math.max(1, slots));
  let h = 0;
  while (n > 1) {
    n /= 2;
    h += 1;
  }
  return h;
}

export function padLeaves(leaves: Array<string | bigint>): bigint[] {
  const n = Math.max(1, nextPow2(leaves.length));
  const out = leaves.map(toBig);
  while (out.length < n) out.push(0n);
  return out;
}

export function merkleRoot(leaves: Array<string | bigint>): string {
  let layer = padLeaves(leaves);
  while (layer.length > 1) {
    const next: bigint[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(hashPair(layer[i], layer[i + 1]));
    }
    layer = next;
  }
  return num.toHex(layer[0]);
}

export function merkleProof(leaves: Array<string | bigint>, index: number): string[] {
  const padded = padLeaves(leaves);
  if (index < 0 || index >= padded.length) throw new Error("leaf index out of range");
  const proof: string[] = [];
  let i = index;
  let layer = padded;
  while (layer.length > 1) {
    const sib = i ^ 1;
    proof.push(num.toHex(layer[sib]));
    const next: bigint[] = [];
    for (let j = 0; j < layer.length; j += 2) {
      next.push(hashPair(layer[j], layer[j + 1]));
    }
    layer = next;
    i = Math.floor(i / 2);
  }
  return proof;
}

export function merkleVerify(leaf: string | bigint, proof: Array<string | bigint>, root: string | bigint): boolean {
  let computed = toBig(leaf);
  for (const sib of proof) computed = hashPair(computed, sib);
  return computed === toBig(root);
}
