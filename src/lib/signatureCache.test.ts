import { describe, expect, it } from "vitest";
import { createAiDuelSession, getAiDuelSession, saveAiDuelSession } from "./duelSessionStore";
import { getPvpSession, savePvpSession } from "./pvpSessionStore";

describe("Session Store Caching", () => {
  it("persists and retrieves reward signature and decision in AI session", async () => {
    const duelId = "test-duel-123";
    const session = await createAiDuelSession(duelId, "0x1234567890123456789012345678901234567890");
    
    session.rewardSignatureIssued = true;
    session.rewardNonce = "0xnonce123";
    session.rewardSignature = "0xsig123";
    session.rewardDecision = {
      tier: "worthy",
      amountWei: "8000000000000000",
      flavor: "Nice job",
    };

    await saveAiDuelSession(session);

    const retrieved = await getAiDuelSession(duelId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.rewardSignatureIssued).toBe(true);
    expect(retrieved?.rewardNonce).toBe("0xnonce123");
    expect(retrieved?.rewardSignature).toBe("0xsig123");
    expect(retrieved?.rewardDecision?.tier).toBe("worthy");
    expect(retrieved?.rewardDecision?.amountWei).toBe("8000000000000000");
  });

  it("persists and retrieves resolve signature in PvP session", async () => {
    const duelId = "test-pvp-123";
    
    const session = {
      duelId,
      player1: "0x111",
      player2: "0x222",
      poolWins: 0,
      p1Hand: [],
      p2Hand: [],
      round: 1,
      transcript: [],
      roundDeadlineMs: 0,
      expiresAtMs: 0,
      resolveSignatureIssued: true,
      resolveNonce: "0xpvpnonce",
      resolveSignature: "0xpvpsig",
    };

    await savePvpSession(session);

    const retrieved = await getPvpSession(duelId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.resolveSignatureIssued).toBe(true);
    expect(retrieved?.resolveNonce).toBe("0xpvpnonce");
    expect(retrieved?.resolveSignature).toBe("0xpvpsig");
  });
});
