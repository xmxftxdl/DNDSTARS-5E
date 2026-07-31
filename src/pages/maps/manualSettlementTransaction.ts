import { applyManualHitPointOperation, type ManualSettlementOperation } from '../../lib/combatSettlementMode'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'

export interface MapsManualSettlementPlan {
  hitPoints: {
    characterId?: string
    mapId: string
    tokenId: string
    currentHp: number
    maxHp: number
    temporaryHp?: number
  }
  log: {
    message: string
    kind: 'damage' | 'system'
    details: string[]
  }
}

export function planMapsManualSettlement(input: {
  map: BattleMap
  characters: readonly Character[]
  targetId: string
  operation: ManualSettlementOperation
  amount: number
}): MapsManualSettlementPlan | null {
  const token = input.map.tokens.find((candidate) => candidate.id === input.targetId)
  if (!token || token.type === 'obstacle') return null
  const character = token.characterId
    ? input.characters.find((candidate) => candidate.id === token.characterId)
    : undefined
  const amount = Math.max(0, Math.floor(input.amount))
  const operationLabel =
    input.operation === 'damage' ? '伤害' :
      input.operation === 'healing' ? '治疗' :
        '临时生命值'

  if (character) {
    const next = applyManualHitPointOperation({
      currentHp: character.currentHp,
      maxHp: character.maxHp,
      temporaryHp: character.tempHp,
    }, input.operation, amount)
    return {
      hitPoints: {
        characterId: character.id,
        mapId: input.map.id,
        tokenId: token.id,
        currentHp: next.currentHp,
        maxHp: next.maxHp,
        temporaryHp: next.temporaryHp,
      },
      log: {
        message:
          `DM 手动结算：${character.name} ${operationLabel} ${amount}；当前 HP ${next.currentHp}/${next.maxHp}` +
          `${next.temporaryHp > 0 ? `，临时 HP ${next.temporaryHp}` : ''}。`,
        kind: input.operation === 'damage' ? 'damage' : 'system',
        details: [
          `HP ${character.currentHp} → ${next.currentHp}（上限 ${next.maxHp}）`,
          `临时 HP ${character.tempHp} → ${next.temporaryHp}`,
          '结算来源：DM 手动调整',
        ],
      },
    }
  }

  if (input.operation === 'temporary-hit-points') return null
  const maxHp = Math.max(1, token.maxHp ?? token.hp ?? 1)
  const next = applyManualHitPointOperation({
    currentHp: token.hp ?? maxHp,
    maxHp,
    temporaryHp: 0,
  }, input.operation, amount)
  return {
    hitPoints: {
      mapId: input.map.id,
      tokenId: token.id,
      currentHp: next.currentHp,
      maxHp: next.maxHp,
    },
    log: {
      message:
        `DM 手动结算：${token.label} ${operationLabel} ${amount}；当前 HP ${next.currentHp}/${next.maxHp}。`,
      kind: input.operation === 'damage' ? 'damage' : 'system',
      details: [
        `HP ${token.hp ?? maxHp} → ${next.currentHp}（上限 ${next.maxHp}）`,
        '结算来源：DM 手动调整',
      ],
    },
  }
}
