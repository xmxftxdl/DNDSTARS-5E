import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { normalizeCharacter } from '../../store/characters'
import { dnd5eHasLivingSummonBond } from './livingSummonBond'

const actor = { id: 'caster', characterId: 'owner' } as Token
function run(token: Partial<Token>, characters = [] as ReturnType<typeof normalizeCharacter>[]) {
  return dnd5eHasLivingSummonBond({ actor, mapId: 'origin', packageId: 'test.bond', bondKey: 'unique', characters,
    maps: [{ id: 'remote', tokens: [{ id: 'companion', hp: 5,
      dnd5eSummon: { pluginId: 'test.bond', bondKey: 'unique', sourceCharacterId: 'owner', sourceTokenId: 'old-token' }, ...token }] } as BattleMap] })
}

it('keeps a cross-map bond through unconsciousness and unknown HP until confirmed death', () => {
  expect(run({})).toBe(true)
  expect(run({ hp: 0 })).toBe(true)
  expect(run({ hp: undefined, maxHp: undefined })).toBe(true)
  expect(run({ hp: 0, dnd5eCombatState: { deathRound: 2 } })).toBe(false)
  expect(run({ hp: 5, dnd5eCombatState: { deathRound: 2 } })).toBe(true)
})

it('uses linked character death authority rather than a stale token HP/death marker', () => {
  const token = { characterId: 'linked', hp: 0, dnd5eCombatState: { deathRound: 2 } }
  expect(run(token)).toBe(true)
  const character = normalizeCharacter({ id: 'linked', name: 'Linked', maxHp: 5, currentHp: 0, deathSaveFailures: 2 })
  expect(run(token, [character])).toBe(true)
  expect(run(token, [normalizeCharacter({ ...character, deathSaveFailures: 3 })])).toBe(false)
})

it('does not block another owner, package, or bond', () => {
  for (const patch of [{ sourceCharacterId: 'someone' }, { pluginId: 'other' }, { bondKey: 'other' }]) {
    expect(run({ dnd5eSummon: { pluginId: 'test.bond', bondKey: 'unique', sourceCharacterId: 'owner',
      sourceTokenId: 'caster', ...patch } as Token['dnd5eSummon'] })).toBe(false)
  }
})
