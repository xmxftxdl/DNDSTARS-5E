import { planDnd5eDisadvantageNegation, type DisadvantageNegationRoll } from '../../rulesets/dnd5e/disadvantageNegation'
import { dnd5eSpellcastingSaveRequirements, previewDnd5eSpellcastingSaves, type Dnd5eSpellcastingSavingThrowRoll } from '../../rulesets/dnd5e/headlessCombatEngine'
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
  markDnd5eSummonsDamaged,
  planDnd5eMapResultApplication,
  previewDnd5eUnsupportedAirborneFalls,
  previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  resolveDnd5eHeadlessAction,
  resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  type Dnd5eUnsupportedAirborneFallPreview,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMapResultPlan,
  type Dnd5eSpellTargetSavingThrowRoll,
} from '../../rulesets/dnd5e'
import { resolveDnd5eRollMode } from '../../rulesets/dnd5e/rollMode'
import {dnd5eRollDiceRecipes,resolveDnd5eRollDiceModifiers} from '../../rulesets/dnd5e/rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId} from '../../rulesets/dnd5e/rollDiceTransaction'
import { combatPresentationSavingThrowAbilityLabel } from '../../lib/combatPresentation'
import {
  resolveDnd5eSavingThrowInterrupts,
  type Dnd5eD20RollInterruptContext,
  type Dnd5eOptionalBonusDieInterruptRequest,
} from './dnd5eRollInterruptPipeline'

export async function settleDnd5eConcentrationChecks(input: {
  chooseDisadvantageNegation?: (request: { character: Character; roll: DisadvantageNegationRoll; transactionId: string }) => Promise<string | undefined>
  result: Extract<Dnd5eActionResult, { ok: true }>
  /** State immediately before a non-action authority adjustment changed support. */
  priorState?: Dnd5eHeadlessCombatState
  rollUnsupportedAirborneFalls?: (falls: readonly Dnd5eUnsupportedAirborneFallPreview[], map: BattleMap) => Promise<Readonly<Record<string, readonly number[]>>>
  settleMountedBalance?: (prepared: { state: Dnd5eHeadlessCombatState; map: BattleMap; characters: readonly Character[]; characterIdByCombatantId: Record<string,string> }, result: Dnd5eActionResult) => Promise<{ result: Dnd5eActionResult }>
  map: BattleMap
  /** Cross-scene continuations retain remote participants in the result while
   * projecting only this scene. The caller must also persist the remote changes. */
  preserveOffMapParticipants?: boolean
  characters: readonly Character[]
  priorApplication?: Pick<
    Dnd5eMapResultPlan,
    'changedTokenIds' | 'changedCharacterIds' | 'tokenPatches' | 'characterPatches' | 'geometry' | 'spentReactions'
  >
  characterIdByCombatantId: Readonly<Record<string, string>>
  rollD20: (
    label: string,
    targetName: string,
    context?: Dnd5eD20RollInterruptContext,
  ) => Promise<number>
  runEffectEndSavingThrow?: <T>(key: string, run: () => Promise<T>) => Promise<T>
  rollD4: (label: string, targetName: string, context?: { rollerTokenId?: string; rollerCharacterId?: string }) => Promise<number>
  rollDice: (count: number, sides: number, label: string, targetName: string, context?: { rollerTokenId?: string; rollerCharacterId?: string }) => Promise<number[]>
  requestSavingThrowReroll?: (input: {
    target: Character
    targetName: string
    featureName: string
    total: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
  }) => Promise<{ d20: number; d20Second?: number; resourceKey?: string } | undefined>
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
  let transaction = input.result.transaction
  const followupId = input.result.transaction?.id ?? crypto.randomUUID()
  let map = input.map
  const events = [...input.result.events]
  const collectFallRolls = async (falls: readonly Dnd5eUnsupportedAirborneFallPreview[]) => {
    if (input.rollUnsupportedAirborneFalls) return input.rollUnsupportedAirborneFalls(falls, map)
    const rolls: Record<string, readonly number[]> = {}
    for (const fall of falls) {
      if (fall.collisionCandidates?.length) throw new Error('fall-collision-target-selection-required')
      if (fall.collision) {
        const collision = fall.collision
        const context = { rollerTokenId: collision.targetId, rollKind: 'saving-throw' as const }
        const first = await input.rollD20('躲避坠落生物 · 敏捷豁免 DC 15', collision.targetName, context)
        rolls[collision.rollKey] = collision.mode === 'normal' ? [first] : [first,
          await input.rollD20('躲避坠落生物 · 敏捷豁免 DC 15', collision.targetName, context)]
      }
      if (fall.fallingDamageDice > 0) rolls[fall.combatantId] = await input.rollDice(
        fall.fallingDamageDice, 6, '失去飞行支撑·坠落伤害',
        map.tokens.find(token => token.id === fall.combatantId)?.label ?? state.combatants[fall.combatantId]?.name ?? fall.combatantId,
        {rollerTokenId:fall.combatantId},
      )
    }
    return rolls
  }
  if (input.priorState) {
    if (input.settleMountedBalance) {
      const mounted = await input.settleMountedBalance({ state: input.priorState, map,
        characters: input.characters, characterIdByCombatantId: { ...input.characterIdByCombatantId } }, input.result)
      if (!mounted.result.ok) throw new Error(`mounted-balance:${mounted.result.reason}`)
      state = mounted.result.state
      events.splice(0, events.length, ...mounted.result.events)
    }
    // Derived solely from authoritative result events, never a player-provided claim.
    const forcedMovementTargetIds=events.flatMap(event=>event.type==='moved' && event.movementKind==='forced' &&
      event.toElevationFeet!=null && event.fromElevationFeet!=null && event.toElevationFeet!==event.fromElevationFeet ? [event.actorId] : [])
    const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(
      input.priorState,
      state,
      forcedMovementTargetIds,
    )
    if (falls.length > 0) {
      const fallDamageRollsByCombatantId = await collectFallRolls(falls)
      const fallen = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(
        input.priorState,
        state,
        fallDamageRollsByCombatantId,
        forcedMovementTargetIds,
      )
      if (!fallen.ok) throw new Error(`unsupported-airborne-fall:${fallen.reason}`)
      state = fallen.state
      events.push(...fallen.events)
    }
  }
  const resolveWithUnsupportedAirborneFalls = async (
    source: typeof state,
    action: Dnd5eAction,
    transactionId?: string,
  ) => {
    const settleMounted = async (result: Dnd5eActionResult) => input.settleMountedBalance
      ? (await input.settleMountedBalance({ state: source, map: input.map, characters: input.characters,
          characterIdByCombatantId: { ...input.characterIdByCombatantId } }, result)).result
      : result
    const preview = previewDnd5eUnsupportedAirborneFalls(source, action,{transactionId})
    if (!preview.ok || preview.falls.length === 0) {
      return settleMounted(resolveDnd5eHeadlessAction(source, action,{transactionId}))
    }
    const airborneFallDamageRollsByCombatantId = await collectFallRolls(preview.falls)
    return settleMounted(resolveDnd5eHeadlessAction(source, {
      ...action,
      airborneFallDamageRollsByCombatantId,
    },{transactionId}))
  }
  const resolveSavingThrowInterrupts = (request: {
    effectDiceModifier?: number
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
        ? await input.rollD20('施法后随机表·触发检定', actorName, { rollerTokenId: actor.id, rollKind: 'ability-check' })
        : (await input.rollDice(
            1,
            check.triggerDieSides,
            '施法后随机表·触发检定',
            actorName, { rollerTokenId: actor.id },
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
          actorName, { rollerTokenId: actor.id },
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
          rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20,
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
          actorName, { rollerTokenId: actor.id },
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
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
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
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
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
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
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
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
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
  for (const [checkIndex, check] of pendingDamageEffectSaves.entries()) {
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
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    }, JSON.stringify([followupId, 'damage-effect-save', checkIndex, combatant.id, check.effectId]))
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pending = input.result.events.filter((event) => event.type === 'concentration-check-required').filter(event => !event.settled)
  for (const [checkIndex,check] of pending.entries()) {
    let combatant = state.combatants[check.targetId]
    if (!combatant?.concentrating) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const baseMode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    let mode = resolveDnd5eRollMode({
      requestedMode: baseMode,
      disadvantage: [{
        active: combatant.classState.concentrationCheckDisadvantagePendingSourceId != null,
        reason: 'concentration-check-disadvantage',
      }],
    }).mode
    const checkTransactionId=JSON.stringify([followupId,'concentration',checkIndex,check.targetId])
    let disadvantageNegation: { rollId: string; transactionId: string } | undefined
    const characterId = input.characterIdByCombatantId[combatant.id]
    const originalCharacter = input.characters.find(character => character.id === characterId)
    if (mode === 'disadvantage' && originalCharacter && input.chooseDisadvantageNegation) {
      const character = { ...originalCharacter, classResources: structuredClone(combatant.classResources) }
      const roll: DisadvantageNegationRoll = { rollId: checkTransactionId,
        characterId: character.id, kind: 'saving-throw', phase: 'before-roll', mode }
      const featureId = await input.chooseDisadvantageNegation({ character, roll, transactionId: checkTransactionId })
      if (featureId) {
        const plan = planDnd5eDisadvantageNegation(character, roll, featureId)
        if (!plan || combatant.classState.disadvantageNegationReceipts?.[roll.rollId]) throw Error('concentration-negation-choice-unavailable')
        state = structuredClone(state)
        combatant = state.combatants[check.targetId]
        combatant.classResources = structuredClone(plan.character.classResources ?? {})
        combatant.classState.disadvantageNegationReceipts = { ...combatant.classState.disadvantageNegationReceipts,
          [roll.rollId]: { rollId: roll.rollId, transactionId: checkTransactionId, kind: 'saving-throw', featureId } }
        disadvantageNegation = { rollId: roll.rollId, transactionId: checkTransactionId }
        mode = 'normal'
      }
    }
    const effectContext={actorId:combatant.id,effects:combatant.classState.activeEffects,kind:'concentration-save' as const,
      eventId:dnd5eRollDiceOccurrenceId(checkTransactionId,combatant.id,'concentration-save',0)}
    const effectRollDice:Record<string,readonly number[]>={}
    for(const recipe of dnd5eRollDiceRecipes(effectContext)) effectRollDice[recipe.id]=await input.rollDice(
      recipe.count,recipe.sides,`专注豁免·${recipe.direction==='add'?'加值':'减值'}`,targetName,{rollerTokenId:combatant.id})
    const effectDiceModifier=resolveDnd5eRollDiceModifiers(effectContext,effectRollDice).modifier
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'con',
      effectDiceModifier,
      dc: check.dc,
      mode,
      label: `专注·体质豁免 DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'concentration-save', actorId: check.targetId,
      disadvantageNegation,
      effectRollDice,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      blessRoll: interrupted.blessRoll,
      baneRoll: interrupted.baneRoll,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
      dc: check.dc,
    },checkTransactionId)
    if (!resolved.ok) throw new Error(`concentration-settlement:${resolved.reason}`)
    if(resolved.transaction) {
      const parent=transaction ?? {...resolved.transaction,rollLedger:{entries:[]}}
      const entries=new Map(parent.rollLedger.entries.map(entry=>[entry.id,entry]))
      for(const entry of resolved.transaction.rollLedger.entries) {
        const id=JSON.stringify([checkTransactionId,entry.id])
        entries.set(id,{...entry,id})
      }
      transaction={...parent,rollLedger:{...parent.rollLedger,entries:[...entries.values()]}}
    }
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
          rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20,
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
            source.name, { rollerTokenId: source.id },
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
      const spellcastingSavingThrows: Dnd5eSpellcastingSavingThrowRoll[] = []
      for (const requirement of dnd5eSpellcastingSaveRequirements(state, reactor.id)) {
        const saved = await resolveSavingThrowInterrupts({ combatant: reactor, targetName: reactorCharacter.name,
          ability: requirement.ability, dc: requirement.dc, mode: requirement.mode,
          label: `${requirement.effect.label} · 施法前豁免` })
        spellcastingSavingThrows.push({ ...saved, effectId: requirement.effect.id, targetId: reactor.id,
          optionalBonusDice: saved.optionalBonusDieUse ? [saved.optionalBonusDieUse] : undefined })
      }
      const castingAllowed = previewDnd5eSpellcastingSaves(state, reactor.id, spellcastingSavingThrows)
      if (castingAllowed == null) continue
      const mode = dnd5eSavingThrowMode(damageSource, 'dex', {
        effectVisible: true,
        sourceCreatureType: reactor.creatureType,
        sourceIsSpell: true,
      })
      const sourceName = input.map.tokens.find((token) => token.id === damageSource.id)?.label ?? damageSource.name
      const interrupted = !castingAllowed ? undefined : await resolveSavingThrowInterrupts({
        combatant: damageSource,
        targetName: sourceName,
        ability: 'dex',
        dc: rebukeOption.saveDc,
        mode,
        label: '炼狱叱喝·敏捷豁免',
      })
      const effectRolls = !castingAllowed ? [] : await input.rollDice(
        rebukeOption.slotLevel + 1,
        10,
        '炼狱叱喝·火焰伤害',
        sourceName, { rollerTokenId: reactor.id },
      )
      const reaction = await resolveWithUnsupportedAirborneFalls(state, {
        spellcastingSavingThrows,
        type: 'hellish-rebuke', actorId: reactor.id, targetId: damageSource.id,
        racialInnate: rebukeOption.racialInnate,
        slotLevel: rebukeOption.slotLevel, triggerDamageAmount: damageEvent.amount,
        savingThrowD20: interrupted?.d20 ?? 0,
        savingThrowD20Second: interrupted?.d20Second,
        savingThrowBlessRoll: interrupted?.blessRoll,
        savingThrowBaneRoll: interrupted?.baneRoll,
        halflingLuckyD20: interrupted?.halflingLuckyD20,
        halflingLuckyD20Second: interrupted?.halflingLuckyD20Second,
        bardicInspirationRoll: interrupted?.bardicInspirationRoll,
        darkOnesOwnLuckRoll: interrupted?.darkOnesOwnLuckRoll,
        rerollResourceKey: interrupted?.rerollResourceKey, rerollD20: interrupted?.rerollD20,
        rerollD20Second: interrupted?.rerollD20Second,
        optionalBonusDice: interrupted?.optionalBonusDieUse ? [interrupted?.optionalBonusDieUse] : undefined,
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
          pending.ownerName, { rollerTokenId: pending.snapshot.mechanicOwnerId },
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
  // Scan persisted obligations as well as fresh events, so a restored snapshot can resume.
  const endingSaves = Object.values(state.combatants).flatMap(actor =>
    (actor.classState.activeEffects ?? []).filter(effect => effect.pendingEndSavingThrow)
      .map(effect => ({actorId: actor.id, effectId: effect.id})))
  for (const pending of endingSaves) {
    const combatant = state.combatants[pending.actorId]
    const effect = combatant?.classState.activeEffects?.find(effect => effect.id === pending.effectId)
    const save = effect?.pendingEndSavingThrow
    if (!combatant || !effect || !save) continue
    const runEndingSave = () => resolveSavingThrowInterrupts({combatant,
      targetName: map.tokens.find(token => token.id === combatant.id)?.label ?? combatant.name,
      ability: save.ability, dc: save.dc,
      mode: dnd5eSavingThrowMode(combatant, save.ability, {sourceIsSpell:false}),
      label: `${effect.label} · ${combatPresentationSavingThrowAbilityLabel(save.ability)} DC ${save.dc}`})
    const endingSaveKey = JSON.stringify(['effect-end-save',map.id,combatant.id,effect.id,effect.appliedAt])
    const interrupted = input.runEffectEndSavingThrow
      ? await input.runEffectEndSavingThrow(endingSaveKey,runEndingSave) : await runEndingSave()
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type:'active-effect-end-save',actorId:combatant.id,effectId:effect.id,
      d20:interrupted.d20,d20Second:interrupted.d20Second,
      blessRoll:interrupted.blessRoll,baneRoll:interrupted.baneRoll,
      halflingLuckyD20:interrupted.halflingLuckyD20,halflingLuckyD20Second:interrupted.halflingLuckyD20Second,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20,rerollD20Second:interrupted.rerollD20Second,
      bardicInspirationRoll:interrupted.bardicInspirationRoll,darkOnesOwnLuckRoll:interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice:interrupted.optionalBonusDieUse?[interrupted.optionalBonusDieUse]:undefined,
    }, JSON.stringify([followupId,'effect-end-save',combatant.id,effect.id]))
    if (!resolved.ok) throw new Error(`Effect ending save failed: ${resolved.reason}`)
    state=resolved.state
    events.push(...resolved.events)
  }
  map = markDnd5eSummonsDamaged(
    map,
    new Set(events.flatMap((event) =>
      event.type === 'damage-applied' && event.amount > 0 ? [event.targetId] : [])),
    state.round,
  )
  // Concentration/reaction follow-ups replace state and append events, but
  // they must not erase map-owned Activity handoffs prepared by the original
  // atomic action. Dropping these fields spends the spell slot and starts
  // concentration while silently losing its persistent area or summon.
  const result: Extract<Dnd5eActionResult, { ok: true }> = {
    ...input.result,
    transaction,
    ok: true,
    state,
    events,
  }
  const projectedState = input.preserveOffMapParticipants ? structuredClone(state) : state
  if (input.preserveOffMapParticipants) {
    const ids = new Set(map.tokens.map(token => token.id))
    projectedState.combatants = Object.fromEntries(Object.entries(projectedState.combatants).filter(([id]) => ids.has(id)))
  }
  const application = planDnd5eMapResultApplication({
    state: projectedState,
    map,
    characters: input.characters,
    characterIdByCombatantId: input.characterIdByCombatantId,
    events,
  })
  // A trigger handoff has already moved its staged map. The planner compares
  // against that map and may produce no delta, but publication still starts
  // from input.map. Retain the actual final movement as a patch for that commit.
  for (const id of new Set(events.flatMap(event => event.type === 'moved' ? [event.actorId] : []))) {
    const before = input.map.tokens.find(token => token.id === id)
    const after = application.map.tokens.find(token => token.id === id)
    if (!before || !after || (before.x === after.x && before.y === after.y &&
      before.elevationFeet === after.elevationFeet && before.dnd5eTraversalMode === after.dnd5eTraversalMode)) continue
    application.tokenPatches = { ...application.tokenPatches, [id]: {
      ...application.tokenPatches?.[id], x: after.x, y: after.y,
      elevationFeet: after.elevationFeet, dnd5eTraversalMode: after.dnd5eTraversalMode,
    } }
    if (!application.changedTokenIds.includes(id)) application.changedTokenIds = [...application.changedTokenIds, id]
  }
  if (input.preserveOffMapParticipants) result.state = { ...state,
    combatants: { ...state.combatants, ...projectedState.combatants } }
  // A continuation can receive only its new events. Retain earlier spending
  // only while the final authority state still says that reaction is consumed.
  const spentReactionIds = [...new Set([
    ...(application.spentReactions?.tokenIds ?? []),
    ...(input.priorApplication?.spentReactions?.round === state.round
      ? input.priorApplication.spentReactions.tokenIds : []),
  ])].filter(id => projectedState.combatants[id]?.turn.reactionAvailable === false &&
    application.map.tokens.some(token => token.id === id))
  return {
    result,
    application: {
      ...application,
      spentReactions: spentReactionIds.length ? { round: state.round, tokenIds: spentReactionIds } : undefined,
      // Sunburst also edits scene darkness, which the entity planner cannot rebuild.
      geometry: application.geometry ?? input.priorApplication?.geometry,
      // The follow-up planner compares against the already-materialized map and
      // character snapshots from the first pass. An entity changed only by the
      // original action therefore has no new patch in this pass even though it
      // must still be committed. Preserve those original deltas, while allowing
      // a later concentration/reaction settlement to replace any field it
      // actually changed.
      tokenPatches: {
        ...(input.priorApplication?.tokenPatches ?? {}),
        ...Object.fromEntries(Object.entries(application.tokenPatches ?? {}).map(([id, patch]) =>
          [id, { ...input.priorApplication?.tokenPatches?.[id], ...patch }])),
      },
      characterPatches: {
        ...(input.priorApplication?.characterPatches ?? {}),
        ...Object.fromEntries(Object.entries(application.characterPatches ?? {}).map(([id, patch]) =>
          [id, { ...input.priorApplication?.characterPatches?.[id], ...patch }])),
      },
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

