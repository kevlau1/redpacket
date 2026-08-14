import type { WALLET_API } from "@starknet-io/types-js";
import { hash, num, type WalletAccountV6 } from "starknet";
import { helperForIndex, myFrontendProviders } from "./constants";
import { fmtStrk, shortHex } from "./format";

export type ActionResult = {
  status: "pending" | "ok" | "error";
  title: string;
  rows?: { label: string; value: string; hash?: string }[];
  note?: string;
};

export function explorerTxUrl(index: number, tx: string): string {
  return index === 0
    ? `https://voyager.online/tx/${tx}`
    : `https://sepolia.voyager.online/tx/${tx}`;
}

function prettyStatus(finality?: string, exec?: string): string {
  const f =
    finality === "ACCEPTED_ON_L2"
      ? "Accepted on L2"
      : finality === "ACCEPTED_ON_L1"
        ? "Accepted on L1"
        : finality === "RECEIVED"
          ? "Received"
          : (finality ?? "");
  const e = exec === "SUCCEEDED" ? "Succeeded" : exec === "REVERTED" ? "Reverted" : "";
  return [f, e].filter(Boolean).join(" · ") || "Confirmed";
}

export function errorResult(msg: string): ActionResult {
  return { status: "error", title: "Failed", note: msg };
}

export type SubmitOutcome = { hash: string; confirmed: boolean };

export async function submitStrk20(
  account: WalletAccountV6,
  providerIndex: number,
  actions: WALLET_API.STRK20_ACTION[],
  amountLabel: string,
  onUpdate: (r: ActionResult) => void,
): Promise<SubmitOutcome | undefined> {
  let txH: string;
  try {
    const r = await account.strk20InvokeTransaction(actions);
    txH = r.transaction_hash;
  } catch (error: unknown) {
    const e = error as { message?: string };
    onUpdate(errorResult(e?.message ?? String(error)));
    return undefined;
  }
  onUpdate({
    status: "pending",
    title: "Waiting for confirmation…",
    rows: [
      { label: "Amount", value: amountLabel },
      { label: "Transaction", value: shortHex(txH), hash: txH },
    ],
  });
  const provider = myFrontendProviders[providerIndex];
  try {
    const txR: any = await provider.waitForTransaction(txH, {
      retries: 400,
      retryInterval: 3000,
    });
    const r = txR?.value ?? txR;
    const exec: string | undefined = r?.execution_status;
    const reverted = exec === "REVERTED";
    let feeStr: string | undefined;
    const feeRaw = r?.actual_fee?.amount ?? r?.actual_fee;
    try {
      if (feeRaw !== undefined && feeRaw !== null) {
        feeStr = `${fmtStrk(num.toBigInt(feeRaw))} STRK`;
      }
    } catch {
      /* ignore */
    }
    onUpdate({
      status: reverted ? "error" : "ok",
      title: reverted ? "Transaction reverted" : "Transaction confirmed",
      rows: [
        { label: "Amount", value: amountLabel },
        { label: "Status", value: prettyStatus(r?.finality_status, exec) },
        ...(feeStr ? [{ label: "Network fee", value: feeStr }] : []),
        { label: "Transaction", value: shortHex(txH), hash: txH },
      ],
    });
    if (reverted) return undefined;
    return { hash: txH, confirmed: true };
  } catch (error: unknown) {
    const e = error as { message?: string };
    onUpdate({
      status: "error",
      title: "Sent, confirmation pending",
      rows: [{ label: "Transaction", value: shortHex(txH), hash: txH }],
      note: `${e?.message ?? String(error)}. The transaction was broadcast. Keep any backup shown on this page.`,
    });
    return { hash: txH, confirmed: false };
  }
}

export async function readBalances(
  account: WalletAccountV6,
): Promise<{ token: string; amount: bigint }[]> {
  try {
    const r: any = await account.strk20Balances([]);
    const arr = Array.isArray(r) ? r : Array.isArray(r?.value) ? r.value : [];
    const out: { token: string; amount: bigint }[] = [];
    for (const b of arr) {
      const token = b?.token ?? b?.token_address ?? b?.[0];
      const amount = b?.amount ?? b?.balance ?? b?.[1];
      try {
        out.push({ token: num.toHex(token), amount: num.toBigInt(amount) });
      } catch {
        /* skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function readTokenBalance(
  account: WalletAccountV6,
  token: string,
): Promise<bigint | null> {
  const all = await readBalances(account);
  const target = num.toBigInt(token);
  const hit = all.find((b) => {
    try {
      return num.toBigInt(b.token) === target;
    } catch {
      return false;
    }
  });
  return hit ? hit.amount : 0n;
}

export const OP_CREATE = "0x0";
export const OP_CLAIM = "0x1";
export const OP_REFUND = "0x2";

export function createCalldata(args: {
  dropId: string;
  token: string;
  amount: bigint;
  slots: number;
  expiry: bigint;
  refundCommitment: string;
  passwordHash: string;
  random: boolean;
}): string[] {
  return [
    OP_CREATE,
    num.toHex(args.dropId),
    num.toHex(args.token),
    num.toHex(args.amount),
    num.toHex(args.slots),
    num.toHex(args.expiry),
    num.toHex(args.refundCommitment),
    num.toHex(args.passwordHash),
    args.random ? "0x1" : "0x0",
    "0x0",
  ];
}

export function claimCalldata(args: { dropId: string; passwordPreimage: string }): string[] {
  return [
    OP_CLAIM,
    num.toHex(args.dropId),
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    num.toHex(args.passwordPreimage),
    "0x0",
    "${openNoteIds[0]}",
  ];
}

export function refundCalldata(args: { dropId: string; refundSecret: string }): string[] {
  return [
    OP_REFUND,
    num.toHex(args.dropId),
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    num.toHex(args.refundSecret),
    "0x0",
    "${openNoteIds[0]}",
  ];
}

export function isZeroAddress(addr: string): boolean {
  try {
    return num.toBigInt(addr) === 0n;
  } catch {
    return true;
  }
}

export function helperOrThrow(index: number): string {
  const h = helperForIndex(index);
  if (isZeroAddress(h)) {
    throw new Error("Redpocket is not ready yet.");
  }
  return num.toHex(h);
}

export const createdSelector = () => num.toHex(hash.getSelectorFromName("Created"));
