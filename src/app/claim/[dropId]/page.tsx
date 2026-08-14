"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { WALLET_API } from "@starknet-io/types-js";
import styles from "../../app.module.css";
import Shell from "../../components/Shell";
import Receipt from "../../components/Receipt";
import SelectWallet from "../../components/client/SelectWallet";
import { useStoreWallet } from "../../components/Wallet/walletContext";
import { useFrontendProvider } from "../../components/client/provider/providerContext";
import { myFrontendProviders } from "@/lib/constants";
import { passwordPreimage } from "@/lib/crypto";
import { fetchClaimed, fetchPack, fetchTokenDecimals } from "@/lib/onchain";
import { passwordFromHash } from "@/lib/storage";
import {
  claimCalldata,
  errorResult,
  helperOrThrow,
  submitStrk20,
  type ActionResult,
} from "@/lib/strk20";
import { fmtExpiry } from "@/lib/format";
import { labelAmount, resolveToken } from "@/lib/tokens";
import CopyRow from "../../components/CopyRow";

function ClaimForm({ dropId }: { dropId: string }) {
  const search = useSearchParams();
  const account = useStoreWallet((s) => s.myWalletAccount);
  const connected = useStoreWallet((s) => s.isConnected);
  const address = useStoreWallet((s) => s.address);
  const index = useFrontendProvider((s) => s.currentFrontendProviderIndex);

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Reading on-chain status…");
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [remaining, setRemaining] = useState<bigint | null>(null);
  const [tokenAddr, setTokenAddr] = useState<string | null>(null);
  const [decimals, setDecimals] = useState(18);
  const [slotsLeft, setSlotsLeft] = useState<number | null>(null);
  const [expiry, setExpiry] = useState(0);
  const [exists, setExists] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hashPw = passwordFromHash(window.location.hash);
    const fromQuery = search.get("p");
    const pw = hashPw || fromQuery || "";
    if (fromQuery) {
      const next = `${window.location.pathname}#p=${encodeURIComponent(pw)}`;
      window.history.replaceState(null, "", next);
    }
    setPassword(pw);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!dropId) {
        setStatus("Open a claim link, or enter a password from the home page.");
        return;
      }
      const provider = myFrontendProviders[index] as any;
      const pack = await fetchPack(provider, index, dropId);
      if (cancelled) return;
      if (!pack?.exists) {
        setExists(false);
        setStatus("This Redpocket is not on-chain yet. Check the network, or wait for the create tx to confirm.");
        return;
      }
      setExists(true);
      setRemaining(pack.remaining);
      setSlotsLeft(pack.slotsLeft);
      setExpiry(Number(pack.expiry));
      setTokenAddr(pack.token);
      const known = resolveToken(pack.token, index);
      if (known.id === "custom") {
        const d = await fetchTokenDecimals(provider, pack.token);
        if (!cancelled && d !== null) setDecimals(d);
        else if (!cancelled) setDecimals(18);
      } else {
        setDecimals(known.decimals);
      }
      if (address) {
        const c = await fetchClaimed(provider, index, dropId, address);
        if (cancelled) return;
        setClaimed(c);
        setStatus(c ? "This address already claimed." : `${pack.slotsLeft} share${pack.slotsLeft === 1 ? "" : "s"} left.`);
      } else {
        setStatus(`${pack.slotsLeft} share${pack.slotsLeft === 1 ? "" : "s"} left. Enter the password to claim.`);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dropId, index, address]);

  async function onClaim() {
    if (!account || !address) {
      setResult(errorResult("Connect a wallet first"));
      return;
    }
    if (!tokenAddr) {
      setResult(errorResult("Redpocket token not loaded yet"));
      return;
    }
    let helper: string;
    let preimage: string;
    try {
      helper = helperOrThrow(index);
      preimage = passwordPreimage(password);
    } catch (e: any) {
      setResult(errorResult(e.message));
      return;
    }
    setBusy(true);
    try {
      const calldata = claimCalldata({ dropId, passwordPreimage: preimage });
      const actions: WALLET_API.STRK20_ACTION[] = [
        { type: "transfer", token: tokenAddr, amount: "OPEN", recipient: address },
        { type: "invoke", contract: helper, calldata },
      ];
      const tx = await submitStrk20(account, index, actions, "Redpocket", setResult);
      if (!tx) return;
      setClaimed(true);
    } catch (e: any) {
      setResult(errorResult(e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  const expired = expiry > 0 && Date.now() / 1000 > expiry;
  const empty = slotsLeft === 0;
  const tokenMeta = tokenAddr ? { ...resolveToken(tokenAddr, index), decimals } : null;

  return (
    <div className={styles.panel}>
      <CopyRow
        label="Redpocket ID"
        value={dropId}
        hint="On-chain id for this Redpocket. Right password, wrong ID, and you claim a different Redpocket or nothing."
        wrap
      />
      <label className={styles.label}>Password</label>
      <p className={styles.hint}>Usually already in the link. Each address claims once. The amount is split on the spot into your shielded balance.</p>
      <input
        className={styles.field}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="lucky"
      />
      <p className={styles.note}>{status}</p>
      {exists ? (
        <div className={styles.meta}>
          <span>
            Remaining{" "}
            {remaining === null || !tokenMeta ? "…" : labelAmount(remaining, tokenMeta)}
          </span>
          <span>{slotsLeft ?? "…"} shares · expires {fmtExpiry(expiry)}</span>
        </div>
      ) : null}
      {expired ? <p className={styles.warn}>Expired. On-chain claims are closed. Leftovers go back to the sender with the same wallet.</p> : null}
      {empty ? <p className={styles.warn}>All shares claimed.</p> : null}
      {claimed ? (
        <p className={styles.note}>This wallet already claimed. No second claim.</p>
      ) : connected ? (
        <button className={styles.btnCta} disabled={busy || expired || empty || !exists} onClick={onClaim}>
          {busy ? "Waiting for wallet…" : "Claim into stealth"}
        </button>
      ) : (
        <SelectWallet variant="cta" />
      )}
      {result ? <Receipt r={result} /> : null}
    </div>
  );
}

function ClaimInner() {
  const params = useParams<{ dropId?: string }>();
  const dropId = params.dropId ?? "";
  return (
    <Shell>
      <h1 className={styles.h1}>Enter a password to claim</h1>
      <p className={styles.note}>
        Each Starknet address can claim a Redpocket once. The amount is split on the spot into your shielded balance, not your public wallet.
      </p>
      <ClaimForm dropId={dropId} />
    </Shell>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={null}>
      <ClaimInner />
    </Suspense>
  );
}
