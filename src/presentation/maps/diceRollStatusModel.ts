import type {
  DiceBoxD20Request,
  DiceBoxRollRequest,
  SharedRollRequestPreview,
} from './useDicePresentation'

export interface ActiveDiceRollStatusView {
  id: string
  formula: string
  label: string
  targetName: string
}

export function resolveActiveDiceRollStatus(input: {
  diceBoxD20: DiceBoxD20Request | null
  diceBoxRoll: DiceBoxRollRequest | null
  rollRequestPreview: SharedRollRequestPreview | null
}): ActiveDiceRollStatusView | null {
  if (input.diceBoxD20) {
    return {
      id: `d20:${input.diceBoxD20.id}`,
      formula: '1d20',
      label: input.diceBoxD20.label || 'D20 检定',
      targetName: input.diceBoxD20.targetName,
    }
  }
  if (input.diceBoxRoll) {
    return {
      id: `dice:${input.diceBoxRoll.id}`,
      formula: `${input.diceBoxRoll.totalCount ?? input.diceBoxRoll.count}d${input.diceBoxRoll.sides}`,
      label: input.diceBoxRoll.label || '效果骰',
      targetName: input.diceBoxRoll.targetName,
    }
  }
  if (input.rollRequestPreview) {
    return {
      id: `shared:${input.rollRequestPreview.id}`,
      formula: `${input.rollRequestPreview.count}d${input.rollRequestPreview.sides}`,
      label: input.rollRequestPreview.label ||
        (input.rollRequestPreview.kind === 'd20' ? 'D20 检定' : '效果骰'),
      targetName: input.rollRequestPreview.targetName,
    }
  }
  return null
}
