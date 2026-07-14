"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

export const NAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

type SetNameStatus = "idle" | "signing" | "saving" | "done" | "error";

/**
 * Resolves display names for a set of addresses and exposes a signed
 * set-name flow for the connected wallet (challenge → sign → save), mirroring
 * the start-duel auth pattern.
 */
export function usePlayerNames(addresses: string[]) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<SetNameStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Key the fetch on the sorted unique list so re-renders with the same
  // addresses (new array identity) don't refetch.
  const fetchKey = [...new Set(addresses.map((a) => a.toLowerCase()))].sort().join(",");
  const lastFetched = useRef<string | null>(null);

  useEffect(() => {
    if (!fetchKey || lastFetched.current === fetchKey) return;
    lastFetched.current = fetchKey;

    fetch(`/api/names?addresses=${encodeURIComponent(fetchKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.names) setNames((prev) => ({ ...prev, ...data.names }));
      })
      .catch(() => {
        // Names are cosmetic — leave the truncated-address fallback in place.
        lastFetched.current = null;
      });
  }, [fetchKey]);

  const setDisplayName = useCallback(
    async (rawName: string): Promise<boolean> => {
      if (!address) return false;

      const name = rawName.trim();
      if (!NAME_PATTERN.test(name)) {
        setError("3–16 characters: letters, numbers, underscores.");
        setStatus("error");
        return false;
      }

      setError(null);
      setStatus("signing");

      try {
        const challengeRes = await fetch("/api/profile/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, name }),
        });
        const challenge = await challengeRes.json();
        if (!challengeRes.ok) throw new Error(challenge.error ?? `HTTP ${challengeRes.status}`);

        let signature: string;
        try {
          signature = await signMessageAsync({ message: challenge.message });
        } catch {
          throw new Error("Signature request was rejected.");
        }

        setStatus("saving");

        const res = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, name, signature }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(
            payload.error === "name_taken"
              ? "That name is already taken."
              : payload.error === "invalid_name"
              ? "3–16 characters: letters, numbers, underscores."
              : payload.error === "rate_limit_exceeded"
              ? "Too many attempts — try again later."
              : "Could not save your name. Try again.",
          );
        }

        setNames((prev) => ({ ...prev, [address.toLowerCase()]: payload.name }));
        setStatus("done");
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your name. Try again.");
        setStatus("error");
        return false;
      }
    },
    [address, signMessageAsync],
  );

  const myName = address ? names[address.toLowerCase()] ?? null : null;

  return { names, myName, setDisplayName, status, error };
}
