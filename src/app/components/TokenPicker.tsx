"use client";

import { useEffect, useState } from "react";
import { num } from "starknet";
import styles from "../app.module.css";
import { myFrontendProviders } from "@/lib/constants";
import { fetchTokenDecimals } from "@/lib/onchain";
import { tokensForNetwork, type ResolvedToken } from "@/lib/tokens";

type Props = {
  index: number;
  selectedId: string;
  customAddress: string;
  onSelect: (id: string) => void;
  onCustomAddress: (address: string) => void;
  onCustomDecimals: (decimals: number | null) => void;
  allowCustom?: boolean;
};

export function selectedToken(
  index: number,
  selectedId: string,
  customAddress: string,
  customDecimals: number | null,
): ResolvedToken | null {
  if (selectedId === "custom") {
    const address = customAddress.trim();
    if (!address || customDecimals === null) return null;
    return {
      id: "custom",
      symbol: "TOKEN",
      name: "Custom ERC-20",
      decimals: customDecimals,
      address,
      shieldDefault: "1",
    };
  }
  return tokensForNetwork(index).find((t) => t.id === selectedId) ?? tokensForNetwork(index)[0] ?? null;
}

export default function TokenPicker({
  index,
  selectedId,
  customAddress,
  onSelect,
  onCustomAddress,
  onCustomDecimals,
  allowCustom = true,
}: Props) {
  const tokens = tokensForNetwork(index);
  const [customStatus, setCustomStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    if (selectedId !== "custom") {
      onCustomDecimals(null);
      setCustomStatus("idle");
      return;
    }
    const addr = customAddress.trim();
    if (!addr) {
      onCustomDecimals(null);
      setCustomStatus("idle");
      return;
    }
    let cancelled = false;
    setCustomStatus("loading");
    onCustomDecimals(null);
    (async () => {
      try {
        num.toBigInt(addr);
      } catch {
        if (!cancelled) {
          onCustomDecimals(null);
          setCustomStatus("error");
        }
        return;
      }
      const d = await fetchTokenDecimals(myFrontendProviders[index] as any, addr);
      if (cancelled) return;
      if (d === null) {
        onCustomDecimals(null);
        setCustomStatus("error");
        return;
      }
      onCustomDecimals(d);
      setCustomStatus("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, customAddress, index, onCustomDecimals]);

  return (
    <>
      <label className={styles.label}>Token</label>
      <p className={styles.hint}>Mainnet BTC is strkBTC. Sepolia uses WBTC. One Redpocket, one token.</p>
      <div className={styles.chips}>
        {tokens.map((t) => (
          <button
            key={t.id}
            type="button"
            className={selectedId === t.id ? styles.on : ""}
            onClick={() => onSelect(t.id)}
          >
            {t.symbol}
          </button>
        ))}
        {allowCustom ? (
          <button
            type="button"
            className={selectedId === "custom" ? styles.on : ""}
            onClick={() => onSelect("custom")}
          >
            Other
          </button>
        ) : null}
      </div>
      {selectedId === "custom" ? (
        <>
          <input
            className={styles.field}
            value={customAddress}
            onChange={(e) => onCustomAddress(e.target.value)}
            placeholder="Contract address 0x…"
          />
          {customStatus === "loading" ? (
            <p className={styles.hint}>Reading decimals from the contract…</p>
          ) : null}
          {customStatus === "error" ? (
            <p className={styles.warn}>Could not read decimals. Check the contract address.</p>
          ) : null}
          {customStatus === "ok" ? <p className={styles.hint}>Decimals confirmed on-chain.</p> : null}
        </>
      ) : null}
    </>
  );
}
