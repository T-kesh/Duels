import type { Card } from "@/constants/cards";

// ── Combo Effect ────────────────────────────────────────────────────────────
export interface ComboEffect {
  /** Display name shown in the flash banner. */
  name: string;
  /** Emoji prefix for the banner. */
  emoji: string;
  /** Multiplicative bonus added to base damage (e.g. 0.15 = +15%). */
  bonusDamagePercent: number;
  /** Flat bonus shield added to the combo finisher card. */
  bonusShield: number;
  /**
   * If > 0, overrides the default lifesteal percentage for Drain cards.
   * e.g. 0.75 means heal for 75% of damage dealt instead of the default 50%.
   */
  bonusHealOverride: number;
  /** Short description for the card encyclopedia. */
  description: string;
  /** The base card ID that must be played on the previous turn (trigger). */
  triggerCardId?: string;
  /** The type that must be played on the previous turn (trigger by type). */
  triggerType?: string;
  /** The base card ID that must be played on the current turn (finisher). */
  finisherCardId: string;
}

// ── Combo Definitions ───────────────────────────────────────────────────────
export const COMBO_DEFINITIONS: ComboEffect[] = [
  {
    name: "Rush",
    emoji: "🔥",
    bonusDamagePercent: 0.15,
    bonusShield: 0,
    bonusHealOverride: 0,
    description: "Strike → Surge: Surge deals +15% bonus damage.",
    triggerCardId: "strike",
    finisherCardId: "surge",
  },
  {
    name: "Fortress",
    emoji: "🏰",
    bonusDamagePercent: 0,
    bonusShield: 10,
    bonusHealOverride: 0,
    description: "Block → Parry: Parry gains +10 bonus shield.",
    triggerCardId: "block",
    finisherCardId: "parry",
  },
  {
    name: "Vampiric Rush",
    emoji: "🧛",
    bonusDamagePercent: 0,
    bonusShield: 0,
    bonusHealOverride: 0.75,
    description: "Any attack → Drain: Drain heals 75% instead of 50%.",
    triggerType: "attack",
    finisherCardId: "drain",
  },
];

// ── Detection ───────────────────────────────────────────────────────────────

/** Strip _t2 / _t3 suffix to get base card ID for combo matching. */
function baseId(cardId: string): string {
  return cardId.replace(/_t[23]$/, "");
}

/**
 * Detect if playing `currentCard` after `prevCard` triggers a combo.
 * Returns the matching `ComboEffect` or `null`.
 */
export function detectCombo(
  prevCard: Card,
  currentCard: Card,
): ComboEffect | null {
  const prevBase = baseId(prevCard.id);
  const currentBase = baseId(currentCard.id);

  for (const combo of COMBO_DEFINITIONS) {
    // Check finisher match
    if (combo.finisherCardId !== currentBase) continue;

    // Check trigger match (by specific card ID or by type)
    if (combo.triggerCardId && combo.triggerCardId === prevBase) return combo;
    if (combo.triggerType && prevCard.type === combo.triggerType) return combo;
  }

  return null;
}

/**
 * Get all combos that a given card participates in (as trigger or finisher).
 * Used by the card encyclopedia to display combo information.
 */
export function getCombosForCard(cardId: string): ComboEffect[] {
  const base = baseId(cardId);
  return COMBO_DEFINITIONS.filter(
    (combo) =>
      combo.finisherCardId === base ||
      combo.triggerCardId === base,
  );
}
