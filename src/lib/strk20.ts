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

export function flattenError(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const coded = error as Error & { code?: unknown; error?: unknown; data?: unknown };
    if (coded.code === 4001 || coded.code === "4001" || coded.code === "ACTION_REJECTED") {
      return "user rejected the request";
    }
    const extra = flattenError(coded.error ?? coded.data);
    return [error.message, extra].filter(Boolean).join("\n");
  }
  if (typeof error === "object") {
    const o = error as Record<string, unknown>;
    if (o.code === 4001 || o.code === "4001" || o.code === "ACTION_REJECTED") {
      return "user rejected the request";
    }
    const bits = [o.message, o.error, o.data, o.cause, o.revert_error, o.revert_reason].map(flattenError).filter(Boolean);
    if (bits.length) return [...new Set(bits)].join("\n");
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function errorResult(error: unknown): ActionResult {
  const note = friendlyError(error);
  const cancelled = /you cancelled|rejected the request|request was rejected/i.test(note);
  if (cancelled) return { status: "error", title: "Cancelled", note };
  if (typeof error === "string") return { status: "error", title: "Check this", note };
  return { status: "error", title: "Failed", note };
}

export function busyCtaLabel(result: ActionResult | null, idle: string): string {
  if (!result || result.status !== "pending") return idle;
  if (result.title === "Waiting for confirmation…") return "Waiting for chain…";
  if (result.title === "Waiting on Ready") return "Waiting on Ready…";
  return "Working…";
}

function compactRaw(s: string): string {
  const cut = s.replace(/\s+/g, " ").trim();
  if (cut.length <= 240) return cut;
  return `${cut.slice(0, 220)}…`;
}

const UNREGISTERED_COPY =
  "This Ready account has not joined the STRK20 privacy pool on this network. Open Ready, stay on this network, tap STRK, tap Shield, and approve the privacy prompts. Then come back here.";

export function isNotRegisteredError(error: unknown): boolean {
  if (typeof error === "object" && error && "code" in error && Number((error as { code: unknown }).code) === 118) {
    return true;
  }
  return /NOT_REGISTERED/i.test(flattenError(error));
}

export function friendlyError(error: unknown): string {
  const s = flattenError(error).trim();
  if (!s) return "Something went wrong. Try again.";
  if (/user abort|user rejected|user denied|user cancelled|user canceled|action_rejected|rejected the request|request rejected|cancelled by user|canceled by user|closed the (popup|window)|popup closed|\b4001\b/i.test(s)) {
    return "You cancelled the request in Ready. Nothing was sent.";
  }
  if (/password cannot be empty/i.test(s)) {
    return "Enter a password first.";
  }
  if (/invalid amount/i.test(s)) {
    return "Enter a valid amount, like 1 or 0.5.";
  }
  if (/at most \d+ decimal/i.test(s)) {
    return "Too many decimal places for this token.";
  }
  if (/redpocket is not ready yet/i.test(s)) {
    return "Redpocket is not deployed on this network yet. Switch Ready to Mainnet or Sepolia.";
  }
  if (/invalid.*bignumber|cannot convert.*bigint|invalid (hex|felt|address)/i.test(s)) {
    return "That contract address does not look valid. Check it and try again.";
  }
  if (isNotRegisteredError(error) || /NOT_REGISTERED/i.test(s)) {
    return UNREGISTERED_COPY;
  }
  if (/INSUFFICIENT_PRIVATE_BALANCE/i.test(s)) {
    return "Not enough shielded balance. Shield tokens on the home page first, then try again.";
  }
  if (/authenticate with the privacy backend/i.test(s)) {
    return "Ready could not log this account into the STRK20 proving service. In Ready, stay on this network, open STRK, tap Shield, and approve the privacy signature. Then come back.";
  }
  if (/does not support strk20|strk20.*(not supported|not available|not implemented)|missing.*strk20/i.test(s)) {
    return "This wallet does not support STRK20 private actions. Use Ready, and make sure it is up to date.";
  }
  if (/BAD_MERKLE_PROOF|BAD_PASSWORD/i.test(s)) {
    return "Wrong password, or this Redpocket was created with an older app version. Check the password and network.";
  }
  if (/BAD_PROOF_LEN/i.test(s)) {
    return "This Redpocket does not match this app version. Check the network, then try again.";
  }
  if (/LEAF_ALREADY_USED/i.test(s)) {
    return "That share was just claimed. Try again to take another remaining share.";
  }
  if (/ALREADY_CLAIMED/i.test(s)) {
    return "This wallet already claimed this Redpocket. Use a different account.";
  }
  if (/NO_SLOTS|NOTHING_TO_REFUND/i.test(s)) {
    return "Nothing left to claim or refund.";
  }
  if (/PACK_EXPIRED/i.test(s)) {
    return "This Redpocket has expired. Claims are closed. The sender can refund leftover funds with the same wallet.";
  }
  if (/NOT_EXPIRED/i.test(s)) {
    return "Too early to refund. Wait until the expiry date.";
  }
  if (/NOT_CREATOR/i.test(s)) {
    return "Refund must use the same wallet that sealed this Redpocket.";
  }
  if (/BAD_REFUND_SECRET/i.test(s)) {
    return "Refund secret does not match. Use the backup from the device that created this Redpocket.";
  }
  if (/DROP_NOT_FOUND/i.test(s)) {
    return "This Redpocket is not on this network. Switch Ready to the network it was created on.";
  }
  if (/DROP_EXISTS|DROP_ID_MISMATCH/i.test(s)) {
    return "This Redpocket could not be created. Change the password or wait a moment and try again.";
  }
  if (/INSUFFICIENT_DEPOSIT|INSUFFICIENT_REMAINING/i.test(s)) {
    return "The helper does not have enough tokens for this step. Shield first, then seal again.";
  }
  if (/AMOUNT_TOO_SMALL|ZERO_AMOUNT|ZERO_SLOTS/i.test(s)) {
    return "Amount or share count is too small.";
  }
  if (/EXPIRY_IN_PAST/i.test(s)) {
    return "Expiry must be in the future. Increase the number of days.";
  }
  if (/CALLER_NOT_PRIVACY/i.test(s)) {
    return "This transaction did not go through the STRK20 pool. Use Ready on this page, not a plain send.";
  }
  if (/insufficient.*(funds|balance|fee)|exceed.*balance/i.test(s)) {
    return "Not enough public STRK in this account to pay the network fee. Add a little STRK to the same wallet, then try again.";
  }
  if (/wrong network|unsupported chain|chain mismatch|network mismatch/i.test(s)) {
    return "Ready is on a different network. Switch to Mainnet or Sepolia to match this page, then reconnect.";
  }
  if (/popup blocked|blocked the popup/i.test(s)) {
    return "The browser blocked the Ready popup. Allow popups for this site, then try again.";
  }
  if (/timed out|timeout/i.test(s)) {
    return "The network took too long to confirm. If Ready shows a transaction hash, the action may still land — keep this tab open and check Voyager.";
  }
  if (/429|too many/i.test(s)) {
    return "Too many network requests. Wait a few seconds, then try again.";
  }
  if (/failed to fetch|networkerror|load failed|err_network/i.test(s)) {
    return "Network request failed. Check your connection, keep Ready open, and try again.";
  }
  if (/not configured|503/i.test(s)) {
    return "The network connection is not available. Refresh and try again.";
  }
  if (/wallet not|no wallet|not found.*wallet|failed to connect/i.test(s)) {
    return "Ready did not connect. Install Ready, unlock it, and try Connect again.";
  }
  return compactRaw(s);
}

function signWaitCopy(actions: WALLET_API.STRK20_ACTION[]): { title: string; note: string } {
  const kinds = new Set(actions.map((a) => a.type));
  const extra = kinds.has("deposit")
    ? "Approve the shield request in Ready. First time on this account, you may also need to enable private tokens."
    : kinds.has("withdraw")
      ? "Approve every prompt — Ready proves the withdraw from shielded balance, then seals the Redpocket."
      : kinds.has("invoke")
        ? "Approve every prompt — Ready may ask you to sign more than once."
        : "Approve the request in the Ready popup.";
  return {
    title: "Waiting on Ready",
    note: `${extra} After you sign, a privacy proof is built (often 1–2 minutes). Keep this tab and Ready open.`,
  };
}

export type SubmitOutcome = { hash: string; confirmed: boolean; revertReason?: string };

function revertReasonOf(r: any): string {
  return String(r?.revert_reason ?? r?.revert_error ?? r?.execution_error ?? "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilAccepted(
  provider: { getTransactionStatus?: (h: string) => Promise<any>; getTransactionReceipt?: (h: string) => Promise<any> },
  txH: string,
): Promise<{ finality?: string; exec?: string; feeRaw?: unknown; revertReason?: string }> {
  const deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    try {
      const st = await provider.getTransactionStatus?.(txH);
      const finality = st?.finality_status as string | undefined;
      const exec = st?.execution_status as string | undefined;
      if (exec === "REVERTED") {
        let revertReason = "";
        try {
          const rec: any = await provider.getTransactionReceipt?.(txH);
          const r = rec?.value ?? rec;
          revertReason = revertReasonOf(r);
        } catch {
          /* status is enough */
        }
        return { finality, exec, revertReason };
      }
      if (finality === "ACCEPTED_ON_L2" || finality === "ACCEPTED_ON_L1") {
        try {
          const rec: any = await provider.getTransactionReceipt?.(txH);
          const r = rec?.value ?? rec;
          return {
            finality: r?.finality_status ?? finality,
            exec: r?.execution_status ?? exec ?? "SUCCEEDED",
            feeRaw: r?.actual_fee?.amount ?? r?.actual_fee,
            revertReason: revertReasonOf(r),
          };
        } catch {
          return { finality, exec: exec ?? "SUCCEEDED" };
        }
      }
    } catch {
      /* keep polling — proxy/RPC can 403 or lag right after broadcast */
    }
    await sleep(2500);
  }
  throw new Error("Timed out waiting for the transaction to land on L2");
}

export async function submitStrk20(
  account: WalletAccountV6,
  providerIndex: number,
  actions: WALLET_API.STRK20_ACTION[],
  amountLabel: string,
  onUpdate: (r: ActionResult) => void,
): Promise<SubmitOutcome | undefined> {
  const wait = signWaitCopy(actions);
  onUpdate({
    status: "pending",
    title: wait.title,
    note: wait.note,
  });
  let txH: string;
  try {
    const r = await account.strk20InvokeTransaction(actions);
    txH = r.transaction_hash;
  } catch (error: unknown) {
    onUpdate(errorResult(error));
    return undefined;
  }
  onUpdate({
    status: "pending",
    title: "Waiting for confirmation…",
    rows: [
      { label: "Amount", value: amountLabel },
      { label: "Transaction", value: shortHex(txH), hash: txH },
    ],
    note: "The proof is in. Waiting for the network to accept the transaction. Keep this tab open.",
  });
  const provider = myFrontendProviders[providerIndex];
  try {
    const waited = await waitUntilAccepted(provider as any, txH);
    const exec = waited.exec;
    const reverted = exec === "REVERTED";
    let feeStr: string | undefined;
    try {
      if (waited.feeRaw !== undefined && waited.feeRaw !== null) {
        feeStr = `${fmtStrk(num.toBigInt(waited.feeRaw as any))} STRK`;
      }
    } catch {
      /* ignore */
    }
    onUpdate({
      status: reverted ? "error" : "ok",
      title: reverted ? "Transaction reverted" : "Transaction confirmed",
      rows: [
        { label: "Amount", value: amountLabel },
        { label: "Status", value: prettyStatus(waited.finality, exec) },
        ...(feeStr ? [{ label: "Network fee", value: feeStr }] : []),
        { label: "Transaction", value: shortHex(txH), hash: txH },
      ],
      note: reverted && waited.revertReason ? friendlyError(waited.revertReason) : undefined,
    });
    if (reverted) return { hash: txH, confirmed: false, revertReason: waited.revertReason };
    return { hash: txH, confirmed: true };
  } catch (error: unknown) {
    onUpdate({
      status: "error",
      title: "Sent, confirmation pending",
      rows: [{ label: "Transaction", value: shortHex(txH), hash: txH }],
      note: `${friendlyError(error)} Check Voyager if Ready already shows a hash — the transaction may still confirm.`,
    });
    return { hash: txH, confirmed: false };
  }
}

export type ShieldedBalance = { token: string; amount: bigint };

export type BalanceRead = {
  rows: ShieldedBalance[];
  unregistered: boolean;
};

const inflightBalances = new Map<string, Promise<BalanceRead>>();
const cachedBalances = new Map<string, BalanceRead>();
const balanceEpoch = new Map<string, number>();

function accountKey(account: WalletAccountV6): string {
  try {
    return num.toHex(account.address);
  } catch {
    return String(account.address);
  }
}

async function fetchBalances(account: WalletAccountV6): Promise<BalanceRead> {
  try {
    const r: any = await account.strk20Balances([]);
    const arr = Array.isArray(r) ? r : Array.isArray(r?.value) ? r.value : [];
    const out: ShieldedBalance[] = [];
    for (const b of arr) {
      const token = b?.token ?? b?.token_address ?? b?.[0];
      const amount = b?.amount ?? b?.balance ?? b?.[1];
      try {
        out.push({ token: num.toHex(token), amount: num.toBigInt(amount) });
      } catch {
        /* skip */
      }
    }
    return { rows: out, unregistered: false };
  } catch (error: unknown) {
    return { rows: [], unregistered: isNotRegisteredError(error) };
  }
}

export async function readBalances(
  account: WalletAccountV6,
  opts?: { force?: boolean },
): Promise<BalanceRead> {
  const key = accountKey(account);
  const epoch = (balanceEpoch.get(key) ?? 0) + (opts?.force ? 1 : 0);
  if (opts?.force) balanceEpoch.set(key, epoch);
  if (opts?.force) {
    inflightBalances.delete(key);
    cachedBalances.delete(key);
  } else {
    const hit = cachedBalances.get(key);
    if (hit) return hit;
    const pending = inflightBalances.get(key);
    if (pending) return pending;
  }
  const started = epoch;
  const pending = fetchBalances(account)
    .then((snap) => {
      if ((balanceEpoch.get(key) ?? 0) === started) {
        cachedBalances.set(key, snap);
      }
      return snap;
    })
    .finally(() => {
      if (inflightBalances.get(key) === pending) inflightBalances.delete(key);
    });
  inflightBalances.set(key, pending);
  return pending;
}

export function pickTokenBalance(all: ShieldedBalance[], token: string): bigint {
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

export function applyBalanceDelta(rows: ShieldedBalance[], token: string, delta: bigint): ShieldedBalance[] {
  const target = num.toBigInt(token);
  let found = false;
  const next = rows.map((b) => {
    try {
      if (num.toBigInt(b.token) === target) {
        found = true;
        const amount = b.amount + delta;
        return { ...b, amount: amount < 0n ? 0n : amount };
      }
    } catch {
      /* skip */
    }
    return b;
  });
  if (!found && delta > 0n) next.push({ token: num.toHex(target), amount: delta });
  return next;
}

export async function readTokenBalance(
  account: WalletAccountV6,
  token: string,
): Promise<bigint | null> {
  return pickTokenBalance((await readBalances(account)).rows, token);
}

export const OP_CREATE = "0x0";
export const OP_CLAIM = "0x1";
export const OP_REFUND = "0x2";

function encodeSpan(items: string[]): string[] {
  return [num.toHex(items.length), ...items.map((x) => num.toHex(x))];
}

export function createCalldata(args: {
  dropId: string;
  token: string;
  amount: bigint;
  slots: number;
  expiry: bigint;
  refundCommitment: string;
  merkleRoot: string;
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
    num.toHex(args.merkleRoot),
    args.random ? "0x1" : "0x0",
    "0x0",
    ...encodeSpan([]),
  ];
}

export function claimCalldata(args: { dropId: string; leaf: string; proof: string[] }): string[] {
  return [
    OP_CLAIM,
    num.toHex(args.dropId),
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    num.toHex(args.leaf),
    "0x0",
    "${openNoteIds[0]}",
    ...encodeSpan(args.proof),
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
    ...encodeSpan([]),
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
