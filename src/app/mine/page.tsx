"use client";

import { useEffect, useState } from "react";
import type { WALLET_API } from "@starknet-io/types-js";
import styles from "../app.module.css";
import Shell from "../components/Shell";
import Receipt from "../components/Receipt";
import { useStoreWallet } from "../components/Wallet/walletContext";
import { useFrontendProvider } from "../components/client/provider/providerContext";
import { num } from "starknet";
import { myFrontendProviders } from "@/lib/constants";
import CopyRow from "../components/CopyRow";
import ShareMessage from "../components/ShareMessage";
import { fmtExpiry } from "@/lib/format";
import { fetchPack } from "@/lib/onchain";
import { claimUrl, listPacks, backupPlaintext, downloadBackup, shareCopy, type StoredPack } from "@/lib/storage";
import {
  errorResult,
  helperOrThrow,
  refundCalldata,
  submitStrk20,
  busyCtaLabel,
  type ActionResult,
} from "@/lib/strk20";
import { labelAmount, resolveToken } from "@/lib/tokens";

export default function MinePage() {
  const [packs, setPacks] = useState<StoredPack[]>([]);
  const [origin, setOrigin] = useState("");
  const account = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);
  const index = useFrontendProvider((s) => s.currentFrontendProviderIndex);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [remaining, setRemaining] = useState<Record<string, string>>({});
  const [onchainToken, setOnchainToken] = useState<Record<string, string>>({});
  const [onchainFail, setOnchainFail] = useState<Record<string, boolean>>({});
  const [refundBusy, setRefundBusy] = useState<string | null>(null);

  useEffect(() => {
    setPacks(listPacks());
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const provider = myFrontendProviders[index] as any;
    packs.forEach(async (p) => {
      const on = await fetchPack(provider, index, p.dropId);
      if (on?.exists) {
        setRemaining((m) => ({
          ...m,
          [p.dropId]: `${on.remaining.toString()}|${on.slotsLeft}`,
        }));
        setOnchainToken((m) => ({ ...m, [p.dropId]: on.token }));
        setOnchainFail((m) => ({ ...m, [p.dropId]: false }));
      } else {
        setOnchainFail((m) => ({ ...m, [p.dropId]: true }));
      }
    });
  }, [packs, index]);

  async function refund(p: StoredPack) {
    if (!account || !address) {
      setResult(errorResult("Connect a wallet first"));
      return;
    }
    setRefundBusy(p.dropId);
    try {
      const helper = helperOrThrow(index);
      const token = onchainToken[p.dropId];
      if (!token) {
        setResult(errorResult("Token not loaded from the chain yet. Refund stays disabled until it is."));
        return;
      }
      const meta = resolveToken(token, index);
      const calldata = refundCalldata({
        dropId: p.dropId,
        refundSecret: p.refundSecret,
      });
      const actions: WALLET_API.STRK20_ACTION[] = [
        { type: "transfer", token, amount: "OPEN", recipient: address },
        { type: "invoke", contract: helper, calldata },
      ];
      const tx = await submitStrk20(account, index, actions, `unclaimed ${meta.symbol}`, setResult);
      if (!tx?.hash) return;
      const on = await fetchPack(myFrontendProviders[index] as any, index, p.dropId);
      if (on?.exists) {
        setRemaining((m) => ({
          ...m,
          [p.dropId]: `${on.remaining.toString()}|${on.slotsLeft}`,
        }));
      }
    } catch (e: unknown) {
      setResult(errorResult(e));
    } finally {
      setRefundBusy(null);
    }
  }

  return (
    <Shell>
      <h1 className={styles.h1}>Redpockets I sent</h1>
      <p className={styles.note}>
        Password, Redpocket ID, and refund secret live in this browser. Download a backup before you switch devices. Refunds must use the same wallet that created the Redpocket. Expiry does not auto-refund.
      </p>
      {result ? <Receipt r={result} /> : null}
      {packs.length === 0 ? (
        <div className={styles.panel}>Nothing sent yet.</div>
      ) : (
        packs.map((p) => {
          const [rem, slots] = (remaining[p.dropId] ?? "").split("|");
          const url = claimUrl(origin, p.dropId, p.password);
          const token = {
            ...resolveToken(onchainToken[p.dropId] ?? p.token, index),
            decimals: p.decimals ?? resolveToken(onchainToken[p.dropId] ?? p.token, index).decimals,
          };
          const leftover = rem ? BigInt(rem) : null;
          const wrongCreator = (() => {
            if (!p.creator || !address) return false;
            try {
              return num.toBigInt(p.creator) !== num.toBigInt(address);
            } catch {
              return true;
            }
          })();
          return (
            <div key={p.dropId} className={styles.panel}>
              <div className={styles.meta}>
                <span>{p.random ? "Random" : "Equal"} · {p.slots} shares · {p.network} · {token.symbol}</span>
                <span>Expires {fmtExpiry(p.expiry)}</span>
              </div>
              <div className={styles.meta}>
                <span>Total {labelAmount(BigInt(p.total), token)}</span>
                <span>
                  {rem
                    ? `Left ${labelAmount(BigInt(rem), token)} · ${slots} shares`
                    : "…"}
                </span>
              </div>
              <ShareMessage
                text={shareCopy({
                  share: url,
                  password: p.password,
                  amountLabel: labelAmount(BigInt(p.total), token),
                  slots: p.slots,
                  network: p.network,
                })}
              />
              <CopyRow
                label="Redpocket ID"
                value={p.dropId}
                hint="Needed on the claim page if someone has the password but not the link."
                wrap
              />
              <CopyRow label="Password" value={p.password} hint="The password for people claiming. Do not send it with the refund secret." />
              <CopyRow
                label="Claim link"
                value={url}
                hint="Already includes the Redpocket ID and password. This is what you send."
              />
              <CopyRow
                label="Refund secret"
                value={p.refundSecret}
                hint="Keep this private. After expiry, refund with the same wallet below."
                wrap
              />
              <div className={styles.backupActions}>
                <button
                  className={styles.copy}
                  type="button"
                  onClick={() =>
                    downloadBackup(
                      `redpocket-${p.dropId.slice(0, 10)}.txt`,
                      backupPlaintext({
                        dropId: p.dropId,
                        password: p.password,
                        refundSecret: p.refundSecret,
                        share: url,
                        network: p.network,
                      }),
                    )
                  }
                >
                  Download backup file
                </button>
              </div>
              {wrongCreator ? (
                <p className={styles.warn}>
                  This wallet did not create this Redpocket. Refund must use the same wallet that sealed it.
                </p>
              ) : null}
              <p className={styles.hint}>Refund stays disabled until expiry, and until this Redpocket has loaded from the chain.</p>
              <button
                className={styles.btnGhost}
                style={{ marginTop: 8 }}
                type="button"
                disabled={refundBusy !== null || Date.now() / 1000 < p.expiry || !onchainToken[p.dropId] || leftover === 0n}
                onClick={() => refund(p)}
              >
                {refundBusy === p.dropId
                  ? busyCtaLabel(result, "Refund unclaimed funds")
                  : Date.now() / 1000 < p.expiry
                  ? `Not expired yet (${fmtExpiry(p.expiry)})`
                  : leftover === 0n
                    ? "Nothing left to refund"
                    : !onchainToken[p.dropId]
                    ? onchainFail[p.dropId]
                      ? "Could not read on-chain token"
                      : "Loading on-chain token…"
                    : "Refund unclaimed funds"}
              </button>
            </div>
          );
        })
      )}
    </Shell>
  );
}
