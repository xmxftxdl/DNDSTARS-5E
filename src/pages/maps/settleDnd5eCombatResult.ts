import type {
  BardicInspirationRollType,
  DmAdjudicationInterruptResponse,
} from '../../lib/combatInterruptProtocol'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eCombatantHasConcentrationEffect,
  dnd5eCombatantPairKey,
  dnd5eDarkOnesOwnLuckAvailable,
  dnd5eHeldBardicInspirationDie,
  dnd5eHellishRebukeSlotLevel,
  dnd5ePendingMonsterMechanicResolutions,
  dnd5ePendingMonsterDeathAreaEffects,
  dnd5ePostSpellRandomTablePlan,
  dnd5eRacialInnateSpellGrant,
  dnd5eSavingThrowMode,
  dnd5eSavingThrowRerollFeature,
  getDnd5eSrdMonster,
  planDnd5eMapResultApplication,
  previewDnd5eUnsupportedAirborneFalls,
  previewDnd5eSavingThrowRoll,
  resolveDnd5eHeadlessAction,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type Dnd5eMapResultPlan,
  type Dnd5eSpellTargetSavingThrowRoll,
} from '../../rulesets/dnd5e'
import { resolveDnd5eRollMode } from '../../rulesets/dnd5e/rollMode'

export async function settleDnd5eConcentrationChecks(input: {
  result: Extract<Dnd5eActionResult, { ok: true }>
  map: BattleMap
  characters: readonly Character[]
  priorApplication?: Pick<Dnd5eMapResultPlan, 'changedTokenIds' | 'changedCharacterIds'>
  characterIdByCombatantId: Readonly<Record<string, string>>
  rollD20: (label: string, targetName: string) => Promise<number>
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
}): Promise<{ result: Extract<Dnd5eActionResult, { ok: true }>; application: Dnd5eMapResultPlan }> {
  let state = input.result.state
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
  const rollHalflingLucky = async (
    combatant: Dnd5eCombatant,
    d20: number,
    d20Second: number | undefined,
    label: string,
    targetName: string,
  ) => ({
    first: combatant.racialRules?.halflingLucky && d20 === 1
      ? await input.rollD20(`半身人幸运·${label}重投`, targetName)
      : undefined,
    second: combatant.racialRules?.halflingLucky && d20Second === 1
      ? await input.rollD20(`半身人幸运·${label}重投`, targetName)
      : undefined,
  })
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
        const d20 = await input.rollD20(
          `随机表法术·${plan.effect.saveAbility.toUpperCase()} 豁免 DC ${plan.effect.saveDc}`,
          targetName,
        )
        const d20Second = mode !== 'normal'
          ? await input.rollD20('随机表法术·豁免（第二枚 d20）', targetName)
          : undefined
        const lucky = await rollHalflingLucky(
          target,
          d20,
          d20Second,
          'random-table spell save',
          targetName,
        )
        const blessRoll = dnd5eCombatantHasConcentrationEffect(state, target.id, 'bless')
          ? await input.rollD4('Bless: random-table spell save bonus', targetName)
          : undefined
        const baneRoll = dnd5eCombatantHasConcentrationEffect(state, target.id, 'bane')
          ? await input.rollD4('Bane: random-table spell save penalty', targetName)
          : undefined
        const modifier = (target.savingThrowBonuses[plan.effect.saveAbility] ??
          Math.floor((target.abilities[plan.effect.saveAbility] - 10) / 2)) +
          (blessRoll ?? 0) - (baneRoll ?? 0)
        const initial = previewDnd5eSavingThrowRoll({
          rolls: mode === 'normal'
            ? [lucky.first ?? d20]
            : [lucky.first ?? d20, lucky.second ?? d20Second ?? 0],
          mode,
          modifier,
          dc: plan.effect.saveDc,
        })
        const characterId = input.characterIdByCombatantId[targetId]
        const targetCharacter = characterId
          ? input.characters.find((character) => character.id === characterId)
          : undefined
        const inspirationDie = dnd5eHeldBardicInspirationDie(target)
        const bardicInspirationRoll = !initial.success && inspirationDie && input.requestBardicInspiration
          ? await input.requestBardicInspiration({
              target: targetCharacter,
              targetName,
              dieSides: inspirationDie,
              rollType: '豁免',
              total: initial.roll.total,
              targetNumber: plan.effect.saveDc,
            })
          : undefined
        const afterInspirationSuccess = initial.success ||
          initial.roll.total + (bardicInspirationRoll ?? 0) >= plan.effect.saveDc
        const darkOnesOwnLuckRoll = !afterInspirationSuccess &&
          dnd5eDarkOnesOwnLuckAvailable(target) && input.requestDarkOnesOwnLuck
          ? await input.requestDarkOnesOwnLuck({
              target: targetCharacter,
              targetName,
              rollType: '豁免',
              total: initial.roll.total + (bardicInspirationRoll ?? 0),
              targetNumber: plan.effect.saveDc,
            })
          : undefined
        const afterLuckSuccess = afterInspirationSuccess ||
          initial.roll.total + (bardicInspirationRoll ?? 0) +
            (darkOnesOwnLuckRoll ?? 0) >= plan.effect.saveDc
        const rerollFeature = dnd5eSavingThrowRerollFeature(target)
        const reroll = !afterLuckSuccess && rerollFeature && targetCharacter &&
          input.requestSavingThrowReroll
          ? await input.requestSavingThrowReroll({
              target: targetCharacter,
              targetName,
              featureName: rerollFeature.name,
              total: initial.roll.total,
              dc: plan.effect.saveDc,
              mode,
            })
          : undefined
        if (!afterLuckSuccess && (target.classState.legendaryResistanceUses ?? 0) > 0) {
          legendaryResistanceTargetIds.push(target.id)
        }
        targetSavingThrows.push({
          targetId,
          d20,
          d20Second,
          halflingLuckyD20: lucky.first,
          halflingLuckyD20Second: lucky.second,
          blessRoll,
          baneRoll,
          rerollD20: reroll?.d20,
          rerollD20Second: reroll?.d20Second,
          bardicInspirationRoll,
          darkOnesOwnLuckRoll,
        })
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
    })
    if (!resolved.ok) continue
    if (plan.effect) {
      const nested = await settleDnd5eConcentrationChecks({
        ...input,
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
    const d20 = await input.rollD20(`坚韧狂暴·体质豁免 DC ${check.dc}`, targetName)
    const mode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    const d20Second = mode !== 'normal'
      ? await input.rollD20('坚韧狂暴·体质豁免（第二枚 d20）', targetName)
      : undefined
    const halflingLucky = await rollHalflingLucky(combatant, d20, d20Second, '坚韧狂暴豁免', targetName)
    const modifier = combatant.savingThrowBonuses.con ?? Math.floor((combatant.abilities.con - 10) / 2)
    const blessRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bless')
      ? await input.rollD4('祝福术·坚韧狂暴豁免加值', targetName)
      : undefined
    const baneRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bane')
      ? await input.rollD4('灾祸术·坚韧狂暴豁免减值', targetName)
      : undefined
    const initial = previewDnd5eSavingThrowRoll({
      rolls: mode === 'normal'
        ? [halflingLucky.first ?? d20]
        : [halflingLucky.first ?? d20, halflingLucky.second ?? d20Second ?? 0],
      mode,
      modifier: modifier + (blessRoll ?? 0) - (baneRoll ?? 0),
      dc: check.dc,
    })
    const characterId = input.characterIdByCombatantId[check.targetId]
    const target = characterId ? input.characters.find((character) => character.id === characterId) : undefined
    const inspirationDie = dnd5eHeldBardicInspirationDie(combatant)
    const bardicInspirationRoll = !initial.success && inspirationDie && input.requestBardicInspiration
      ? await input.requestBardicInspiration({
          target, targetName, dieSides: inspirationDie, rollType: '豁免',
          total: initial.roll.total, targetNumber: check.dc,
        })
      : undefined
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'barbarian-relentless-rage-save', actorId: check.targetId, d20, d20Second,
      halflingLuckyD20: halflingLucky.first, halflingLuckyD20Second: halflingLucky.second,
      blessRoll, baneRoll, bardicInspirationRoll, dc: check.dc,
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
    const d20 = await input.rollD20(`亡灵坚韧·体质豁免 DC ${check.dc}`, targetName)
    const d20Second = mode !== 'normal'
      ? await input.rollD20(`亡灵坚韧·体质豁免（${mode === 'advantage' ? '优势' : '劣势'}）`, targetName)
      : undefined
    const blessRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bless')
      ? await input.rollD4('祝福术·亡灵坚韧豁免加值', targetName)
      : undefined
    const baneRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bane')
      ? await input.rollD4('灾祸术·亡灵坚韧豁免减值', targetName)
      : undefined
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'monster-undead-fortitude-save', actorId: check.targetId,
      d20, d20Second, blessRoll, baneRoll,
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
    const d20 = await input.rollD20(`怪物命中特效·${check.ability.toUpperCase()} 豁免 DC ${check.dc}`, targetName)
    const d20Second = mode !== 'normal'
      ? await input.rollD20(`怪物命中特效豁免（${mode === 'advantage' ? '优势' : '劣势'}）`, targetName)
      : undefined
    const halflingLucky = await rollHalflingLucky(combatant, d20, d20Second, '命中特效豁免', targetName)
    const blessRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bless')
      ? await input.rollD4('祝福术·怪物命中特效豁免加值', targetName)
      : undefined
    const baneRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bane')
      ? await input.rollD4('灾祸术·怪物命中特效豁免减值', targetName)
      : undefined
    const modifier = combatant.savingThrowBonuses[check.ability] ??
      Math.floor((combatant.abilities[check.ability] - 10) / 2)
    const initial = previewDnd5eSavingThrowRoll({
      rolls: mode === 'normal'
        ? [halflingLucky.first ?? d20]
        : [halflingLucky.first ?? d20, halflingLucky.second ?? d20Second ?? 0],
      mode,
      modifier: modifier + (blessRoll ?? 0) - (baneRoll ?? 0),
      dc: check.dc,
    })
    const characterId = input.characterIdByCombatantId[check.targetId]
    const target = characterId ? input.characters.find((character) => character.id === characterId) : undefined
    const inspirationDie = dnd5eHeldBardicInspirationDie(combatant)
    const bardicInspirationRoll = !initial.success && inspirationDie && input.requestBardicInspiration
      ? await input.requestBardicInspiration({
          target, targetName, dieSides: inspirationDie, rollType: '豁免',
          total: initial.roll.total, targetNumber: check.dc,
        })
      : undefined
    const afterInspirationSuccess = initial.success || initial.roll.total + (bardicInspirationRoll ?? 0) >= check.dc
    const darkOnesOwnLuckRoll = !afterInspirationSuccess && dnd5eDarkOnesOwnLuckAvailable(combatant) && input.requestDarkOnesOwnLuck
      ? await input.requestDarkOnesOwnLuck({
          target, targetName, rollType: '豁免',
          total: initial.roll.total + (bardicInspirationRoll ?? 0), targetNumber: check.dc,
        })
      : undefined
    const afterLuckSuccess = afterInspirationSuccess ||
      initial.roll.total + (bardicInspirationRoll ?? 0) + (darkOnesOwnLuckRoll ?? 0) >= check.dc
    const rerollFeature = dnd5eSavingThrowRerollFeature(combatant)
    const reroll = !afterLuckSuccess && rerollFeature && target && input.requestSavingThrowReroll
      ? await input.requestSavingThrowReroll({
          target, targetName, featureName: rerollFeature.name,
          total: initial.roll.total, dc: check.dc, mode,
        })
      : undefined
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'monster-on-hit-save', actorId: check.targetId,
      sourceId: check.sourceId, actionId: check.actionId,
      d20, d20Second, blessRoll, baneRoll,
      halflingLuckyD20: halflingLucky.first, halflingLuckyD20Second: halflingLucky.second,
      rerollD20: reroll?.d20, rerollD20Second: reroll?.d20Second,
      bardicInspirationRoll, darkOnesOwnLuckRoll,
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
    const d20 = await input.rollD20(`${label} DC ${check.dc}`, targetName)
    const d20Second = mode !== 'normal'
      ? await input.rollD20(`${label}（${mode === 'advantage' ? '优势' : '劣势'}）`, targetName)
      : undefined
    const halflingLucky = await rollHalflingLucky(combatant, d20, d20Second, '龙威豁免', targetName)
    const blessRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bless')
      ? await input.rollD4('祝福术·龙威豁免加值', targetName)
      : undefined
    const baneRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bane')
      ? await input.rollD4('灾祸术·龙威豁免减值', targetName)
      : undefined
    const modifier = combatant.savingThrowBonuses.wis ?? Math.floor((combatant.abilities.wis - 10) / 2)
    const initial = previewDnd5eSavingThrowRoll({
      rolls: mode === 'normal'
        ? [halflingLucky.first ?? d20]
        : [halflingLucky.first ?? d20, halflingLucky.second ?? d20Second ?? 0],
      mode,
      modifier: modifier + (blessRoll ?? 0) - (baneRoll ?? 0),
      dc: check.dc,
    })
    const characterId = input.characterIdByCombatantId[check.targetId]
    const target = characterId ? input.characters.find((character) => character.id === characterId) : undefined
    const inspirationDie = dnd5eHeldBardicInspirationDie(combatant)
    const bardicInspirationRoll = !initial.success && inspirationDie && input.requestBardicInspiration
      ? await input.requestBardicInspiration({
          target, targetName, dieSides: inspirationDie, rollType: '豁免',
          total: initial.roll.total, targetNumber: check.dc,
        })
      : undefined
    const afterInspirationSuccess = initial.success || initial.roll.total + (bardicInspirationRoll ?? 0) >= check.dc
    const darkOnesOwnLuckRoll = !afterInspirationSuccess && dnd5eDarkOnesOwnLuckAvailable(combatant) && input.requestDarkOnesOwnLuck
      ? await input.requestDarkOnesOwnLuck({
          target, targetName, rollType: '豁免',
          total: initial.roll.total + (bardicInspirationRoll ?? 0), targetNumber: check.dc,
        })
      : undefined
    const afterLuckSuccess = afterInspirationSuccess ||
      initial.roll.total + (bardicInspirationRoll ?? 0) + (darkOnesOwnLuckRoll ?? 0) >= check.dc
    const rerollFeature = dnd5eSavingThrowRerollFeature(combatant)
    const reroll = !afterLuckSuccess && rerollFeature && target && input.requestSavingThrowReroll
      ? await input.requestSavingThrowReroll({
          target, targetName, featureName: rerollFeature.name,
          total: initial.roll.total, dc: check.dc, mode,
        })
      : undefined
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'sorcerer-draconic-presence-save', actorId: combatant.id, sourceId: source.id,
      d20, d20Second, blessRoll, baneRoll,
      halflingLuckyD20: halflingLucky.first, halflingLuckyD20Second: halflingLucky.second,
      rerollD20: reroll?.d20, rerollD20Second: reroll?.d20Second,
      bardicInspirationRoll, darkOnesOwnLuckRoll,
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
    const d20 = await input.rollD20(`受伤触发·${check.ability.toUpperCase()} 豁免 DC ${check.dc}`, targetName)
    const d20Second = mode !== 'normal'
      ? await input.rollD20(`受伤触发豁免（${mode === 'advantage' ? '优势' : '劣势'}）`, targetName)
      : undefined
    const halflingLucky = await rollHalflingLucky(combatant, d20, d20Second, '受伤触发豁免', targetName)
    const blessRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bless')
      ? await input.rollD4('祝福术·受伤触发豁免加值', targetName)
      : undefined
    const baneRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bane')
      ? await input.rollD4('灾祸术·受伤触发豁免减值', targetName)
      : undefined
    const modifier = combatant.savingThrowBonuses[check.ability] ??
      Math.floor((combatant.abilities[check.ability] - 10) / 2)
    const initial = previewDnd5eSavingThrowRoll({
      rolls: mode === 'normal'
        ? [halflingLucky.first ?? d20]
        : [halflingLucky.first ?? d20, halflingLucky.second ?? d20Second ?? 0],
      mode,
      modifier: modifier + (blessRoll ?? 0) - (baneRoll ?? 0),
      dc: check.dc,
    })
    const characterId = input.characterIdByCombatantId[check.targetId]
    const target = characterId ? input.characters.find((character) => character.id === characterId) : undefined
    const inspirationDie = dnd5eHeldBardicInspirationDie(combatant)
    const bardicInspirationRoll = !initial.success && inspirationDie && input.requestBardicInspiration
      ? await input.requestBardicInspiration({
          target, targetName, dieSides: inspirationDie, rollType: '豁免',
          total: initial.roll.total, targetNumber: check.dc,
        })
      : undefined
    const afterInspirationSuccess = initial.success || initial.roll.total + (bardicInspirationRoll ?? 0) >= check.dc
    const darkOnesOwnLuckRoll = !afterInspirationSuccess && dnd5eDarkOnesOwnLuckAvailable(combatant) && input.requestDarkOnesOwnLuck
      ? await input.requestDarkOnesOwnLuck({
          target, targetName, rollType: '豁免',
          total: initial.roll.total + (bardicInspirationRoll ?? 0), targetNumber: check.dc,
        })
      : undefined
    const afterLuckSuccess = afterInspirationSuccess ||
      initial.roll.total + (bardicInspirationRoll ?? 0) + (darkOnesOwnLuckRoll ?? 0) >= check.dc
    const rerollFeature = dnd5eSavingThrowRerollFeature(combatant)
    const reroll = !afterLuckSuccess && rerollFeature && target && input.requestSavingThrowReroll
      ? await input.requestSavingThrowReroll({
          target, targetName, featureName: rerollFeature.name,
          total: initial.roll.total, dc: check.dc, mode,
        })
      : undefined
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'active-effect-damage-save', actorId: combatant.id, effectId: check.effectId,
      d20, d20Second, blessRoll, baneRoll,
      halflingLuckyD20: halflingLucky.first, halflingLuckyD20Second: halflingLucky.second,
      rerollD20: reroll?.d20, rerollD20Second: reroll?.d20Second,
      bardicInspirationRoll, darkOnesOwnLuckRoll,
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
    const d20 = await input.rollD20(`专注·体质豁免 DC ${check.dc}`, targetName)
    const mode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    const d20Second = mode !== 'normal'
      ? await input.rollD20('专注·体质豁免（第二枚 d20）', targetName)
      : undefined
    const halflingLucky = await rollHalflingLucky(combatant, d20, d20Second, '专注豁免', targetName)
    const modifier = combatant.savingThrowBonuses.con ?? Math.floor((combatant.abilities.con - 10) / 2)
    const blessRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bless')
      ? await input.rollD4('祝福术·专注豁免加值', targetName)
      : undefined
    const baneRoll = dnd5eCombatantHasConcentrationEffect(state, combatant.id, 'bane')
      ? await input.rollD4('灾祸术·专注豁免减值', targetName)
      : undefined
    const initial = previewDnd5eSavingThrowRoll({
      rolls: mode === 'normal'
        ? [halflingLucky.first ?? d20]
        : [halflingLucky.first ?? d20, halflingLucky.second ?? d20Second ?? 0],
      mode,
      modifier: modifier + (blessRoll ?? 0) - (baneRoll ?? 0),
      dc: check.dc,
    })
    const inspirationDie = dnd5eHeldBardicInspirationDie(combatant)
    const characterId = input.characterIdByCombatantId[check.targetId]
    const target = characterId ? input.characters.find((character) => character.id === characterId) : undefined
    const bardicInspirationRoll = !initial.success && inspirationDie && input.requestBardicInspiration
      ? await input.requestBardicInspiration({
          target, targetName, dieSides: inspirationDie, rollType: '豁免',
          total: initial.roll.total, targetNumber: check.dc,
        })
      : undefined
    const afterInspirationSuccess = initial.success || initial.roll.total + (bardicInspirationRoll ?? 0) >= check.dc
    const darkOnesOwnLuckRoll = !afterInspirationSuccess && dnd5eDarkOnesOwnLuckAvailable(combatant) && input.requestDarkOnesOwnLuck
      ? await input.requestDarkOnesOwnLuck({
          target,
          targetName,
          rollType: '豁免',
          total: initial.roll.total + (bardicInspirationRoll ?? 0),
          targetNumber: check.dc,
        })
      : undefined
    const afterLuckSuccess = afterInspirationSuccess ||
      initial.roll.total + (bardicInspirationRoll ?? 0) + (darkOnesOwnLuckRoll ?? 0) >= check.dc
    const feature = dnd5eSavingThrowRerollFeature(combatant)
    const reroll = !afterLuckSuccess && feature && target && input.requestSavingThrowReroll
      ? await input.requestSavingThrowReroll({
          target,
          targetName,
          featureName: feature.name,
          total: initial.roll.total,
          dc: check.dc,
          mode,
        })
      : undefined
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'concentration-save', actorId: check.targetId, d20, d20Second,
      halflingLuckyD20: halflingLucky.first, halflingLuckyD20Second: halflingLucky.second,
      blessRoll,
      baneRoll,
      rerollD20: reroll?.d20, rerollD20Second: reroll?.d20Second,
      bardicInspirationRoll, darkOnesOwnLuckRoll, dc: check.dc,
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
        const d20 = await input.rollD20(
          `${monster.name}·${rule.ruleId} ${rule.ability.toUpperCase()} 豁免 DC ${rule.dc}`,
          targetName,
        )
        const d20Second = mode !== 'normal'
          ? await input.rollD20(
              `${monster.name}·${rule.ruleId} 豁免（${
                mode === 'advantage' ? '优势' : '劣势'
              }）`,
              targetName,
            )
          : undefined
        const lucky = await rollHalflingLucky(
          target,
          d20,
          d20Second,
          `${rule.ruleId} 豁免`,
          targetName,
        )
        const blessRoll = dnd5eCombatantHasConcentrationEffect(
          state,
          target.id,
          'bless',
        )
          ? await input.rollD4('祝福术·死亡爆发豁免加值', targetName)
          : undefined
        const baneRoll = dnd5eCombatantHasConcentrationEffect(
          state,
          target.id,
          'bane',
        )
          ? await input.rollD4('灾祸术·死亡爆发豁免减值', targetName)
          : undefined
        const modifier =
          (target.savingThrowBonuses[rule.ability] ??
            Math.floor((target.abilities[rule.ability] - 10) / 2)) +
          (blessRoll ?? 0) -
          (baneRoll ?? 0)
        const preview = previewDnd5eSavingThrowRoll({
          rolls: mode === 'normal'
            ? [lucky.first ?? d20]
            : [
                lucky.first ?? d20,
                lucky.second ?? d20Second ?? 0,
              ],
          mode,
          modifier,
          dc: rule.dc,
        })
        if (
          !preview.success &&
          (target.classState.legendaryResistanceUses ?? 0) > 0
        ) {
          legendaryResistanceTargetIds.push(target.id)
        }
        targetSavingThrows.push({
          targetId: target.id,
          d20,
          d20Second,
          halflingLuckyD20: lucky.first,
          halflingLuckyD20Second: lucky.second,
          blessRoll,
          baneRoll,
        })
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
      })
      if (resolved.ok) {
        const nested = await settleDnd5eConcentrationChecks({
          ...input,
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
      const slotLevel = reactor ? dnd5eHellishRebukeSlotLevel(reactor) : undefined
      const distance = reactor && damageSource
        ? state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(reactor.id, damageSource.id)]
        : undefined
      if (
        !reactor || !damageSource || damageSource.currentHp <= 0 || damageSource.deathSaves.dead ||
        !reactorCharacter || slotLevel == null ||
        reactor.controller === damageSource.controller || !Number.isFinite(distance) || distance! > 60 ||
        state.lineOfEffectBlockedByCombatantPair?.[`${reactor.id}\u0000${damageSource.id}`]
      ) continue
      const accepted = await input.requestHellishRebuke({
        reactor: reactorCharacter,
        reactorTokenId: damageEvent.targetId,
        targetTokenId: damageEvent.sourceId,
        sourceName: input.map.tokens.find((token) => token.id === damageSource.id)?.label ?? damageSource.name,
        damage: damageEvent.amount,
        slotLevel,
      })
      if (!accepted) continue
      const mode = dnd5eSavingThrowMode(damageSource, 'dex', {
        effectVisible: true,
        sourceCreatureType: reactor.creatureType,
        sourceIsSpell: true,
      })
      const sourceName = input.map.tokens.find((token) => token.id === damageSource.id)?.label ?? damageSource.name
      const savingThrowD20 = await input.rollD20('炼狱叱喝·敏捷豁免', sourceName)
      const savingThrowD20Second = mode !== 'normal'
        ? await input.rollD20(`炼狱叱喝·敏捷豁免（${mode === 'advantage' ? '优势' : '劣势'}）`, sourceName)
        : undefined
      const halflingLucky = await rollHalflingLucky(
        damageSource,
        savingThrowD20,
        savingThrowD20Second,
        '炼狱叱喝豁免',
        sourceName,
      )
      const savingThrowBlessRoll = dnd5eCombatantHasConcentrationEffect(state, damageSource.id, 'bless')
        ? await input.rollD4('祝福术·炼狱叱喝豁免加值', sourceName)
        : undefined
      const savingThrowBaneRoll = dnd5eCombatantHasConcentrationEffect(state, damageSource.id, 'bane')
        ? await input.rollD4('灾祸术·炼狱叱喝豁免减值', sourceName)
        : undefined
      const effectRolls = await input.rollDice(
        slotLevel + 1,
        10,
        '炼狱叱喝·火焰伤害',
        sourceName,
      )
      const racialInnate = dnd5eRacialInnateSpellGrant(reactor.racialRules, 'hellish-rebuke')?.castAtLevel === slotLevel
      const reaction = await resolveWithUnsupportedAirborneFalls(state, {
        type: 'hellish-rebuke', actorId: reactor.id, targetId: damageSource.id,
        racialInnate,
        slotLevel, triggerDamageAmount: damageEvent.amount,
        savingThrowD20, savingThrowD20Second, savingThrowBlessRoll, savingThrowBaneRoll,
        halflingLuckyD20: halflingLucky.first,
        halflingLuckyD20Second: halflingLucky.second,
        effectRolls,
      })
      if (!reaction.ok) continue
      const nested = await settleDnd5eConcentrationChecks({
        ...input,
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
      result: resolved,
    })
    state = nested.result.state
    events.push(...nested.result.events)
  }
  const result = { ok: true as const, state, events }
  const application = planDnd5eMapResultApplication({
    state,
    map: input.map,
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
