"use client";

import { useEffect, useState } from "react";
import type { WALLET_API } from "@starknet-io/types-js";
import styles from "../app.module.css";
import Shell from "../components/Shell";
import Receipt from "../components/Receipt";
import { useStoreWallet } from "../components/Wallet/walletContext";
import { useFrontendProvider } from "../components/client/provider/providerContext";
import { myFrontendProviders } from "@/lib/constants";
import CopyRow from "../components/CopyRow";
import { fmtExpiry, shortHex } from "@/lib/format";
import { fetchPack } from "@/lib/onchain";
import { claimUrl, listPacks, type StoredPack } from "@/lib/storage";
import {
  errorResult,
  helperOrThrow,
  refundCalldata,
  submitStrk20,
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
    try {
      const helper = helperOrThrow(index);
      const token = onchainToken[p.dropId];
      if (!token) {
        setResult(errorResult("On-chain token not loaded. Refund is disabled until get_pack succeeds."));
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
      await submitStrk20(account, index, actions, `leftover ${meta.symbol}`, setResult);
    } catch (e: any) {
      setResult(errorResult(e?.message ?? String(e)));
    }
  }

  return (
    <Shell>
      <h1 className={styles.h1}>Redpockets I sent</h1>
      <p className={styles.note}>
        Password, Redpocket ID, and refund secret live in this browser. Refunds must use the same wallet that created the Redpocket. Expiry does not auto-refund. Copy a backup before you switch devices or clear cache.
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
              <CopyRow
                label="Redpocket ID"
                value={p.dropId}
                hint="If someone has the password but no link, they need this on the claim page."
                wrap
              />
              <CopyRow label="Password" value={p.password} hint="The passphrase for the group. Do not send it with the refund secret." />
              <CopyRow
                label="Claim link"
                value={url}
                hint="The link already includes Redpocket ID and password. Send this one line."
              />
              <CopyRow
                label="Refund secret"
                value={p.refundSecret}
                hint="Keep this to yourself. After expiry, refund with the same wallet below."
                wrap
              />
              <p className={styles.hint}>On-chain short id {shortHex(p.dropId)} · Refund stays disabled until expiry and the on-chain token is loaded.</p>
              <button
                className={styles.btnGhost}
                style={{ marginTop: 8 }}
                type="button"
                disabled={Date.now() / 1000 < p.expiry || !onchainToken[p.dropId]}
                onClick={() => refund(p)}
              >
                {Date.now() / 1000 < p.expiry
                  ? `Not expired yet (${fmtExpiry(p.expiry)})`
                  : !onchainToken[p.dropId]
                    ? onchainFail[p.dropId]
                      ? "Could not read on-chain token"
                      : "Loading on-chain token…"
                    : "Refund leftovers after expiry"}
              </button>
            </div>
          );
        })
      )}
    </Shell>
  );
}
