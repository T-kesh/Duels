import { beforeEach, describe, expect, it } from "vitest";
import { getNames, normalizeDisplayName, setName } from "./nameStore";

// No Redis env in tests, so these exercise the in-memory fallback path.
const ADDR_A = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const ADDR_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

beforeEach(() => {
  const g = globalThis as typeof globalThis & {
    __DUEL_NAME_STORE__?: Map<string, string>;
    __DUEL_NAME_OWNER__?: Map<string, string>;
  };
  g.__DUEL_NAME_STORE__ = new Map();
  g.__DUEL_NAME_OWNER__ = new Map();
});

describe("normalizeDisplayName", () => {
  it("accepts valid names and trims whitespace", () => {
    expect(normalizeDisplayName("CardShark_7")).toBe("CardShark_7");
    expect(normalizeDisplayName("  abc  ")).toBe("abc");
  });

  it("rejects names that are too short, too long, or contain other characters", () => {
    expect(normalizeDisplayName("ab")).toBeNull();
    expect(normalizeDisplayName("a".repeat(17))).toBeNull();
    expect(normalizeDisplayName("has space")).toBeNull();
    expect(normalizeDisplayName("emoji🔥")).toBeNull();
    expect(normalizeDisplayName("<script>")).toBeNull();
    expect(normalizeDisplayName(42)).toBeNull();
    expect(normalizeDisplayName(null)).toBeNull();
  });
});

describe("setName / getNames", () => {
  it("sets and resolves a name keyed by lowercased address", async () => {
    const result = await setName(ADDR_A, "Shark");
    expect(result).toEqual({ ok: true, name: "Shark" });

    const names = await getNames([ADDR_A.toUpperCase().replace("0X", "0x"), ADDR_B]);
    expect(names[ADDR_A.toLowerCase()]).toBe("Shark");
    expect(names[ADDR_B.toLowerCase()]).toBeUndefined();
  });

  it("enforces case-insensitive uniqueness across addresses", async () => {
    await setName(ADDR_A, "Shark");
    const taken = await setName(ADDR_B, "shark");
    expect(taken).toEqual({ ok: false, error: "name_taken" });
  });

  it("lets the owner re-claim their own name with different casing", async () => {
    await setName(ADDR_A, "shark");
    const recased = await setName(ADDR_A, "SHARK");
    expect(recased).toEqual({ ok: true, name: "SHARK" });
  });

  it("releases the old name when switching to a new one", async () => {
    await setName(ADDR_A, "Shark");
    await setName(ADDR_A, "Whale");

    const reclaimed = await setName(ADDR_B, "Shark");
    expect(reclaimed).toEqual({ ok: true, name: "Shark" });

    const names = await getNames([ADDR_A, ADDR_B]);
    expect(names[ADDR_A.toLowerCase()]).toBe("Whale");
    expect(names[ADDR_B.toLowerCase()]).toBe("Shark");
  });

  it("rejects invalid names without claiming anything", async () => {
    const result = await setName(ADDR_A, "no good");
    expect(result).toEqual({ ok: false, error: "invalid_name" });
    const names = await getNames([ADDR_A]);
    expect(names[ADDR_A.toLowerCase()]).toBeUndefined();
  });
});
