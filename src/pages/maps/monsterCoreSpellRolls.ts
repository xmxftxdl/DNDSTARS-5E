/**
 * Whether a monster core-spell transaction must carry its primary effect-roll
 * group.  Saving throws such as Banishment have no damage dice and must submit
 * an empty group list, rather than one empty group.
 */
export function dnd5eMonsterCoreSpellNeedsEffectRolls(
  effect: string,
  diceCount: number,
): boolean {
  return diceCount > 0 && [
    'spell-attack',
    'saving-throw',
    'healing',
    'sleep-hit-point-pool',
  ].includes(effect)
}
