/** Read only the total from a stat block. This does not invent unspent Hit Dice. */
export function dnd5eMonsterHitDiceMaximum(dice: string | undefined): readonly { sides: number; max: number }[] | undefined {
  const match = dice?.trim().match(/^(\d+)d(4|6|8|10|12|20)(?:\s*[+\-−]\s*\d+)?$/i)
  if (!match) return undefined
  const max = Number(match[1])
  if (!Number.isSafeInteger(max) || max < 1) return undefined
  return [{ sides: Number(match[2]), max }]
}
