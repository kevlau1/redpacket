import { DECIMALS } from "./constants";
import { fmtAmount } from "./tokens";

/** Network fee is paid in STRK (18 decimals). */
export function fmtStrk(amount: bigint, digits = 4): string {
  return fmtAmount(amount, Number(DECIMALS), digits);
}

export function shortHex(h: string): string {
  const hex = h.startsWith("0x") ? h : `0x${h}`;
  return hex.length <= 13 ? hex : `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

export function fmtExpiry(unix: number): string {
  if (!unix) return "n/a";
  return new Date(unix * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
