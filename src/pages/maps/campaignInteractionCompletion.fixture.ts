import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import { normalizeSharedCampaignTime } from '../../lib/campaignTime'
import { mutateCampaignTimeState } from '../../../scripts/shared-server-core.mjs'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../../application/combat/dnd5eCombatRules'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'

export function campaignInteractionFixture(characterSource = true, rounds = 10, availableRounds = 10) {
  const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, languages: ['Common'], proficiencyBonus: 2,
    armorClass: 15, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('noncombat', [actor('source', 20), actor('bearer', 10), actor('other', 0)])
  state.active = false
  state.distanceFeetByCombatantPair = { ['bearer\u0000source']: 5 }
  state.combatants.bearer.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'prepare', definitionId: 'prepare', label: 'Prepare', targetId: 'bearer', source: { kind: 'feature', actorId: 'source', pluginId: 'test.timed' },
    duration: { type: 'rounds', remainingRounds: rounds, tickOn: 'target-turn-end' }, completionGrant: { activityIds: ['finish'], availableRounds, recipient: 'source', bindTarget: 'bearer' },
    removal: { sourceLink: { requiresSourceCommunication: true, requiresSharedLanguage: true } } })]
  state.combatants.other.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'other-buff', definitionId: 'other-buff', label: 'Other', targetId: 'other', source: { kind: 'feature', actorId: 'other' }, duration: { type: 'rounds', remainingRounds: 30, tickOn: 'target-turn-end' }, modifiers: { speedBonusFeet: 1 } })]
  const characters = characterSource ? [normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20, charClass: '法师', level: 1, dnd5eWorldTimeAppliedMinute: 480 })] : []
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: ['source', 'bearer', 'other'].map((id, index) => ({ id, characterId: id === 'source' && characterSource ? 'hero' : undefined, type: id === 'source' && characterSource ? 'player' : 'enemy', label: id, x: 25 + index * 50, y: 25, size: 1, color: '#fff', emoji: 'X', hp: 20, maxHp: 20, dnd5eCombatState: state.combatants[id].classState, dnd5eWorldTimeAppliedMinute: 480 })) }
  const host = { role: 'dm', memberId: 'host' }
  const started = mutateCampaignTimeState(null, { operation: 'start-interaction', id: 'talk', sourceId: 'source', bearerId: 'bearer', effectId: 'prepare', packageId: 'test.timed', requiredRounds: rounds, expectedWorldMinute: 480 }, 1, host, { host,
    interactionEntities: Object.values(state.combatants).map(actor => ({ id: actor.id, effects: actor.classState.activeEffects ?? [] })) })
  if (!started.ok) throw Error(started.error)
  const characterIdByCombatantId: Record<string, string> = characterSource ? { source: 'hero' } : {}
  return { state, clock: normalizeSharedCampaignTime(started.next), map, characters, characterIdByCombatantId, interactionId: 'talk', continuityConfirmed: true, now: 2 }
}
