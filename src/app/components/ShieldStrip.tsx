"use client";

import { useEffect, useMemo, useState } from "react";
import type { WALLET_API } from "@starknet-io/types-js";
import { num } from "starknet";
import styles from "../app.module.css";
import { Strk20Networks } from "@/lib/constants";
import { errorResult, readBalances, readTokenBalance, submitStrk20, type ActionResult } from "@/lib/strk20";
import { fmtAmount, labelAmount, parseAmount, resolveToken, tokensForNetwork } from "@/lib/tokens";
import { useStoreWallet } from "./Wallet/walletContext";
import { useFrontendProvider } from "./client/provider/providerContext";
import Receipt from "./Receipt";
import SelectWallet from "./client/SelectWallet";
import TokenPicker, { selectedToken } from "./TokenPicker";

export default function ShieldStrip() {
  const account = useStoreWallet((s) => s.myWalletAccount);
  const connected = useStoreWallet((s) => s.isConnected);
  const index = useFrontendProvider((s) => s.currentFrontendProviderIndex);
  const known = tokensForNetwork(index);
  const [tokenId, setTokenId] = useState(known[0]?.id ?? "strk");
  const [customAddr, setCustomAddr] = useState("");
  const [customDecimals, setCustomDecimals] = useState<number | null>(null);
  const [amountStr, setAmountStr] = useState(known[0]?.shieldDefault ?? "1");
  const [bal, setBal] = useState<bigint | null>(null);
  const [held, setHeld] = useState<{ token: string; amount: bigint }[]>([]);
  const [result, setResult] = useState<ActionResult | null>(null);
  const okNet = Strk20Networks[index] !== undefined;

  const token = useMemo(
    () => selectedToken(index, tokenId, customAddr, customDecimals),
    [index, tokenId, customAddr, customDecimals],
  );

  useEffect(() => {
    const list = tokensForNetwork(index);
    if (tokenId !== "custom" && !list.some((t) => t.id === tokenId)) {
      const first = list[0];
      if (first) {
        setTokenId(first.id);
        setAmountStr(first.shieldDefault);
      }
    }
  }, [index, tokenId]);

  async function refresh() {
    if (!account) return;
    const all = await readBalances(account);
    setHeld(all.filter((b) => b.amount > 0n));
    if (token) {
      setBal(await readTokenBalance(account, token.address));
    } else {
      setBal(null);
    }
  }

  useEffect(() => {
    refresh();
  }, [account, connected, token?.address]);

  function pickToken(id: string) {
    setTokenId(id);
    if (id !== "custom") {
      const t = tokensForNetwork(index).find((x) => x.id === id);
      if (t) setAmountStr(t.shieldDefault);
    }
  }

  async function shield() {
    if (!account) {
      setResult(errorResult("Connect a wallet first"));
      return;
    }
    if (tokenId === "custom" && customDecimals === null) {
      setResult(errorResult("Could not read token decimals. Check the contract address."));
      return;
    }
    if (!token) {
      setResult(errorResult("Pick a token or paste a contract address"));
      return;
    }
    let amount: bigint;
    try {
      num.toBigInt(token.address);
      amount = parseAmount(amountStr, token.decimals);
      if (amount <= 0n) throw new Error("Amount must be greater than 0");
    } catch (e: any) {
      setResult(errorResult(e.message ?? "Invalid amount"));
      return;
    }
    const actions: WALLET_API.STRK20_ACTION[] = [
      { type: "deposit", token: token.address, amount: num.toHex(amount) },
    ];
    await submitStrk20(account, index, actions, labelAmount(amount, token), setResult);
    await refresh();
  }

  const headline =
    !token || bal === null
      ? connected
        ? "…"
        : "—"
      : labelAmount(bal, token);

  return (
    <div className={styles.panel} style={{ marginTop: 0 }}>
      <div className={styles.meta}>
        <span>Shielded balance (STRK20 pool)</span>
        <span className={okNet ? styles.ok : styles.bad}>
          {okNet ? Strk20Networks[index] : "Switch to Mainnet or Sepolia"}
        </span>
      </div>
      <TokenPicker
        index={index}
        selectedId={tokenId}
        customAddress={customAddr}
        onSelect={pickToken}
        onCustomAddress={setCustomAddr}
        onCustomDecimals={setCustomDecimals}
      />
      <div className={styles.h1} style={{ marginTop: 0 }}>
        {headline}
      </div>
      {held.length > 1 ? (
        <p className={styles.note}>
          {held
            .map((b) => {
              const t = resolveToken(b.token, index);
              return `${fmtAmount(b.amount, t.decimals)} ${t.symbol}`;
            })
            .join(" · ")}
        </p>
      ) : null}
      <p className={styles.note}>
        Sending deducts from shielded balance. Claims land there too. Shield public-wallet funds first. One address, one claim per Redpocket.
      </p>
      <label className={styles.label}>Shield amount ({token?.symbol ?? "TOKEN"})</label>
      <input className={styles.field} value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
      {connected ? (
        <button className={styles.btnCta} disabled={!okNet || (tokenId === "custom" && customDecimals === null)} onClick={shield}>
          Shield into the privacy pool
        </button>
      ) : (
        <SelectWallet variant="cta" />
      )}
      {result ? <Receipt r={result} /> : null}
    </div>
  );
}
