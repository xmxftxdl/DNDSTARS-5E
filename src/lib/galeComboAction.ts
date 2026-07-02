import type { HeadlessGaleComboChoiceResult } from './headlessDmCombatEngine'

export function buildGaleComboChoiceParams(input: {
  characterId: string
  triggerLabel: string
}) {
  return {
    characterId: input.characterId,
    accepted: true,
    triggerLabel: input.triggerLabel,
  }
}

export type GaleComboChoiceSettlementPlan =
  | {
      status: 'rejected'
      log: { text: string; kind: 'system' }
    }
  | {
      status: 'accepted'
      logs: Array<{ text: string; kind: 'turn' }>
    }

export function planGaleComboChoiceSettlement(input: {
  result: HeadlessGaleComboChoiceResult
  casterName: string
}): GaleComboChoiceSettlementPlan {
  if (!input.result.ok) {
    return {
      status: 'rejected',
      log: {
        text: `${input.casterName} 疾风连击发动失败：${input.result.reason ?? 'unavailable'}。`,
        kind: 'system',
      },
    }
  }

  return {
    status: 'accepted',
    logs: [
      {
        text: `${input.casterName} 发动疾风连击：下一次技能或基础射击不消耗 AP。`,
        kind: 'turn',
      },
    ],
  }
}
