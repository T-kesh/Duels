
export const CLUTCH_DAMAGE_MULTIPLIER = 1.1;

export function calcDamageDealtUnified(
  attackerDamage: number,
  defenderShield: number,
  extraDefenderShield: number = 0,
  isClutch: boolean = false,
  piercingValue: number = 0,
): number {
  let dmg = attackerDamage;
  if (isClutch) {
    dmg = Math.floor(dmg * CLUTCH_DAMAGE_MULTIPLIER);
  }
  const totalShield = defenderShield + extraDefenderShield;
  const baseDamage = Math.max(0, dmg - totalShield);
  // Piercing bypasses shield, but can't pierce more than the shield absorbed.
  const shieldAbsorbed = Math.min(totalShield, dmg);
  const pierceDamage = Math.min(piercingValue, shieldAbsorbed);
  return baseDamage + pierceDamage;
}
