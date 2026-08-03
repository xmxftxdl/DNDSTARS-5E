import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { imposeDnd5eRollDisadvantage } from './rollMode'
import {
  dnd5eCombatantHasConcentrationEffect,
  resolveDnd5ePersistentAreaTrigger,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5ePersistentAreaDmAdjustment,
  type Dnd5eSpellDamageMaxDieBonusUse,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import {
  recordDnd5ePersistentAreaTrigger,
  type Dnd5ePersistentAreaTriggerCandidate,
} from './pluginAreas'
import { normalizeDnd5eActiveEffects } from './activeEffects'
import { getDnd5eSrdCombatSpell } from './spells'

export interface PreparedDnd5ePersistentAreaTrigger {
  candidate: Dnd5ePersistentAreaTriggerCandidate
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  targetName: string
  save?: {
    ability: NonNullable<Dnd5ePersistentAreaTriggerCandidate['trigger']['savingThrow']>['ability']
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }
}

export function prepareDnd5ePersistentAreaTrigger(input: {
  combatId: string
  round: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  candidate: Dnd5ePersistentAreaTriggerCandidate
}): { ok: true; prepared: PreparedDnd5ePersistentAreaTrigger } | { ok: false; reason: string } {
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    turnSlotId: input.initiativeOrder.find((entry) => entry.tokenId === input.candidate.targetToken.id)?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const source = snapshot.state.combatants[input.candidate.area.sourceTokenId]
  const target = snapshot.state.combatants[input.candidate.targetToken.id]
  if (!source || !target || target.deathSaves.dead) return { ok: false, reason: 'combatant-missing' }
  const coreSpell = input.candidate.area.sourceKind === 'core-spell' && input.candidate.area.coreSpellId
    ? getDnd5eSrdCombatSpell(input.candidate.area.coreSpellId)
    : undefined
  const saveContext = {
    effectVisible: true,
    sourceCreatureType: source.creatureType,
    sourceIsSpell: !!coreSpell,
  } as const
  const skipSaveCondition = input.candidate.trigger.skipSaveWhenSourceConditionActive
  const hasSourceCondition = skipSaveCondition
    ? normalizeDnd5eActiveEffects(target.classState.activeEffects).some((effect) =>
        effect.standardCondition === skipSaveCondition &&
        effect.source.actorId === source.id &&
        effect.source.rulesId === input.candidate.area.coreSpellId,
      )
    : false
  const save = input.candidate.trigger.savingThrow && !hasSourceCondition
    ? {
        ability: input.candidate.trigger.savingThrow.ability,
        dc: input.candidate.trigger.savingThrow.dc,
        mode: input.candidate.trigger.savingThrow.shapechangerDisadvantage && target.shapechanger
          ? imposeDnd5eRollDisadvantage(
              dnd5eSavingThrowMode(target, input.candidate.trigger.savingThrow.ability, saveContext),
              'moonbeam-shapechanger',
            ).mode
          : dnd5eSavingThrowMode(target, input.candidate.trigger.savingThrow.ability, saveContext),
        blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, target.id, 'bless'),
        baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, target.id, 'bane'),
      }
    : undefined
  return {
    ok: true,
    prepared: {
      candidate: input.candidate,
      state: snapshot.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      targetName: target.name,
      save,
    },
  }
}

export function resolvePreparedDnd5ePersistentAreaTrigger(input: {
  prepared: PreparedDnd5ePersistentAreaTrigger
  d20?: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  damageRolls?: readonly number[]
  spellDamageMaxDieBonus?: Dnd5eSpellDamageMaxDieBonusUse
  dmAdjustment?: Dnd5ePersistentAreaDmAdjustment
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5ePersistentAreaTrigger(prepared.state, {
    areaId: prepared.candidate.area.id,
    areaSourceKind: prepared.candidate.area.sourceKind,
    coreSpellId: prepared.candidate.area.coreSpellId,
    castingClassId: prepared.candidate.area.castingClassId,
    sourceId: prepared.candidate.area.sourceTokenId,
    targetId: prepared.candidate.targetToken.id,
    trigger: prepared.candidate.trigger,
    d20: input.d20,
    d20Second: input.d20Second,
    blessRoll: input.blessRoll,
    baneRoll: input.baneRoll,
    damageRolls: input.damageRolls,
    spellDamageMaxDieBonus: input.spellDamageMaxDieBonus,
    dmAdjustment: input.dmAdjustment,
  })
  if (!result.ok) return { result }
  const map = {
    ...prepared.map,
    dnd5ePluginAreas: recordDnd5ePersistentAreaTrigger(
      prepared.map.dnd5ePluginAreas,
      prepared.candidate,
      result.state.round,
    ),
  }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    }),
  }
}
