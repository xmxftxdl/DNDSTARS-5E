import { expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { normalizeCharacter } from '../../store/characters'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { resolveDnd5eRoomCompanionTarget } from './roomCompanionTarget'

function fixture() {
  const maps = [{ id: 'a', dnd5ePlane: 'material', tokens: [{ id: 'owner-token', characterId: 'owner', type: 'player' }] },
    { id: 'b', dnd5ePlane: 'material', tokens: [{ id: 'companion', type: 'enemy', hp: 5,
      dnd5eSummon: { pluginId: 'local.test', featureId: 'create', bondKey: 'unique', sourceCharacterId: 'owner', sourceTokenId: 'old-owner-token' } }] }] as BattleMap[]
  return { maps, characters: [normalizeCharacter({ id: 'owner', name: 'Owner', maxHp: 30, currentHp: 30 })],
    actorMapId: 'a', actorTokenId: 'owner-token', targetMapId: 'b', targetTokenId: 'companion',
    packageId: 'local.test', sourceActivityId: 'create', bondKey: 'unique' }
}

it('finds an owned companion on a remote same-plane map using character identity after travel', () => {
  const input = fixture(), before = structuredClone(input)
  expect(resolveDnd5eRoomCompanionTarget(input).ok).toBe(true)
  expect(input).toEqual(before)
  input.maps[1].tokens[0].hp = 0
  expect(resolveDnd5eRoomCompanionTarget(input).ok).toBe(true) // unconscious is still alive
  input.maps[1].tokens[0].dnd5eCombatState = { deathRound: 1 }
  expect(resolveDnd5eRoomCompanionTarget(input).ok).toBe(false)
})

it('rejects unknown/different planes, wrong ownership/source, missing and ambiguous maps', () => {
  for (const field of ['sourceCharacterId', 'pluginId', 'featureId', 'bondKey'] as const) {
    const input = fixture(); input.maps[1].tokens[0].dnd5eSummon![field] = 'wrong'
    expect(resolveDnd5eRoomCompanionTarget(input).ok).toBe(false)
  }
  const input = fixture()
  input.maps[1].dnd5ePlane = undefined
  expect(resolveDnd5eRoomCompanionTarget(input)).toEqual({ ok: false, reason: 'plane-unknown' })
  input.maps[1].dnd5ePlane = 'shadow'
  expect(resolveDnd5eRoomCompanionTarget(input)).toEqual({ ok: false, reason: 'different-plane' })
  input.maps.push(input.maps[1])
  expect(resolveDnd5eRoomCompanionTarget(input)).toEqual({ ok: false, reason: 'invalid-target' })
})

it('does not let shared scene identity override an ethereal creature or banished target', () => {
  const input = fixture(), target = input.maps[1].tokens[0]
  const effect = createDnd5eMechanicalEffect({ id: 'phase', definitionId: 'phase', label: 'Phase', targetId: target.id,
    source: { kind: 'spell', actorId: 'owner-token' }, duration: { type: 'permanent' }, stackingKey: 'phase', stackingPolicy: 'replace' })
  effect.modifiers = { planarPhase: { plane: 'ethereal', ignoresMaterialCollision: true, suppressCrossPlaneEffects: true, unrestrictedVerticalMovement: true } }
  target.dnd5eCombatState = { activeEffects: [effect] }
  expect(resolveDnd5eRoomCompanionTarget(input)).toEqual({ ok: false, reason: 'different-plane' })
  effect.modifiers = undefined; effect.legacyCondition = 'banished'
  expect(resolveDnd5eRoomCompanionTarget(input)).toEqual({ ok: false, reason: 'plane-unknown' })
})
