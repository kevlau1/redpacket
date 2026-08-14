"use client";
import styles from "../../app.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { useFrontendProvider } from "./provider/providerContext";
import { useEffect, useState } from "react";
import { WalletAccountV6, validateAndParseAddress, walletV6 } from "starknet";
import { WALLET_API } from "@starknet-io/types-js";
import { myFrontendProviders, providerIndexForChain } from "@/lib/constants";
import { friendlyError } from "@/lib/strk20";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";

function normalizeId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function SelectWallet({ variant = "nav" }: { variant?: "nav" | "cta" }) {
  const setMyWallet = useStoreWallet((s) => s.setMyStarknetWalletObject);
  const setMyWalletAccount = useStoreWallet((s) => s.setMyWalletAccount);
  const StarknetWalletObject = useStoreWallet((s) => s.StarknetWalletObject);
  const { setCurrentFrontendProviderIndex } = useFrontendProvider((s) => s);
  const isConnected = useStoreWallet((s) => s.isConnected);
  const setConnected = useStoreWallet((s) => s.setConnected);
  const disconnect = useStoreWallet((s) => s.disconnect);
  const address = useStoreWallet((s) => s.address);
  const setChain = useStoreWallet((s) => s.setChain);
  const setAddressAccount = useStoreWallet((s) => s.setAddressAccount);

  const [connecting, setConnecting] = useState(false);
  const [connectingName, setConnectingName] = useState("");
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wallets, setWallets] = useState<WalletWithStarknetFeatures[]>([]);

  useEffect(() => {
    const store: Store = createStore({ eip1193Adapters: [] });
    setWallets(store.getWallets().slice());
    const unsub = store.subscribe((next) => setWallets(next.slice()));
    return () => unsub();
  }, []);

  const pickable = wallets.filter((w) => {
    const id = normalizeId(w.name);
    return !id.includes("metamask") && !id.includes("braavos");
  });

  async function handleSelectedWallet(selectedWallet: WalletWithStarknetFeatures) {
    setMyWallet(selectedWallet);
    const result = await walletV6.requestAccounts(selectedWallet);
    if (typeof result === "string") {
      throw new Error(result);
    }
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("user rejected the request");
    }
    setAddressAccount(validateAndParseAddress(result[0]));
    const isConnectedWallet = await walletV6
      .getPermissions(selectedWallet)
      .then((res: any) => (res as WALLET_API.Permission[]).includes(WALLET_API.Permission.ACCOUNTS));
    setConnected(isConnectedWallet);
    if (!isConnectedWallet) {
      throw new Error("Ready did not grant account access. Approve the connection and try again.");
    }
    const chainId = String(await walletV6.requestChainId(selectedWallet));
    setChain(chainId);
    const providerIndex = providerIndexForChain(chainId);
    setCurrentFrontendProviderIndex(providerIndex);
    const myWA = await WalletAccountV6.connect(myFrontendProviders[providerIndex], selectedWallet);
    setMyWalletAccount(myWA);
  }

  useEffect(() => {
    if (!isConnected || !StarknetWalletObject) return;
    const wallet = StarknetWalletObject;
    let cancelled = false;
    let lastIndex = useFrontendProvider.getState().currentFrontendProviderIndex;

    async function syncFromWallet() {
      try {
        const chainId = String(await walletV6.requestChainId(wallet));
        if (cancelled) return;
        const idx = providerIndexForChain(chainId);
        if (idx === lastIndex) return;
        lastIndex = idx;
        setChain(chainId);
        setCurrentFrontendProviderIndex(idx);
        const myWA = await WalletAccountV6.connect(myFrontendProviders[idx], wallet);
        if (!cancelled) setMyWalletAccount(myWA);
      } catch {
        /* wallet may be mid-switch */
      }
    }

    void syncFromWallet();
    let unsub: (() => void) | undefined;
    try {
      unsub = walletV6.subscribeWalletEvent(wallet, () => {
        void syncFromWallet();
      });
    } catch {
      /* older wallets */
    }
    const timer = window.setInterval(() => {
      void syncFromWallet();
    }, 5000);
    return () => {
      cancelled = true;
      unsub?.();
      window.clearInterval(timer);
    };
  }, [isConnected, StarknetWalletObject, setChain, setCurrentFrontendProviderIndex, setMyWalletAccount]);

  async function selectWallet(w: WalletWithStarknetFeatures) {
    setError("");
    setConnecting(true);
    setConnectingName(w.name);
    try {
      await handleSelectedWallet(w);
      setPickerOpen(false);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setConnecting(false);
      setConnectingName("");
    }
  }

  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  const picker = pickerOpen ? (
    <div className={styles.modalOverlay} onClick={() => !connecting && setPickerOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>Connect wallet</span>
          <button
            className={styles.modalClose}
            onClick={() => setPickerOpen(false)}
            disabled={connecting}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {pickable.length ? (
          <div className={styles.walletList}>
            {pickable.map((w) => (
              <button
                key={w.name}
                className={styles.walletRow}
                onClick={() => selectWallet(w)}
                disabled={connecting}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.walletIcon} src={w.icon} alt="" />
                <span className={styles.walletName}>{w.name}</span>
                {connecting && connectingName === w.name ? (
                  <span className={styles.walletStatus}>Connecting…</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.walletHint}>
            No Starknet wallet detected. Install{" "}
            <a href="https://www.ready.co/" target="_blank" rel="noreferrer">
              Ready
            </a>
            .
          </div>
        )}
        {connecting ? (
          <p className={styles.walletHint}>Approve the connection in Ready. Keep this tab open.</p>
        ) : null}
        {error ? <div className={styles.errorText}>{error}</div> : null}
      </div>
    </div>
  ) : null;

  if (variant === "cta") {
    return (
      <>
        <button className={styles.btnCta} disabled={connecting} onClick={() => setPickerOpen(true)}>
          {connecting ? "Connecting…" : "Connect Ready wallet"}
        </button>
        {picker}
      </>
    );
  }

  if (isConnected && address) {
    return (
      <>
        <button
          className={styles.addrPill}
          onClick={() => {
            disconnect();
            setCurrentFrontendProviderIndex(0);
          }}
          title="Disconnect"
        >
          <span className={styles.addrDot} />
          {shortAddr}
        </button>
        {picker}
      </>
    );
  }

  return (
    <>
      <button className={styles.connectPill} disabled={connecting} onClick={() => setPickerOpen(true)}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {picker}
    </>
  );
}
