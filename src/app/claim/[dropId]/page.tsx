"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { WALLET_API } from "@starknet-io/types-js";
import { num } from "starknet";
import styles from "../../app.module.css";
import Shell from "../../components/Shell";
import Receipt from "../../components/Receipt";
import SelectWallet from "../../components/client/SelectWallet";
import { useStoreWallet } from "../../components/Wallet/walletContext";
import { useFrontendProvider } from "../../components/client/provider/providerContext";
import { myFrontendProviders } from "@/lib/constants";
import { claimLeaves, committedLeaves, creatorHash, passwordPreimage } from "@/lib/crypto";
import { merkleHeight, merkleProof, merkleVerify } from "@/lib/merkle";
import { fetchClaimed, fetchClaimedAmount, fetchPack, fetchTokenDecimals, findUnusedShare } from "@/lib/onchain";
import { passwordFromHash } from "@/lib/storage";
import {
  claimCalldata,
  errorResult,
  helperOrThrow,
  submitStrk20,
  busyCtaLabel,
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
  const [creatorHashOnchain, setCreatorHashOnchain] = useState("0x0");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [payout, setPayout] = useState<bigint | null>(null);

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
        setStatus("This Redpacket is not on-chain yet. Check the network, or wait for the create tx to confirm.");
        return;
      }
      setExists(true);
      setRemaining(pack.remaining);
      setSlotsLeft(pack.slotsLeft);
      setExpiry(Number(pack.expiry));
      setTokenAddr(pack.token);
      setCreatorHashOnchain(pack.creatorHash);
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
        setJustClaimed(false);
        setPayout(null);
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
      setResult(errorResult("Redpacket token not loaded yet"));
      return;
    }
    try {
      if (num.toBigInt(creatorHashOnchain) !== 0n && num.toBigInt(creatorHashOnchain) === num.toBigInt(creatorHash(address))) {
        setResult(errorResult("This wallet sealed this Redpacket. Connect a different account to claim a share."));
        return;
      }
    } catch {
      /* if the hash cannot be compared, live pack below still decides */
    }
    let helper: string;
    let preimage: string;
    try {
      helper = helperOrThrow(index);
      preimage = passwordPreimage(password);
    } catch (e: unknown) {
      setResult(errorResult(e));
      return;
    }
    setBusy(true);
    try {
      const provider = myFrontendProviders[index] as any;
      const live = await fetchPack(provider, index, dropId);
      if (!live?.exists || live.slotsLeft === 0) {
        setResult(errorResult("No shares left on this Redpacket."));
        return;
      }
      try {
        if (num.toBigInt(live.creatorHash) !== 0n && num.toBigInt(live.creatorHash) === num.toBigInt(creatorHash(address))) {
          setResult(errorResult("This wallet sealed this Redpacket. Connect a different account to claim a share."));
          return;
        }
      } catch {
        /* if the hash cannot be compared, let the chain decide */
      }
      if (!Number.isInteger(live.slots) || live.slots < 1 || live.slots > 50) {
        setResult(errorResult("This Redpacket was created with an older app version. Seal a new one on the current network."));
        return;
      }
      const tickets = claimLeaves(preimage, live.slots);
      const committed = committedLeaves(tickets);
      const expectedHeight = merkleHeight(live.slots);
      let tx: Awaited<ReturnType<typeof submitStrk20>>;
      for (let attempt = 0; attempt < 4; attempt++) {
        const share = await findUnusedShare(provider, index, dropId, tickets);
        if (share.kind === "all-used") {
          setResult(errorResult("All shares have already been claimed."));
          return;
        }
        if (share.kind === "unreadable") {
          setResult(
            errorResult(
              "Could not read which shares are still open. Wait a few seconds and try again — sending now would waste a fee.",
            ),
          );
          return;
        }
        const idx = share.index;
        const proof = merkleProof(committed, idx);
        if (proof.length !== expectedHeight || !merkleVerify(committed[idx], proof, live.merkleRoot)) {
          setResult(errorResult("Wrong password, or this Redpacket is from an older app version."));
          return;
        }
        const calldata = claimCalldata({
          dropId,
          leaf: tickets[idx],
          proof,
        });
        const actions: WALLET_API.STRK20_ACTION[] = [
          { type: "transfer", token: tokenAddr, amount: "OPEN", recipient: address },
          { type: "invoke", contract: helper, calldata },
        ];
        tx = await submitStrk20(account, index, actions, "Claim into shielded balance", setResult);
        if (!tx) return;
        if (tx.confirmed) break;
        if (!/LEAF_ALREADY_USED/i.test(tx.revertReason ?? "")) return;
      }
      if (!tx?.confirmed) return;
      setClaimed(true);
      setJustClaimed(true);
      setPayout(await fetchClaimedAmount(provider, index, tx.hash, dropId));
      const pack = await fetchPack(provider, index, dropId);
      if (pack?.exists) {
        setRemaining(pack.remaining);
        setSlotsLeft(pack.slotsLeft);
        setStatus("Claim landed in your shielded balance.");
      }
    } catch (e: unknown) {
      setResult(errorResult(e));
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
        label="Redpacket ID"
        value={dropId}
        hint="This identifies the Redpacket. The same password can be used on more than one, so the ID has to match."
        wrap
      />
      <label className={styles.label}>Password</label>
      <p className={styles.hint}>
        Usually already in the link. Each wallet claims once. Funds go to your shielded balance, not your public wallet.
      </p>
      <input
        className={styles.field}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="lucky"
        disabled={busy}
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
      {expired ? <p className={styles.warn}>Expired. Claims are closed. Unclaimed funds go back to the sender, using the same wallet that created this Redpacket.</p> : null}
      {empty && !justClaimed ? <p className={styles.warn}>All shares claimed.</p> : null}
      {justClaimed ? (
        <p className={styles.okNote}>
          {payout !== null && tokenMeta
            ? `${labelAmount(payout, tokenMeta)} landed in this wallet’s shielded STRK20 balance. `
            : "This share landed in this wallet’s shielded STRK20 balance. "}
          Open Ready’s private balance, or check it on the <Link href="/">home page</Link>. This address cannot claim again.
        </p>
      ) : claimed ? (
        <p className={styles.note}>This wallet already claimed. No second claim.</p>
      ) : connected ? (
        <button className={styles.btnCta} disabled={busy || expired || empty || !exists} onClick={onClaim}>
          {busyCtaLabel(result, "Claim into shielded balance")}
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
        Each wallet can claim a given Redpacket once. Funds go to your shielded balance, not your public wallet. Enable private tokens in Ready on this network before you claim.
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
