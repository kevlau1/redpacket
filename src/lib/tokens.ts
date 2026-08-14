import { num } from "starknet";

export type TokenDef = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Frontend provider index → address. Missing means not listed on that net. */
  address: Partial<Record<number, string>>;
  shieldDefault: string;
};

/** Tokens wallets actually Shield today, plus ETH. Addresses are network-specific. */
export const KNOWN_TOKENS: TokenDef[] = [
  {
    id: "strk",
    symbol: "STRK",
    name: "Starknet Token",
    decimals: 18,
    address: {
      0: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
      2: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    },
    shieldDefault: "1",
  },
  {
    id: "btc",
    symbol: "strkBTC",
    name: "strkBTC",
    decimals: 8,
    address: {
      0: "0x0787150e306e6eae6e3f79dea881770e8bbff2c1b8eb490f969669ee945b3135",
    },
    shieldDefault: "0.0001",
  },
  {
    id: "wbtc",
    symbol: "WBTC",
    name: "Wrapped BTC",
    decimals: 8,
    address: {
      0: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
      2: "0x00452bd5c0512a61df7c7be8cfea5e4f893cb40e126bdc40aee6054db955129e",
    },
    shieldDefault: "0.0001",
  },
  {
    id: "usdc",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: {
      0: "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
      2: "0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343",
    },
    shieldDefault: "1",
  },
  {
    id: "usdc-e",
    symbol: "USDC.e",
    name: "Bridged USDC",
    decimals: 6,
    address: {
      0: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
    },
    shieldDefault: "1",
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    address: {
      0: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      2: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    },
    shieldDefault: "0.01",
  },
];

export type ResolvedToken = {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  id: string;
  shieldDefault: string;
};

function sameAddr(a: string, b: string): boolean {
  try {
    return num.toBigInt(a) === num.toBigInt(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

export function tokensForNetwork(index: number): ResolvedToken[] {
  const out: ResolvedToken[] = [];
  for (const t of KNOWN_TOKENS) {
    const address = t.address[index];
    if (!address) continue;
    out.push({
      id: t.id,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      address,
      shieldDefault: t.shieldDefault,
    });
  }
  return out;
}

export function resolveToken(address: string, index: number): ResolvedToken {
  const known = tokensForNetwork(index).find((t) => sameAddr(t.address, address));
  if (known) return known;
  return {
    id: "custom",
    symbol: "TOKEN",
    name: "Custom ERC-20",
    decimals: 18,
    address,
    shieldDefault: "1",
  };
}

export function parseAmount(input: string, decimals: number): bigint {
  const t = input.trim();
  if (!t || !/^\d+(\.\d+)?$/.test(t)) throw new Error("Invalid amount");
  const [w, f = ""] = t.split(".");
  if (f.length > decimals) throw new Error(`At most ${decimals} decimal places`);
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w) * 10n ** BigInt(decimals) + (decimals ? BigInt(frac) : 0n);
}

export function labelAmount(amount: bigint, token: { decimals: number; symbol: string }, digits = 6): string {
  return `${fmtAmount(amount, token.decimals, digits)} ${token.symbol}`;
}

export function fmtAmount(amount: bigint, decimals: number, digits = 6): string {
  const neg = amount < 0n;
  const a = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = a / base;
  const frac = decimals
    ? (a % base).toString().padStart(decimals, "0").replace(/0+$/, "")
    : "";
  const shown = frac
    ? `${whole}.${frac.slice(0, digits).replace(/0+$/, "") || "0"}`
    : `${whole}`;
  return (neg ? `-${shown}` : shown).replace(/\.$/, "");
}
