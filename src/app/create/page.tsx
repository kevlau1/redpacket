"use client";

import { useEffect, useMemo, useState } from "react";
import type { WALLET_API } from "@starknet-io/types-js";
import { num } from "starknet";
import styles from "../app.module.css";
import Shell from "../components/Shell";
import Receipt from "../components/Receipt";
import SelectWallet from "../components/client/SelectWallet";
import CopyRow from "../components/CopyRow";
import ShareMessage from "../components/ShareMessage";
import TokenPicker, { selectedToken } from "../components/TokenPicker";
import { useStoreWallet } from "../components/Wallet/walletContext";
import { useFrontendProvider } from "../components/client/provider/providerContext";
import { Strk20Networks } from "@/lib/constants";
import { claimLeaves, committedLeaves, computeDropId, passwordPreimage, randomFelt, refundHash } from "@/lib/crypto";
import { merkleRoot } from "@/lib/merkle";
import { claimUrl, savePack, backupPlaintext, downloadBackup, shareCopy } from "@/lib/storage";
import {
  createCalldata,
  errorResult,
  helperOrThrow,
  submitStrk20,
  busyCtaLabel,
  type ActionResult,
} from "@/lib/strk20";
import { labelAmount, parseAmount, tokensForNetwork } from "@/lib/tokens";

/** Refund is the only way back, and it needs expiry to pass. A typo here would park funds for years. */
const MAX_DAYS = 30;

export default function CreatePage() {
  const account = useStoreWallet((s) => s.myWalletAccount);
  const connected = useStoreWallet((s) => s.isConnected);
  const index = useFrontendProvider((s) => s.currentFrontendProviderIndex);

  const known = tokensForNetwork(index);
  const [tokenId, setTokenId] = useState(known[0]?.id ?? "strk");
  const [customAddr, setCustomAddr] = useState("");
  const [customDecimals, setCustomDecimals] = useState<number | null>(null);
  const [total, setTotal] = useState(known[0]?.shieldDefault ?? "1");
  const [count, setCount] = useState("6");
  const [days, setDays] = useState("1");
  const [password, setPassword] = useState("lucky");
  const [split, setSplit] = useState<"equal" | "random">("random");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [created, setCreated] = useState<{
    dropId: string;
    password: string;
    refundSecret: string;
    share: string;
    amountLabel: string;
    slots: number;
    network: string;
  } | null>(null);

  useEffect(() => {
    const list = tokensForNetwork(index);
    if (tokenId !== "custom" && !list.some((t) => t.id === tokenId)) {
      const first = list[0];
      if (first) {
        setTokenId(first.id);
        setTotal(first.shieldDefault);
      }
    }
  }, [index, tokenId]);

  const token = useMemo(
    () => selectedToken(index, tokenId, customAddr, customDecimals),
    [index, tokenId, customAddr, customDecimals],
  );

  function pickToken(id: string) {
    setTokenId(id);
    if (id !== "custom") {
      const t = tokensForNetwork(index).find((x) => x.id === id);
      if (t) setTotal(t.shieldDefault);
    }
  }

  async function onCreate() {
    setResult(null);
    setCreated(null);
    if (!account) {
      setResult(errorResult("Connect a wallet first"));
      return;
    }
    if (tokenId === "custom" && !customAddr.trim()) {
      setResult(errorResult("Paste a token contract address"));
      return;
    }
    if (tokenId === "custom" && customDecimals === null) {
      setResult(errorResult("Could not read token decimals. Check the contract address."));
      return;
    }
    if (!token) {
      setResult(errorResult("Pick a shieldable token, or paste a contract address"));
      return;
    }
    let helper: string;
    try {
      helper = helperOrThrow(index);
      num.toBigInt(token.address);
    } catch (e: unknown) {
      setResult(errorResult(e));
      return;
    }

    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      setResult(errorResult("Share count must be 1-50"));
      return;
    }
    const dayN = Number(days);
    if (!Number.isFinite(dayN) || dayN < 1 || dayN > MAX_DAYS) {
      setResult(errorResult(`Expiry must be between 1 and ${MAX_DAYS} days`));
      return;
    }

    let amount: bigint;
    let preimage: string;
    try {
      amount = parseAmount(total, token.decimals);
      if (amount < BigInt(n)) {
        setResult(errorResult("Total is too small. Each share needs a little."));
        return;
      }
      if (amount > (1n << 128n) - 1n) {
        setResult(errorResult("Total is too large for the on-chain amount limit."));
        return;
      }
      preimage = passwordPreimage(password);
    } catch (e: unknown) {
      setResult(errorResult(e));
      return;
    }

    setBusy(true);
    try {
      const refundSecret = randomFelt();
      const refundCommitment = num.toHex(refundHash(refundSecret));
      const root = merkleRoot(committedLeaves(claimLeaves(preimage, n)));
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Math.floor(dayN * 86400));
      const random = split === "random";
      const id = computeDropId({
        merkleRoot: root,
        refundCommitment,
        token: token.address,
        amount,
        slots: n,
        expiry,
        random,
      });

      const calldata = createCalldata({
        dropId: id,
        token: token.address,
        amount,
        slots: n,
        expiry,
        refundCommitment,
        merkleRoot: root,
        random,
      });

      const actions: WALLET_API.STRK20_ACTION[] = [
        { type: "withdraw", token: token.address, amount: num.toHex(amount), recipient: helper },
        { type: "invoke", contract: helper, calldata },
      ];

      const tx = await submitStrk20(account, index, actions, labelAmount(amount, token), setResult);
      if (!tx?.hash) return;
      if (!tx.confirmed && typeof tx.revertReason === "string") return;

      savePack({
        dropId: id,
        network: Strk20Networks[index] ?? String(index),
        token: token.address,
        decimals: token.decimals,
        total: amount.toString(),
        slots: n,
        expiry: Number(expiry),
        password: password.trim(),
        refundSecret,
        random,
        createdAt: Date.now(),
        creator: account.address,
      });
      setCreated({
        dropId: id,
        password: password.trim(),
        refundSecret,
        share: claimUrl(window.location.origin, id, password.trim()),
        amountLabel: labelAmount(amount, token),
        slots: n,
        network: Strk20Networks[index] ?? String(index),
      });
    } catch (e: unknown) {
      setResult(errorResult(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className={styles.h1}>Seal a Redpacket</h1>
      <p className={styles.note}>
        Shield on the home page first. Then seal from that shielded balance. Share only the claim link. Keep the refund secret — unclaimed funds come back only if you refund after expiry with the same wallet.
      </p>
      <div className={styles.panel}>
        <label className={styles.label}>Password</label>
        <p className={styles.hint}>Share this with people who should claim. It is not written on-chain.</p>
        <input className={styles.field} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        <TokenPicker
          index={index}
          selectedId={tokenId}
          customAddress={customAddr}
          onSelect={pickToken}
          onCustomAddress={setCustomAddr}
          onCustomDecimals={setCustomDecimals}
        />
        <p className={styles.hint}>Deducted from your shielded balance. Public-wallet funds must be shielded on the home page first.</p>
        <label className={styles.label}>Total ({token?.symbol ?? "TOKEN"})</label>
        <input className={styles.field} value={total} onChange={(e) => setTotal(e.target.value)} disabled={busy} />
        <div className={styles.row2}>
          <div>
            <label className={styles.label}>Shares</label>
            <p className={styles.hint}>1–50. Each wallet can claim once.</p>
            <input className={styles.field} value={count} onChange={(e) => setCount(e.target.value)} disabled={busy} />
          </div>
          <div>
            <label className={styles.label}>Expiry (days)</label>
            <p className={styles.hint}>1–{MAX_DAYS}. It does not auto-refund. Use the same wallet to refund after expiry.</p>
            <input className={styles.field} value={days} onChange={(e) => setDays(e.target.value)} disabled={busy} />
          </div>
        </div>
        <label className={styles.label}>Split</label>
        <div className={styles.seg}>
          <button className={split === "equal" ? styles.on : ""} onClick={() => setSplit("equal")} type="button" disabled={busy}>
            Equal
          </button>
          <button className={split === "random" ? styles.on : ""} onClick={() => setSplit("random")} type="button" disabled={busy}>
            Random
          </button>
        </div>
        <div className={styles.segCaptions}>
          <p>Same amount each claim. Last claim takes any remainder</p>
          <p>Different amounts. Last claim takes the rest</p>
        </div>
        {connected ? (
          <button className={styles.btnCta} disabled={busy || (tokenId === "custom" && customDecimals === null)} onClick={onCreate}>
            {busyCtaLabel(result, "Seal from shielded balance")}
          </button>
        ) : (
          <SelectWallet variant="cta" />
        )}
        {result ? <Receipt r={result} /> : null}
        {created ? (
          <div>
            <ShareMessage
              text={shareCopy({
                share: created.share,
                password: created.password,
                amountLabel: created.amountLabel,
                slots: created.slots,
                network: created.network,
              })}
            />
            <div className={styles.backup}>
              <div className={styles.backupTitle}>Back this up now. Another browser will not have it.</div>
              <p className={styles.warn}>
                Redpacket ID is for people who only have the password. The refund secret is yours: after expiry, use the <strong>same wallet</strong> to return unclaimed funds to your shielded balance. Download or copy a backup before you close this tab.
              </p>
              {created.share.includes("localhost") ? (
                <p className={styles.warn}>
                  This claim link uses localhost. It only opens on this computer. Replace the host with your public URL before sending it to anyone else.
                </p>
              ) : null}
              <CopyRow
                label="Claim link"
                value={created.share}
                hint="This is enough to send. It already includes the Redpacket ID and password."
              />
              <CopyRow label="Redpacket ID" value={created.dropId} hint="Needed on the claim page if someone has the password but not the link." wrap />
              <CopyRow label="Password" value={created.password} />
              <CopyRow
                label="Refund secret"
                value={created.refundSecret}
                hint="Do not send this with the claim link. If you lose it, unclaimed funds may be stuck after expiry."
                wrap
              />
              <div className={styles.backupActions}>
                <button
                  className={styles.copy}
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      backupPlaintext({
                        dropId: created.dropId,
                        password: created.password,
                        refundSecret: created.refundSecret,
                        share: created.share,
                      }),
                    )
                  }
                >
                  Copy full backup
                </button>
                <button
                  className={styles.copy}
                  type="button"
                  onClick={() =>
                    downloadBackup(
                      `redpacket-${created.dropId.slice(0, 10)}.txt`,
                      backupPlaintext({
                        dropId: created.dropId,
                        password: created.password,
                        refundSecret: created.refundSecret,
                        share: created.share,
                      }),
                    )
                  }
                >
                  Download backup file
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
