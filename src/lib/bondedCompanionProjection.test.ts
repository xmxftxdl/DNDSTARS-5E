import { expect, it } from 'vitest'
import { projectMapsForPlayer } from '../../scripts/shared-server-core.mjs'

it('retains a remote persistent bonded ally only for its owner without granting scene vision', () => {
  const companion = { id: 'companion', type: 'enemy', x: 75, y: 75, hp: 5, maxHp: 5,
    dnd5eSummon: { sourceCharacterId: 'owner', side: 'player', persistent: true, bondEffectId: 'bond' },
    visibilityMode: 'normal' }
  const owner = { id: 'owner', roomMemberId: 'member-owner',
    dnd5eCombatState: { activeEffects: [{ id: 'bond' }] } }
  const state = { maps: [{ id: 'remote', width: 500, height: 500, gridSize: 50,
    tokens: [companion, { id: 'enemy', type: 'enemy', x: 125, y: 75 }] }] }
  const project = (memberId: string) => projectMapsForPlayer(state, { maps: [] }, 'owner',
    { characters: [owner] }, { memberId }).maps[0].tokens
  expect(project('member-owner').map((token: { id: string }) => token.id)).toEqual(['companion'])
  expect(project('other-member')).toEqual([])
  companion.visibilityMode = 'dm-only'
  expect(project('member-owner')).toEqual([])
  companion.visibilityMode = 'normal'
  companion.dnd5eSummon.side = 'enemy'
  expect(project('member-owner')).toEqual([])
  companion.dnd5eSummon.side = 'player'
  owner.dnd5eCombatState.activeEffects = []
  expect(project('member-owner')).toEqual([])
})
