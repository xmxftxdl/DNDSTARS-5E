import {expect,it} from 'vitest'
import {projectCharactersForRoomMember,projectMapsForPlayer} from '../../scripts/shared-server-core.mjs'
it('shows damage-trait receipts only on the owning character, never in public token state', () => {
  const damageTraitReports = { detect: { mapId: 'map', sourceActivityId: 'detect',
    targetId:'enemy',targetName:'Target',round:1,report:{immunities:['poison'],resistances:[],vulnerabilities:[],conditional:[]} } }
  const characters = { characters: [
    { id: 'own', roomMemberId: 'player-a', dnd5eCombatState: { damageTraitReports } },
    { id: 'party', roomMemberId: 'player-b', dnd5eCombatState: { damageTraitReports } },
  ] }
  const view = projectCharactersForRoomMember(characters, { memberId: 'player-a' }) as typeof characters
  expect(view.characters[0].dnd5eCombatState.damageTraitReports).toEqual(damageTraitReports)
  expect(view.characters[1].dnd5eCombatState.damageTraitReports).toBeUndefined()
  const maps = { maps: [{ id: 'map', width: 100, height: 100, gridSize: 10, tokens: [
    { id: 'actor', characterId: 'own', type: 'player', x: 20, y: 20, size: 1,
      dnd5eCombatState: { damageTraitReports } },
  ] }] }
  const projected = projectMapsForPlayer(maps, { maps: [] }, 'own', characters)
  expect(JSON.stringify(projected)).not.toContain('damageTraitReports')
  expect(characters.characters[1].dnd5eCombatState.damageTraitReports).toEqual(damageTraitReports)
})

