import { normalizeCharacter } from '../../store/characters'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { settleDnd5eShortRestRecovery } from './shortRestRecoveryAuthority'

export function shortRestRecoveryFixture(): Parameters<typeof settleDnd5eShortRestRecovery>[0] {
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '战士', level: 3,
    currentHp: 1, maxHp: 100, abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    hitPointDice: [{ sides: 10, current: 3, max: 3 }], dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({
      definitionId: 'conditional-healing', label: 'Conditional healing', targetId: 'hero', source: { kind: 'plugin' },
      modifiers: { maximizeHealingDiceNearCompanion: [{ maximumDistanceFeet: 100, bondKey: 'familiar' }] } })] } })
  const bard = normalizeCharacter({ id: 'bard', name: 'Bard', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '吟游诗人', level: 2 })
  const owner: Token = { id: 'owner', characterId: 'hero', label: 'Hero', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const companion: Token = { ...owner, id: 'pet', characterId: undefined, type: 'npc', hp: 1,
    dnd5eSummon: { schemaVersion: 1, pluginId: 'test.pet', featureId: 'summon', sourceTokenId: 'owner', sourceCharacterId: 'hero',
      side: 'player', createdRound: 1, expiresAfterRound: 10, persistent: true, bondKey: 'familiar' } }
  const map: BattleMap = { id: 'map', name: 'Map', width: 2000, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [owner, companion] }
  return { command: { id: 'command', advanceId: 'rest', characterId: 'hero', mapId: map.id, tokenId: owner.id,
    poolIndex: 0, expectedPoolCurrent: 3, songOfRestBardId: 'bard' }, controlledCharacterIds: ['hero'], characters: [hero, bard],
    map, round: 1, geometry: null, worldMinute: 120, combatActive: false,
    advances: [{ id: 'rest', kind: 'short-rest', fromWorldMinute: 60, toWorldMinute: 120, minutes: 60,
      reason: 'Rest', dawnsCrossed: 0, expiredTimerIds: [], beneficiaryCharacterIds: ['hero', 'bard'], createdAt: 1 }],
    journal: { schemaVersion: 1, receipts: [] }, hitDieRoll: 1, songOfRestRoll: 1, songOfRestEligibleBardIds: ['bard'] }
}
