import { Card } from "@/constants/cards";

export const CLUTCH_DAMAGE_MULTIPLIER = 1.1;

export function calcDamageDealtUnified(
  attackerDamage: number,
  defenderShield: number,
  extraDefenderShield: number = 0,
  isClutch: boolean = false
): number {
  let dmg = attackerDamage;
  if (isClutch) {
    dmg = Math.floor(dmg * CLUTCH_DAMAGE_MULTIPLIER);
  }
  return Math.max(0, dmg - defenderShield - extraDefenderShield);
}
