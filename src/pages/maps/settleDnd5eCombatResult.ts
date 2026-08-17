import type {
  BardicInspirationRollType,
  DmAdjudicationInterruptResponse,
} from '../../lib/combatInterruptProtocol'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eCombatantPairKey,
  dnd5eHellishRebukeReactionOption,
  dnd5ePendingMonsterMechanicResolutions,
  dnd5ePendingMonsterDeathAreaEffects,
  dnd5ePostSpellRandomTablePlan,
  dnd5eSavingThrowMode,
  getDnd5eSrdMonster,
  planDnd5eMapResultApplication,
  previewDnd5eUnsupportedAirborneFalls,
  resolveDnd5eHeadlessAction,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMapResultPlan,
  type Dnd5eSpellTargetSavingThrowRoll,
} from '../../rulesets/dnd5e'
import { resolveDnd5eRollMode } from '../../rulesets/dnd5e/rollMode'
import { combatPresentationSavingThrowAbilityLabel } from '../../lib/combatPresentation'
import {
  resolveDnd5eSavingThrowInterrupts,
  type Dnd5eD20RollInterruptContext,
  type Dnd5eOptionalBonusDieInterruptRequest,
} from './dnd5eRollInterruptPipeline'

export async function settleDnd5eConcentrationChecks(input: {
  result: Extract<Dnd5eActionResult, { ok: true }>
  map: BattleMap
  characters: readonly Character[]
  priorApplication?: Pick<Dnd5eMapResultPlan, 'changedTokenIds' | 'changedCharacterIds'>
  characterIdByCombatantId: Readonly<Record<string, string>>
  rollD20: (
    label: string,
    targetName: string,
    context?: Dnd5eD20RollInterruptContext,
  ) => Promise<number>
  rollD4: (label: string, targetName: string) => Promise<number>
  rollDice: (count: number, sides: number, label: string, targetName: string) => Promise<number[]>
  requestSavingThrowReroll?: (input: {
    target: Character
    targetName: string
    featureName: string
    total: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
  }) => Promise<{ d20: number; d20Second?: number } | undefined>
  requestBardicInspiration?: (input: {
    target?: Character
    targetName: string
    dieSides: number
    rollType: BardicInspirationRollType
    total: number
    targetNumber: number
  }) => Promise<number | undefined>
  requestOptionalBonusDie?: (
    input: Dnd5eOptionalBonusDieInterruptRequest,
  ) => Promise<import('../../rulesets/dnd5e').Dnd5eOptionalBonusDieUse | undefined>
  requestDarkOnesOwnLuck?: (input: {
    target?: Character
    targetName: string
    rollType: '豁免' | '属性检定'
    total: number
    targetNumber?: number
  }) => Promise<number | undefined>
  requestHellishRebuke?: (input: {
    reactor: Character
    reactorTokenId: string
    targetTokenId: string
    sourceName: string
    damage: number
    slotLevel: number
    itemName?: string
  }) => Promise<boolean>
  requestPostSpellRandomTableAdjudication?: (request: {
    actor: Dnd5eCombatant
    featureId: string
    adjudicationId: string
    sourceSpellId: string
    tableRoll: number
    outcomeId?: string
    events: Extract<Dnd5eActionResult, { ok: true }>['events']
  }) => Promise<DmAdjudicationInterruptResponse>
  requestPostSpellRandomTableChoice?: (request: {
    actor: Dnd5eCombatant
    tableFeatureId: string
    choiceFeatureId: string
    tableRolls: readonly number[]
    tableDieSides: number
    transactionId: string
  }) => Promise<number | undefined>
  /**
   * Production map hook for registered Activity event windows. It runs after
   * native interrupt mechanics have settled, but before the map/character
   * application plan is built, so the whole chain is committed as one result.
   */
  settleActivityTriggers?: (request: {
    state: Dnd5eHeadlessCombatState
    events: Extract<Dnd5eActionResult, { ok: true }>['events']
    map: BattleMap
    characters: readonly Character[]
    characterIdByCombatantId: Readonly<Record<string, string>>
  }) => Promise<{
    state: Dnd5eHeadlessCombatState
    events: Extract<Dnd5eActionResult, { ok: true }>['events']
    /** Map snapshot after Activity-owned placement handoffs. */
    map?: BattleMap
  }>
}): Promise<{ result: Extract<Dnd5eActionResult, { ok: true }>; application: Dnd5eMapResultPlan }> {
  let state = input.result.state
  let map = input.map
  const events = [...input.result.events]
  const resolveWithUnsupportedAirborneFalls = async (
    source: typeof state,
    action: Dnd5eAction,
  ) => {
    const preview = previewDnd5eUnsupportedAirborneFalls(source, action)
    if (!preview.ok || preview.falls.length === 0) {
      return resolveDnd5eHeadlessAction(source, action)
    }
    const airborneFallDamageRollsByCombatantId: Record<string, readonly number[]> = {}
    for (const fall of preview.falls) {
      if (fall.fallingDamageDice < 1) continue
      const targetName = input.map.tokens.find((token) => token.id === fall.combatantId)?.label ??
        source.combatants[fall.combatantId]?.name ?? fall.combatantId
      airborneFallDamageRollsByCombatantId[fall.combatantId] = await input.rollDice(
        fall.fallingDamageDice,
        6,
        '失去飞行支撑·坠落伤害',
        targetName,
      )
    }
    return resolveDnd5eHeadlessAction(source, {
      ...action,
      airborneFallDamageRollsByCombatantId,
    })
  }
  const resolveSavingThrowInterrupts = (request: {
    combatant: Dnd5eCombatant
    targetName: string
    ability: import('../../lib/dnd').AbilityKey
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    label: string
    secondRollLabel?: string
    halflingLuckyLabel?: string
    blessLabel?: string
    baneLabel?: string
  }) => {
    const characterId = input.characterIdByCombatantId[request.combatant.id]
    const target = characterId
      ? input.characters.find((character) => character.id === characterId)
      : undefined
    return resolveDnd5eSavingThrowInterrupts({
      state,
      ...request,
      target,
      rollD20: input.rollD20,
      rollD4: input.rollD4,
      requestSavingThrowReroll: input.requestSavingThrowReroll,
      requestBardicInspiration: input.requestBardicInspiration,
      requestOptionalBonusDie: input.requestOptionalBonusDie,
      requestDarkOnesOwnLuck: input.requestDarkOnesOwnLuck,
    })
  }
  const pendingPostSpellRandomTables = input.result.events.filter((event) =>
    event.type === 'post-spell-random-table-check-required')
  for (const check of pendingPostSpellRandomTables) {
    if (check.type !== 'post-spell-random-table-check-required') continue
    const actor = state.combatants[check.actorId]
    if (
      !actor ||
      actor.classState.postSpellRandomTableCheck?.featureId !== check.featureId
    ) continue
    const actorName = input.map.tokens.find((token) => token.id === actor.id)?.label ?? actor.name
    const triggerRoll = check.forceTable
      ? undefined
      : check.triggerDieSides === 20
        ? await input.rollD20('施法后随机表·触发检定', actorName)
        : (await input.rollDice(
            1,
            check.triggerDieSides,
            '施法后随机表·触发检定',
            actorName,
          ))[0]
    const triggered = check.forceTable || check.triggerValues.includes(triggerRoll!)
    const tableRollCount = check.tableRollChoiceFeatureId &&
      Number.isInteger(check.tableRollCount) && check.tableRollCount! > 1
      ? check.tableRollCount!
      : 1
    const tableRollCandidates = triggered
      ? await input.rollDice(
          tableRollCount,
          check.tableDieSides,
          tableRollCount > 1 ? '施法后随机表·候选结果' : '施法后随机表·结果',
          actorName,
        )
      : undefined
    const requestedTableRollIndex = triggered && tableRollCandidates && tableRollCount > 1 &&
      check.tableRollChoiceFeatureId && input.requestPostSpellRandomTableChoice
      ? await input.requestPostSpellRandomTableChoice({
          actor,
          tableFeatureId: check.featureId,
          choiceFeatureId: check.tableRollChoiceFeatureId,
          tableRolls: tableRollCandidates,
          tableDieSides: check.tableDieSides,
          transactionId: [
            'post-spell-random-table-choice',
            state.combatId,
            state.round,
            state.initiativeIndex,
            actor.id,
            check.featureId,
          ].join(':'),
        })
      : undefined
    const selectedTableRollIndex = tableRollCandidates && tableRollCount > 1 &&
      Number.isInteger(requestedTableRollIndex) &&
      requestedTableRollIndex! >= 0 && requestedTableRollIndex! < tableRollCandidates.length
      ? requestedTableRollIndex!
      : tableRollCandidates && tableRollCount > 1
        ? 0
        : undefined
    const tableRoll = tableRollCandidates?.[selectedTableRollIndex ?? 0]
    const plan = dnd5ePostSpellRandomTablePlan(
      state,
      actor.id,
      check.featureId,
      triggerRoll,
      tableRoll,
    )
    if (!plan) continue
    let resolution: {
      schemaVersion: 1
      targetIds: readonly string[]
      targetSavingThrows: Dnd5eSpellTargetSavingThrowRoll[]
      legendaryResistanceTargetIds: string[]
      effectRolls: number[]
    } | undefined
    const optionalBonusDice: import('../../rulesets/dnd5e').Dnd5eOptionalBonusDieUse[] = []
    if (plan.effect) {
      const targetSavingThrows: Dnd5eSpellTargetSavingThrowRoll[] = []
      const legendaryResistanceTargetIds: string[] = []
      for (const targetId of plan.effect.targetIds) {
        const target = state.combatants[targetId]
        if (!target) continue
        const targetName = input.map.tokens.find((token) => token.id === targetId)?.label ?? target.name
        const mode = dnd5eSavingThrowMode(target, plan.effect.saveAbility, {
          effectVisible: true,
          sourceCreatureType: actor.creatureType,
          sourceIsSpell: true,
        })
        const interrupted = await resolveSavingThrowInterrupts({
          combatant: target,
          targetName,
          ability: plan.effect.saveAbility,
          dc: plan.effect.saveDc,
          mode,
          label: `随机表法术·${combatPresentationSavingThrowAbilityLabel(plan.effect.saveAbility)} DC ${plan.effect.saveDc}`,
          halflingLuckyLabel: '半身人幸运·随机表法术豁免重投',
          blessLabel: '祝福术·随机表法术豁免加值',
          baneLabel: '灾祸术·随机表法术豁免减值',
        })
        if (!interrupted.success && (target.classState.legendaryResistanceUses ?? 0) > 0) {
          legendaryResistanceTargetIds.push(target.id)
        }
        targetSavingThrows.push({
          targetId,
          d20: interrupted.d20,
          d20Second: interrupted.d20Second,
          halflingLuckyD20: interrupted.halflingLuckyD20,
          halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
          blessRoll: interrupted.blessRoll,
          baneRoll: interrupted.baneRoll,
          rerollD20: interrupted.rerollD20,
          rerollD20Second: interrupted.rerollD20Second,
          bardicInspirationRoll: interrupted.bardicInspirationRoll,
          darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
        })
        if (interrupted.optionalBonusDieUse) optionalBonusDice.push(interrupted.optionalBonusDieUse)
      }
      resolution = {
        schemaVersion: 1,
        targetIds: plan.effect.targetIds,
        targetSavingThrows,
        legendaryResistanceTargetIds,
        effectRolls: await input.rollDice(
          plan.effect.damageDice.count,
          plan.effect.damageDice.sides,
          '随机表核心法术·伤害',
          actorName,
        ),
      }
    }
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'resolve-post-spell-random-table',
      actorId: actor.id,
      featureId: check.featureId,
      triggerRoll,
      tableRoll,
      tableRollCandidates: selectedTableRollIndex == null ? undefined : tableRollCandidates,
      selectedTableRollIndex,
      resolution,
      optionalBonusDice: optionalBonusDice.length > 0 ? optionalBonusDice : undefined,
    })
    if (!resolved.ok) continue
    if (plan.effect) {
      const nested = await settleDnd5eConcentrationChecks({
        ...input,
        settleActivityTriggers: undefined,
        result: resolved,
      })
      state = nested.result.state
      events.push(...nested.result.events)
    } else {
      state = resolved.state
      events.push(...resolved.events)
      const required = resolved.events.find((event) =>
        event.type === 'post-spell-random-table-manual-adjudication-required')
      if (
        required?.type === 'post-spell-random-table-manual-adjudication-required' &&
        input.requestPostSpellRandomTableAdjudication
      ) {
        const response = await input.requestPostSpellRandomTableAdjudication({
          actor: state.combatants[required.actorId] ?? actor,
          featureId: required.featureId,
          adjudicationId: required.adjudicationId,
          sourceSpellId: required.sourceSpellId,
          tableRoll: required.tableRoll,
          outcomeId: required.outcomeId,
          events: resolved.events,
        })
        const adjudicated = await resolveWithUnsupportedAirborneFalls(state, {
          type: 'resolve-post-spell-random-table-manual-adjudication',
          actorId: required.actorId,
          adjudicationId: required.adjudicationId,
          decision: response.decision,
          effects: response.effects.map((effect) => ({
            targetId: effect.targetTokenId,
            operation: effect.operation,
            amount: effect.amount,
            addCondition: effect.addCondition,
            removeCondition: effect.removeCondition,
          })),
          note: response.note,
        })
        if (adjudicated.ok) {
          const nested = await settleDnd5eConcentrationChecks({
            ...input,
            settleActivityTriggers: undefined,
            result: adjudicated,
          })
          state = nested.result.state
          events.push(...nested.result.events)
        }
      }
    }
  }
  const pendingRelentlessRage = input.result.events.filter((event) => event.type === 'relentless-rage-save-required')
  for (const check of pendingRelentlessRage) {
    const combatant = state.combatants[check.targetId]
    if (!combatant || combatant.currentHp !== 0 || combatant.classState.relentlessRagePendingDc !== check.dc) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const mode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'con',
      dc: check.dc,
      mode,
      label: `坚韧狂暴·体质豁免 DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'barbarian-relentless-rage-save', actorId: check.targetId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
      dc: check.dc,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingUndeadFortitude = input.result.events.filter((event) => event.type === 'undead-fortitude-save-required')
  for (const check of pendingUndeadFortitude) {
    const combatant = state.combatants[check.targetId]
    if (
      !combatant || combatant.currentHp !== 0 || combatant.deathSaves.dead ||
      combatant.classState.undeadFortitudePending?.dc !== check.dc
    ) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const mode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'con',
      dc: check.dc,
      mode,
      label: `亡灵坚韧·体质豁免 DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'monster-undead-fortitude-save', actorId: check.targetId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingMonsterOnHitSaves = input.result.events.filter((event) => event.type === 'monster-on-hit-save-required')
  for (const check of pendingMonsterOnHitSaves) {
    const combatant = state.combatants[check.targetId]
    const pending = combatant?.classState.monsterOnHitSavePending
    if (
      !combatant || !pending || combatant.currentHp <= 0 || combatant.deathSaves.dead ||
      pending.sourceId !== check.sourceId || pending.actionId !== check.actionId
    ) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const mode = dnd5eSavingThrowMode(combatant, check.ability, {
      effectVisible: true,
      condition: check.condition,
    })
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: check.ability,
      dc: check.dc,
      mode,
      label: `怪物命中特效·${combatPresentationSavingThrowAbilityLabel(check.ability)} DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'monster-on-hit-save', actorId: check.targetId,
      sourceId: check.sourceId, actionId: check.actionId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingDraconicPresence = input.result.events.filter((event) => event.type === 'draconic-presence-save-required')
  for (const check of pendingDraconicPresence) {
    const combatant = state.combatants[check.targetId]
    const source = state.combatants[check.sourceId]
    if (!combatant || !source || !combatant.draconicPresenceSourceIds?.includes(source.id)) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const condition = check.mode === 'fear' ? 'frightened' : 'charmed'
    const mode = dnd5eSavingThrowMode(combatant, 'wis', { effectVisible: true, condition })
    const label = check.mode === 'fear' ? '龙威·恐惧感知豁免' : '龙威·敬畏感知豁免'
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'wis',
      dc: check.dc,
      mode,
      label: `${label} DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'sorcerer-draconic-presence-save', actorId: combatant.id, sourceId: source.id,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingDamageEffectSaves = input.result.events.filter((event) =>
    event.type === 'active-effect-save-required' && event.timing === 'takes-damage',
  )
  for (const check of pendingDamageEffectSaves) {
    if (check.type !== 'active-effect-save-required') continue
    const combatant = state.combatants[check.targetId]
    const effect = combatant?.classState.activeEffects?.find((candidate) => candidate.id === check.effectId)
    if (
      !combatant || !effect?.repeatSave?.onDamage ||
      !combatant.classState.activeEffectDamageSavePendingIds?.includes(check.effectId)
    ) continue
    const source = effect.source.actorId ? state.combatants[effect.source.actorId] : undefined
    const baseMode = dnd5eSavingThrowMode(combatant, check.ability, {
      effectVisible: effect.visibility !== 'dm-only',
      sourceCreatureType: source?.creatureType,
      sourceIsSpell: effect.source.kind === 'spell',
    })
    const mode = check.mode === 'advantage'
      ? resolveDnd5eRollMode({
          requestedMode: baseMode,
          advantage: [{ active: true, reason: 'active-effect-damage-save' }],
        }).mode
      : baseMode
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: check.ability,
      dc: check.dc,
      mode,
      label: `受伤触发·${combatPresentationSavingThrowAbilityLabel(check.ability)} DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'active-effect-damage-save', actorId: combatant.id, effectId: check.effectId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pending = input.result.events.filter((event) => event.type === 'concentration-check-required')
  for (const check of pending) {
    const combatant = state.combatants[check.targetId]
    if (!combatant?.concentrating) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const mode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'con',
      dc: check.dc,
      mode,
      label: `专注·体质豁免 DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'concentration-save', actorId: check.targetId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      blessRoll: interrupted.blessRoll,
      baneRoll: interrupted.baneRoll,
      rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
      dc: check.dc,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingDeathArea = dnd5ePendingMonsterDeathAreaEffects(state)[0]
  if (pendingDeathArea) {
    const source = state.combatants[pendingDeathArea.sourceId]
    const monster = source?.statBlockId
      ? getDnd5eSrdMonster(source.statBlockId)
      : undefined
    const rule = monster?.traits.find((trait) =>
      trait.automation === 'headless' &&
      trait.rule?.kind === 'death-area-saving-throw' &&
      trait.rule.ruleId === pendingDeathArea.ruleId)?.rule
    if (source && monster && rule?.kind === 'death-area-saving-throw') {
      const liveTargetIds = pendingDeathArea.targetIds.filter((targetId) => {
        const target = state.combatants[targetId]
        return !!target && target.currentHp > 0 && !target.deathSaves.dead
      })
      const targetSavingThrows: Dnd5eSpellTargetSavingThrowRoll[] = []
      const legendaryResistanceTargetIds: string[] = []
      const optionalBonusDice: import('../../rulesets/dnd5e').Dnd5eOptionalBonusDieUse[] = []
      for (const targetId of liveTargetIds) {
        const target = state.combatants[targetId]!
        const targetName =
          input.map.tokens.find((token) => token.id === targetId)?.label ??
          target.name
        const mode = dnd5eSavingThrowMode(target, rule.ability, {
          effectVisible: true,
          sourceCreatureType: source.creatureType,
          sourceIsSpell: false,
        })
        const interrupted = await resolveSavingThrowInterrupts({
          combatant: target,
          targetName,
          ability: rule.ability,
          dc: rule.dc,
          mode,
          label: `${monster.name}·${rule.ruleId} ${combatPresentationSavingThrowAbilityLabel(rule.ability)} DC ${rule.dc}`,
        })
        if (
          !interrupted.success &&
          (target.classState.legendaryResistanceUses ?? 0) > 0
        ) {
          legendaryResistanceTargetIds.push(target.id)
        }
        targetSavingThrows.push({
          targetId: target.id,
          d20: interrupted.d20,
          d20Second: interrupted.d20Second,
          halflingLuckyD20: interrupted.halflingLuckyD20,
          halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
          blessRoll: interrupted.blessRoll,
          baneRoll: interrupted.baneRoll,
          rerollD20: interrupted.rerollD20,
          rerollD20Second: interrupted.rerollD20Second,
          bardicInspirationRoll: interrupted.bardicInspirationRoll,
          darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
        })
        if (interrupted.optionalBonusDieUse) optionalBonusDice.push(interrupted.optionalBonusDieUse)
      }
      const damageRolls = rule.damage
        ? await input.rollDice(
            rule.damage.count,
            rule.damage.sides,
            `${monster.name}·${rule.ruleId} 伤害`,
            source.name,
          )
        : []
      const resolved = await resolveWithUnsupportedAirborneFalls(state, {
        type: 'resolve-monster-death-area-effect',
        actorId: source.id,
        snapshotId: pendingDeathArea.id,
        resolution: {
          schemaVersion: 1,
          targetIds: liveTargetIds,
          targetSavingThrows,
          legendaryResistanceTargetIds,
          damageRolls,
        },
        optionalBonusDice: optionalBonusDice.length > 0 ? optionalBonusDice : undefined,
      })
      if (resolved.ok) {
        const nested = await settleDnd5eConcentrationChecks({
          ...input,
          settleActivityTriggers: undefined,
          result: resolved,
        })
        state = nested.result.state
        events.push(...nested.result.events)
      }
    }
  }
  if (input.requestHellishRebuke) {
    const damageEvents = input.result.events.filter((event) =>
      event.type === 'damage-applied' && !!event.sourceId && event.amount > 0,
    )
    for (const damageEvent of damageEvents) {
      if (damageEvent.type !== 'damage-applied' || !damageEvent.sourceId) continue
      const reactor = state.combatants[damageEvent.targetId]
      const damageSource = state.combatants[damageEvent.sourceId]
      const reactorCharacterId = input.characterIdByCombatantId[damageEvent.targetId]
      const reactorCharacter = reactorCharacterId
        ? input.characters.find((character) => character.id === reactorCharacterId)
        : undefined
      const rebukeOption = reactor ? dnd5eHellishRebukeReactionOption(reactor) : undefined
      const distance = reactor && damageSource
        ? state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(reactor.id, damageSource.id)]
        : undefined
      if (
        !reactor || !damageSource || damageSource.currentHp <= 0 || damageSource.deathSaves.dead ||
        !reactorCharacter || !rebukeOption ||
        reactor.controller === damageSource.controller || !Number.isFinite(distance) || distance! > 60 ||
        state.lineOfEffectBlockedByCombatantPair?.[`${reactor.id}\u0000${damageSource.id}`]
      ) continue
      const accepted = await input.requestHellishRebuke({
        reactor: reactorCharacter,
        reactorTokenId: damageEvent.targetId,
        targetTokenId: damageEvent.sourceId,
        sourceName: input.map.tokens.find((token) => token.id === damageSource.id)?.label ?? damageSource.name,
        damage: damageEvent.amount,
        slotLevel: rebukeOption.slotLevel,
        itemName: rebukeOption.itemName,
      })
      if (!accepted) continue
      const mode = dnd5eSavingThrowMode(damageSource, 'dex', {
        effectVisible: true,
        sourceCreatureType: reactor.creatureType,
        sourceIsSpell: true,
      })
      const sourceName = input.map.tokens.find((token) => token.id === damageSource.id)?.label ?? damageSource.name
      const interrupted = await resolveSavingThrowInterrupts({
        combatant: damageSource,
        targetName: sourceName,
        ability: 'dex',
        dc: rebukeOption.saveDc,
        mode,
        label: '炼狱叱喝·敏捷豁免',
      })
      const effectRolls = await input.rollDice(
        rebukeOption.slotLevel + 1,
        10,
        '炼狱叱喝·火焰伤害',
        sourceName,
      )
      const reaction = await resolveWithUnsupportedAirborneFalls(state, {
        type: 'hellish-rebuke', actorId: reactor.id, targetId: damageSource.id,
        racialInnate: rebukeOption.racialInnate,
        slotLevel: rebukeOption.slotLevel, triggerDamageAmount: damageEvent.amount,
        savingThrowD20: interrupted.d20,
        savingThrowD20Second: interrupted.d20Second,
        savingThrowBlessRoll: interrupted.blessRoll,
        savingThrowBaneRoll: interrupted.baneRoll,
        halflingLuckyD20: interrupted.halflingLuckyD20,
        halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
        bardicInspirationRoll: interrupted.bardicInspirationRoll,
        darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
        rerollD20: interrupted.rerollD20,
        rerollD20Second: interrupted.rerollD20Second,
        optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
        effectRolls,
      })
      if (!reaction.ok) continue
      const nested = await settleDnd5eConcentrationChecks({
        ...input,
        settleActivityTriggers: undefined,
        result: reaction,
      })
      state = nested.result.state
      events.push(...nested.result.events)
    }
  }
  const pendingMonsterMechanics = dnd5ePendingMonsterMechanicResolutions(state)
  for (const pending of pendingMonsterMechanics) {
    // Triggered attacks require a separate authoritative preview because a
    // critical hit changes the required damage-die count. Dice-only mechanics
    // can be settled immediately, including conditional extra damage.
    if (pending.attacks.length > 0) continue
    const effectRolls = []
    for (const requirement of pending.dice) {
      effectRolls.push({
        effectId: requirement.effectId,
        rolls: await input.rollDice(
          requirement.count,
          requirement.sides,
          `${pending.mechanicName}·${requirement.effectName}`,
          pending.ownerName,
        ),
      })
    }
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'resolve-monster-mechanic-trigger',
      actorId: pending.snapshot.mechanicOwnerId,
      snapshotId: pending.snapshot.id,
      roll: {
        actorId: pending.snapshot.mechanicOwnerId,
        mechanicId: pending.snapshot.mechanicId,
        effectRolls,
      },
    })
    if (!resolved.ok) continue
    const nested = await settleDnd5eConcentrationChecks({
      ...input,
      settleActivityTriggers: undefined,
      result: resolved,
    })
    state = nested.result.state
    events.push(...nested.result.events)
  }
  if (input.settleActivityTriggers) {
    const triggered = await input.settleActivityTriggers({
      state,
      events,
      map,
      characters: input.characters,
      characterIdByCombatantId: input.characterIdByCombatantId,
    })
    state = triggered.state
    map = triggered.map ?? map
    events.push(...triggered.events)
    // Activity damage uses the same concentration/death/monster follow-up
    // pipeline. Disable the Activity hook for this nested pass because the
    // trigger coordinator already consumes Activity-produced event batches.
    if (triggered.events.length > 0) {
      const nested = await settleDnd5eConcentrationChecks({
        ...input,
        map,
        settleActivityTriggers: undefined,
        result: { ok: true, state, events: triggered.events },
      })
      state = nested.result.state
      events.push(...nested.result.events.slice(triggered.events.length))
    }
  }
  const result = { ok: true as const, state, events }
  const application = planDnd5eMapResultApplication({
    state,
    map,
    characters: input.characters,
    characterIdByCombatantId: input.characterIdByCombatantId,
  })
  return {
    result,
    application: {
      ...application,
      changedTokenIds: [...new Set([
        ...(input.priorApplication?.changedTokenIds ?? []),
        ...application.changedTokenIds,
      ])],
      changedCharacterIds: [...new Set([
        ...(input.priorApplication?.changedCharacterIds ?? []),
        ...application.changedCharacterIds,
      ])],
    },
  }
}
