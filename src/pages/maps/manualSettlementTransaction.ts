import { applyManualHitPointOperation, type ManualSettlementOperation } from '../../lib/combatSettlementMode'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  resolveDnd5eDmHitPointAdjustment,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMapResultPlan,
} from '../../application/combat/dnd5eCombatRules'

export interface MapsManualSettlementPlan {
  hitPoints?: {
    characterId?: string
    mapId: string
    tokenId: string
    currentHp: number
    maxHp: number
    temporaryHp?: number
  }
  application?: Dnd5eMapResultPlan
  headless?: {
    sourceState: Dnd5eHeadlessCombatState
    result: Extract<Dnd5eActionResult, { ok: true }>
    characterIdByCombatantId: Readonly<Record<string, string>>
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
        input.operation === 'increase-temporary-hit-points' ? '增加临时生命值' :
          input.operation === 'decrease-temporary-hit-points' ? '减少临时生命值' :
            '授予临时生命值'

  if (character?.dnd5eCombatState?.wildShapeFormId) {
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: `dm-manual-settlement:${input.map.id}`,
      map: input.map,
      characters: [...input.characters],
      round: 1,
      initiativeOrder: input.map.tokens
        .filter((candidate) => candidate.type !== 'obstacle')
        .map((candidate, index) => ({
          tokenId: candidate.id,
          label: candidate.label,
          emoji: candidate.emoji,
          color: candidate.color,
          roll: Math.max(1, 20 - (index % 20)),
        })),
    })
    const before = snapshot.state.combatants[token.id]
    const resolved = resolveDnd5eDmHitPointAdjustment(
      snapshot.state,
      token.id,
      input.operation,
      amount,
    )
    if (!before || !resolved.ok) return null
    const after = resolved.state.combatants[token.id]
    const application = planDnd5eMapResultApplication({
      state: resolved.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      events: [...resolved.events],
    })
    const damageEvent = resolved.events.find((event) =>
      event.type === 'damage-applied' && event.targetId === token.id)
    const formHpBefore = before.classState.wildShapeFormId ? before.currentHp : undefined
    const formHpAfter = after.classState.wildShapeFormId ? after.currentHp : 0
    const bodyHpBefore = damageEvent?.type === 'damage-applied'
      ? damageEvent.creatureFormOriginalHpBefore ?? before.classState.wildShapeOriginalCurrentHp
      : undefined
    const formSummary = damageEvent?.type === 'damage-applied' && formHpBefore != null
      ? `；形态 HP ${formHpBefore} → ${formHpAfter}，超额 ${damageEvent.creatureFormOverflowDamage ?? 0}`
      : ''
    return {
      application,
      headless: {
        sourceState: snapshot.state,
        result: resolved,
        characterIdByCombatantId: snapshot.characterIdByCombatantId,
      },
      log: {
        message:
          `DM 手动结算：${character.name} ${operationLabel} ${amount}；当前 HP ${after.currentHp}/${after.maxHp}${formSummary}。`,
        kind: input.operation === 'damage' ? 'damage' : 'system',
        details: [
          `当前形态 HP ${before.currentHp} → ${formHpAfter}`,
          `临时 HP ${before.temporaryHp} → ${after.temporaryHp}`,
          ...(bodyHpBefore != null
            ? [`本体 HP ${bodyHpBefore} → ${
                after.classState.wildShapeFormId
                  ? bodyHpBefore
                  : after.currentHp
              }`]
            : []),
          '结算来源：DM 手动调整（Headless 形态伤害）',
        ],
      },
    }
  }

  if (
    token.dnd5eSummon?.featureId === 'spell:animate-objects' &&
    token.dnd5eSummon.truePolymorphOriginalObject
  ) {
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: `dm-manual-settlement:${input.map.id}`,
      map: input.map,
      characters: [...input.characters],
      round: 1,
      initiativeOrder: input.map.tokens
        .filter((candidate) => candidate.type !== 'obstacle')
        .map((candidate, index) => ({
          tokenId: candidate.id,
          label: candidate.label,
          emoji: candidate.emoji,
          color: candidate.color,
          roll: Math.max(1, 20 - (index % 20)),
        })),
    })
    const before = snapshot.state.combatants[token.id]
    const resolved = resolveDnd5eDmHitPointAdjustment(
      snapshot.state,
      token.id,
      input.operation,
      amount,
    )
    if (!before || !resolved.ok) return null
    const after = resolved.state.combatants[token.id]
    const application = planDnd5eMapResultApplication({
      state: resolved.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      events: [...resolved.events],
    })
    const originalId = token.dnd5eSummon.truePolymorphOriginalObject.id
    const restoredObject = application.map.tokens.find((candidate) => candidate.id === originalId)
    const restoredSummary = restoredObject && restoredObject.type === 'obstacle'
      ? `；已恢复为 ${restoredObject.label}，原物件 HP ${restoredObject.hp ?? '—'}/${restoredObject.maxHp ?? '—'}`
      : ''
    return {
      application,
      headless: {
        sourceState: snapshot.state,
        result: resolved,
        characterIdByCombatantId: snapshot.characterIdByCombatantId,
      },
      log: {
        message:
          `DM 手动结算：${token.label} ${operationLabel} ${amount}；当前 HP ${after.currentHp}/${after.maxHp}${restoredSummary}。`,
        kind: input.operation === 'damage' ? 'damage' : 'system',
        details: [
          `活化形态 HP ${before.currentHp} → ${after.currentHp}`,
          `临时 HP ${before.temporaryHp} → ${after.temporaryHp}`,
          ...(restoredObject
            ? [`原物件 HP ${token.dnd5eSummon.truePolymorphOriginalObject.hp ?? '—'} → ${restoredObject.hp ?? '—'}`]
            : []),
          '结算来源：DM 手动调整（Headless 活化物件伤害）',
        ],
      },
    }
  }

  if (character) {
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: `dm-manual-settlement:${input.map.id}`,
      map: input.map,
      characters: [...input.characters],
      round: 1,
      initiativeOrder: input.map.tokens
        .filter((candidate) => candidate.type !== 'obstacle')
        .map((candidate, index) => ({
          tokenId: candidate.id,
          label: candidate.label,
          emoji: candidate.emoji,
          color: candidate.color,
          roll: Math.max(1, 20 - (index % 20)),
        })),
    })
    const before = snapshot.state.combatants[token.id]
    const resolved = resolveDnd5eDmHitPointAdjustment(
      snapshot.state,
      token.id,
      input.operation,
      amount,
    )
    if (!before || !resolved.ok) return null
    const after = resolved.state.combatants[token.id]
    const application = planDnd5eMapResultApplication({
      state: resolved.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      events: [...resolved.events],
    })
    return {
      application,
      headless: {
        sourceState: snapshot.state,
        result: resolved,
        characterIdByCombatantId: snapshot.characterIdByCombatantId,
      },
      log: {
        message:
          `DM 手动结算：${character.name} ${operationLabel} ${amount}；当前 HP ${after.currentHp}/${after.maxHp}` +
          `${after.temporaryHp > 0 ? `，临时 HP ${after.temporaryHp}` : ''}。`,
        kind: input.operation === 'damage' ? 'damage' : 'system',
        details: [
          `HP ${before.currentHp} → ${after.currentHp}（上限 ${after.maxHp}）`,
          `临时 HP ${before.temporaryHp} → ${after.temporaryHp}`,
          '结算来源：DM 手动调整（Headless 伤害与状态规则）',
        ],
      },
    }
  }

  const maxHp = Math.max(1, token.maxHp ?? token.hp ?? 1)
  const temporaryHp = Math.max(0, token.dnd5eCombatState?.temporaryHp ?? 0)
  const next = applyManualHitPointOperation({
    currentHp: token.hp ?? maxHp,
    maxHp,
    temporaryHp,
  }, input.operation, amount)
  return {
    hitPoints: {
      mapId: input.map.id,
      tokenId: token.id,
      currentHp: next.currentHp,
      maxHp: next.maxHp,
      temporaryHp: next.temporaryHp,
    },
    log: {
      message:
        `DM 手动结算：${token.label} ${operationLabel} ${amount}；当前 HP ${next.currentHp}/${next.maxHp}` +
        `${next.temporaryHp > 0 ? `，临时 HP ${next.temporaryHp}` : ''}。`,
      kind: input.operation === 'damage' ? 'damage' : 'system',
      details: [
        `HP ${token.hp ?? maxHp} → ${next.currentHp}（上限 ${next.maxHp}）`,
        `临时 HP ${temporaryHp} → ${next.temporaryHp}`,
        '结算来源：DM 手动调整',
      ],
    },
  }
}
