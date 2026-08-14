import { ProviderInterface, RpcProvider, constants as SNconstants, num } from "starknet";

export const ADDR_STRK =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const POOL_MAINNET =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";
export const POOL_SEPOLIA =
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";

function alchemyUrl(network: "mainnet" | "sepolia"): string {
  const key = process.env.PROVIDER_URL ?? "";
  const host = network === "mainnet" ? "starknet-mainnet" : "starknet-sepolia";
  return `https://${host}.g.alchemy.com/starknet/version/rpc/v0_10/${key}`;
}

function rpcUrl(network: "mainnet" | "sepolia"): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/rpc/${network}`;
  }
  return alchemyUrl(network);
}

export const myFrontendProviders: ProviderInterface[] = [
  new RpcProvider({ nodeUrl: rpcUrl("mainnet") }),
  new RpcProvider({
    nodeUrl: "https://starknet-testnet.public.blastapi.io/rpc/v0_7",
  }),
  new RpcProvider({ nodeUrl: rpcUrl("sepolia") }),
];

export const Strk20Networks: Record<number, string> = {
  0: "MAINNET",
  2: "SEPOLIA",
};

/** Map a wallet chain id (hex, SN_MAIN, or name) to a frontend provider index. Unknown → Mainnet. */
export function providerIndexForChain(chainId: unknown): number {
  if (chainId == null || chainId === "") return 0;
  const raw = String(chainId).trim();
  const upper = raw.toUpperCase();
  if (upper === "SN_MAIN" || upper === "SN_MAINNET" || upper === "MAINNET") return 0;
  if (upper === "SN_SEPOLIA" || upper.includes("SEPOLIA")) return 2;
  try {
    const n = num.toBigInt(raw);
    if (n === num.toBigInt(SNconstants.StarknetChainId.SN_MAIN)) return 0;
    if (n === num.toBigInt(SNconstants.StarknetChainId.SN_SEPOLIA)) return 2;
  } catch {
    /* not a hex id */
  }
  return 0;
}

export const REDPACKET_MAINNET =
  process.env.NEXT_PUBLIC_REDPACKET_MAINNET ??
  process.env.NEXT_PUBLIC_REDPOCKET_MAINNET ??
  process.env.NEXT_PUBLIC_SEALPACK_MAINNET ??
  "0x0671dfa406d914e9b422792b698b6cb8f585bc5f6ef789f31d65b46143fdaef5";
export const REDPACKET_SEPOLIA =
  process.env.NEXT_PUBLIC_REDPACKET_SEPOLIA ??
  process.env.NEXT_PUBLIC_REDPOCKET_SEPOLIA ??
  process.env.NEXT_PUBLIC_SEALPACK_SEPOLIA ??
  "0x04ec2a146f05c73ffc4ab6cbf482ef60847499515d8c44be622a6007ffd0c588";

export function poolForIndex(index: number): string {
  if (index === 0) return POOL_MAINNET;
  if (index === 2) return POOL_SEPOLIA;
  return "0x0";
}

export function helperForIndex(index: number): string {
  if (index === 0) return REDPACKET_MAINNET;
  if (index === 2) return REDPACKET_SEPOLIA;
  return "0x0";
}

export const DROP_ID_TAG = "SEALPACK_DROP:V1";
export const REFUND_TAG = "SEALPACK_REFUND:V1";

export const DECIMALS = 18n;
export const ONE_STRK = 10n ** DECIMALS;
