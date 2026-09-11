import type { Dnd5eCombatEvent } from '../../rulesets/dnd5e/headlessCombatEngine'

export interface DiceCheckOutcome {
  rollId?: string
  values?: number[]
  mode?: 'normal' | 'advantage' | 'disadvantage'
  provisional?: boolean
  id: string
  kind: 'attack' | 'save'
  success: boolean
  actorName: string
  targetName?: string
}

export interface DiceCheckPreview {
  mode: 'normal' | 'advantage' | 'disadvantage'
  kind: DiceCheckOutcome['kind']
  actorName: string
  targetName?: string
  values: number[]
  evaluate: (first: number, second?: number) => boolean
}

export function createDiceCheckPreview(kind: DiceCheckOutcome['kind'], actorName: string, targetName: string | undefined,
  evaluate: DiceCheckPreview['evaluate'], mode: DiceCheckPreview['mode'] = 'normal'): DiceCheckPreview {
  return { kind, actorName, targetName, evaluate, mode, values: [] }
}

export function previewDiceCheck(preview: DiceCheckPreview, value: number, id: string, index = preview.values.length): DiceCheckOutcome {
  preview.values[index] = value
  const values = preview.values.slice(preview.mode === 'normal' ? -1 : -2)
  return { id, provisional: true, kind: preview.kind, actorName: preview.actorName, targetName: preview.targetName,
    success: preview.evaluate(values[0], values[1]) }
}

export function createAttackDiceCheckPreview(
  actorName: string, targetName: string, modifier: number, armorClass: number,
  mode: DiceCheckPreview['mode'] = 'normal', criticalThreshold = 20,
): DiceCheckPreview {
  return createDiceCheckPreview('attack', actorName, targetName, (first, second) => {
    const die = mode === 'advantage' ? Math.max(first, second ?? first)
      : mode === 'disadvantage' ? Math.min(first, second ?? first) : first
    return die !== 1 && (die >= criticalThreshold || die + modifier >= armorClass)
  }, mode)
}

export function diceCheckOutcome(event: Dnd5eCombatEvent, id: string, name: (id: string) => string): DiceCheckOutcome | undefined {
  if (event.type === 'attack-resolved') return {
    id, kind: 'attack', success: event.hit, actorName: name(event.actorId), targetName: name(event.targetId),
  }
  if (event.type === 'saving-throw-resolved' && !event.automaticOutcome) return {
    id, kind: 'save', success: event.success, actorName: name(event.targetId),
  }
}

export function diceCheckOutcomeLabel(outcome: DiceCheckOutcome): string {
  return outcome.kind === 'attack' ? outcome.success ? '命中' : '未命中' : outcome.success ? '豁免成功' : '豁免失败'
}
