"use client";
import { create } from "zustand";
import { AccountInterface, ProviderInterface, type WalletAccountV6 } from "starknet";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";

export interface WalletState {
  StarknetWalletObject: WalletWithStarknetFeatures | undefined;
  setMyStarknetWalletObject: (wallet: WalletWithStarknetFeatures) => void;
  address: string;
  setAddressAccount: (address: string) => void;
  chain: string;
  setChain: (chain: string) => void;
  myWalletAccount: WalletAccountV6 | undefined;
  setMyWalletAccount: (myWAccount: WalletAccountV6) => void;
  account: AccountInterface | undefined;
  setAccount: (account: AccountInterface) => void;
  provider: ProviderInterface | undefined;
  setProvider: (provider: ProviderInterface) => void;
  isConnected: boolean;
  setConnected: (isConnected: boolean) => void;
  disconnect: () => void;
}

const empty: Pick<
  WalletState,
  | "StarknetWalletObject"
  | "address"
  | "chain"
  | "myWalletAccount"
  | "account"
  | "provider"
  | "isConnected"
> = {
  StarknetWalletObject: undefined,
  address: "",
  chain: "",
  myWalletAccount: undefined,
  account: undefined,
  provider: undefined,
  isConnected: false,
};

export const useStoreWallet = create<WalletState>()((set) => ({
  StarknetWalletObject: undefined,
  setMyStarknetWalletObject: (wallet) => set({ StarknetWalletObject: wallet }),
  address: "",
  setAddressAccount: (address) => set({ address }),
  chain: "",
  setChain: (chain) => set({ chain }),
  myWalletAccount: undefined,
  setMyWalletAccount: (myWAccount) => set({ myWalletAccount: myWAccount }),
  account: undefined,
  setAccount: (account) => set({ account }),
  provider: undefined,
  setProvider: (provider) => set({ provider }),
  isConnected: false,
  setConnected: (isConnected) => set({ isConnected }),
  disconnect: () => set({ ...empty }),
}));
