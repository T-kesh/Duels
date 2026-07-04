import { getAddress, isAddress } from "viem";

export function parsePlayerAddress(raw: unknown): string | null {
  if (typeof raw !== "string" || !isAddress(raw)) return null;
  return getAddress(raw).toLowerCase();
}
