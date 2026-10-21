import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eAbilityCheckRollMode, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { recognizeAreasByVisualSearch, visualSearchAuthorityStamp, canSeeRecognizableArea } from './areaVisualRecognition'
import { dnd5eRollDiceRecipes } from './rollDiceModifiers'
import { dnd5eRollDiceOccurrenceId } from './rollDiceTransaction'
import { getDnd5eSrdMonster } from './monsters'

export function prepareMonsterVisualSearch(input: {
  map: BattleMap; characters: readonly Character[]; actorTokenId: string; transactionId: string;
  worldMinute: number; round: number; combatId?: string; initiativeOrder: readonly InitiativeEntry[];
  turnEconomy?: Dnd5eTurnEconomyCounts;
  investigatedAreaId?: string;
  searchSkill?: 'perception' | 'investigation';
}) {
  const token = input.map.tokens.find(candidate => candidate.id === input.actorTokenId)
  if (!token || token.type !== 'enemy' || token.characterId || !token.poolId || !getDnd5eSrdMonster(token.poolId)) return undefined
  const snapshot = createDnd5eMapCombatSnapshot({ ...input, combatId: input.combatId ?? `search:${input.map.id}` })
  const actor = snapshot.state.combatants[token.id], index = snapshot.state.initiativeOrder.indexOf(token.id)
  if (!actor || index < 0 || actor.currentHp <= 0) return undefined
  const illusion = input.investigatedAreaId ? input.map.dnd5ePluginAreas?.find(area => area.id === input.investigatedAreaId) : undefined
  if (input.investigatedAreaId && (!illusion?.illusionRecognition || input.round > illusion.expiresAfterRound ||
    (illusion.expiresAtWorldMinute != null && input.worldMinute >= illusion.expiresAtWorldMinute) ||
    !canSeeRecognizableArea(input.map, illusion, token, input.characters, input.worldMinute))) return undefined

  if (input.turnEconomy) actor.turn = { ...actor.turn, actionAvailable: input.turnEconomy.action.current > 0 }
  const investigating = !!illusion || input.searchSkill === 'investigation'
  const action = { type: 'ability-check' as const, actorId: token.id, ability: investigating ? 'int' as const : 'wis' as const,
    skill: investigating ? 'investigation' as const : 'perception' as const, context: investigating ? undefined : 'sight' as const, dc: illusion?.illusionRecognition?.dc ?? 0, spendAction: !!input.combatId }
  const state = { ...snapshot.state, initiativeIndex: index }
  return { input, token, snapshot, state, action,
    stamp: visualSearchAuthorityStamp(input.map, input.characters, input.worldMinute),
    mode: dnd5eAbilityCheckRollMode(actor, action),
    effectDice: dnd5eRollDiceRecipes({ actorId: actor.id, effects: actor.classState.activeEffects, kind: 'ability-check',
      eventId: dnd5eRollDiceOccurrenceId(input.transactionId, actor.id, 'ability-check', 0) }),
  }
}

export function resolveMonsterVisualSearch(prepared: NonNullable<ReturnType<typeof prepareMonsterVisualSearch>>,
  dice: { d20: number; d20Second?: number; effectRollDice?: Record<string, readonly number[]> }) {
  const result = resolveDnd5eHeadlessAction(prepared.state, { ...prepared.action, ...dice }, { transactionId: prepared.input.transactionId })
  if (!result.ok) return { result }
  const application = planDnd5eMapResultApplication({ state: result.state, map: prepared.input.map,
    characters: prepared.input.characters, characterIdByCombatantId: prepared.snapshot.characterIdByCombatantId, events: [...result.events] })
  const check = result.events.find(event => event.type === 'ability-check-resolved')
  if (check?.type === 'ability-check-resolved' && prepared.input.investigatedAreaId) {
    application.map = { ...application.map, dnd5ePluginAreas: application.map.dnd5ePluginAreas?.map(area =>
      area.id === prepared.input.investigatedAreaId && area.illusionRecognition && check.total >= area.illusionRecognition.dc
        ? { ...area, illusionRecognition: { ...area.illusionRecognition, knownTokenIds: [...new Set([...area.illusionRecognition.knownTokenIds, prepared.token.id])] } } : area) }
  }
  if (check?.type === 'ability-check-resolved' && !prepared.input.investigatedAreaId) application.map = recognizeAreasByVisualSearch({
    map: application.map, characters: application.characters, actorTokenId: prepared.token.id, total: check.total,
    skill: prepared.action.skill,
    worldMinute: prepared.input.worldMinute, round: prepared.input.round,
  })
  return { result, application, check }
}
