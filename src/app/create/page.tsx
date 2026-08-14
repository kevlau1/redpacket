"use client";

import { useEffect, useMemo, useState } from "react";
import type { WALLET_API } from "@starknet-io/types-js";
import { num } from "starknet";
import styles from "../app.module.css";
import Shell from "../components/Shell";
import Receipt from "../components/Receipt";
import SelectWallet from "../components/client/SelectWallet";
import CopyRow from "../components/CopyRow";
import TokenPicker, { selectedToken } from "../components/TokenPicker";
import { useStoreWallet } from "../components/Wallet/walletContext";
import { useFrontendProvider } from "../components/client/provider/providerContext";
import { Strk20Networks } from "@/lib/constants";
import { computeDropId, passwordHash, passwordPreimage, randomFelt, refundHash } from "@/lib/crypto";
import { claimUrl, savePack } from "@/lib/storage";
import {
  createCalldata,
  errorResult,
  helperOrThrow,
  submitStrk20,
  type ActionResult,
} from "@/lib/strk20";
import { labelAmount, parseAmount, tokensForNetwork } from "@/lib/tokens";

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
    } catch (e: any) {
      setResult(errorResult(e.message ?? "Invalid token address"));
      return;
    }

    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      setResult(errorResult("Share count must be 1-50"));
      return;
    }
    const dayN = Number(days);
    if (!Number.isFinite(dayN) || dayN < 1) {
      setResult(errorResult("Expiry must be at least 1 day"));
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
      preimage = passwordPreimage(password);
    } catch (e: any) {
      setResult(errorResult(e.message ?? "Invalid input"));
      return;
    }

    setBusy(true);
    try {
      const refundSecret = randomFelt();
      const refundCommitment = num.toHex(refundHash(refundSecret));
      const passHash = passwordHash(preimage);
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Math.floor(dayN * 86400));
      const random = split === "random";
      const id = computeDropId({
        passwordHash: passHash,
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
        passwordHash: passHash,
        random,
      });

      const actions: WALLET_API.STRK20_ACTION[] = [
        { type: "withdraw", token: token.address, amount: num.toHex(amount), recipient: helper },
        { type: "invoke", contract: helper, calldata },
      ];

      const tx = await submitStrk20(account, index, actions, labelAmount(amount, token), setResult);
      if (!tx) return;

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
      });
      setCreated({
        dropId: id,
        password: password.trim(),
        refundSecret,
        share: claimUrl(window.location.origin, id, password.trim()),
      });
    } catch (e: any) {
      setResult(errorResult(e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className={styles.h1}>Seal a Redpocket</h1>
      <p className={styles.note}>
        Share the claim link in chat. Each wallet can claim a Redpocket once. Funds go to a shielded balance. One token per Redpocket. Shield tokens into the privacy pool first.
      </p>
      <div className={styles.panel}>
        <label className={styles.label}>Password</label>
        <p className={styles.hint}>The passphrase you send to the group. After the first claim, on-chain observers can see it too.</p>
        <input className={styles.field} value={password} onChange={(e) => setPassword(e.target.value)} />
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
        <input className={styles.field} value={total} onChange={(e) => setTotal(e.target.value)} />
        <div className={styles.row2}>
          <div>
            <label className={styles.label}>Shares</label>
            <p className={styles.hint}>1-50. Each address can claim 1 share.</p>
            <input className={styles.field} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Expiry (days)</label>
            <p className={styles.hint}>It does not auto-refund. Use the same wallet to refund after expiry.</p>
            <input className={styles.field} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        <label className={styles.label}>Split</label>
        <p className={styles.hint}>Random uses a WeChat-style split. Equal remainder goes to the last share.</p>
        <div className={styles.seg}>
          <button className={split === "equal" ? styles.on : ""} onClick={() => setSplit("equal")} type="button">
            Equal
          </button>
          <button className={split === "random" ? styles.on : ""} onClick={() => setSplit("random")} type="button">
            Random
          </button>
        </div>
        {connected ? (
          <button className={styles.btnCta} disabled={busy || (tokenId === "custom" && customDecimals === null)} onClick={onCreate}>
            {busy ? "Waiting for wallet…" : "Seal from shielded balance"}
          </button>
        ) : (
          <SelectWallet variant="cta" />
        )}
        {result ? <Receipt r={result} /> : null}
        {created ? (
          <div className={styles.backup}>
            <div className={styles.backupTitle}>Back this up now. Another browser will not have it.</div>
            <p className={styles.warn}>
              Redpocket ID is for people who only have the password. The refund secret is yours: after expiry, use the <strong>same wallet</strong> to pull leftovers back into stealth.
            </p>
            <CopyRow
              label="Claim link"
              value={created.share}
              hint="This one line is enough for the group. It already includes Redpocket ID and password."
            />
            <CopyRow label="Redpocket ID" value={created.dropId} hint="If someone only has the password, they still need this on the claim page." wrap />
            <CopyRow label="Password" value={created.password} />
            <CopyRow
              label="Refund secret"
              value={created.refundSecret}
              hint="Do not send this to the group. If you lose it and switch devices, leftover funds may be unrecoverable."
              wrap
            />
            <button
              className={styles.copy}
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(
                  [
                    `Claim link: ${created.share}`,
                    `Redpocket ID: ${created.dropId}`,
                    `Password: ${created.password}`,
                    `Refund secret: ${created.refundSecret}`,
                  ].join("\n"),
                )
              }
            >
              Copy full backup
            </button>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
