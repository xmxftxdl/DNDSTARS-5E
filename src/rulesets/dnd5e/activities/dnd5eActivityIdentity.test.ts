import { describe, expect, it } from 'vitest'
import type { Dnd5eHeadlessCombatState, Dnd5eHeadlessObservedAction } from '../headlessCombatEngine'
import {
  dnd5eTrackableDefinitionIdForActionV1,
  dnd5eTrackableDefinitionIdV1,
  parseDnd5eTrackableDefinitionIdV1,
} from './dnd5eActivityIdentity'
import { listDnd5eTrackableDefinitionsV1 } from './dnd5eTrackableCatalog'

const state = {
  combatants: {
    wizard: { id: 'wizard', mainWeaponId: 'srd-5.1:quarterstaff' },
    goblin: { id: 'goblin', statBlockId: 'srd-5.1:goblin' },
  },
} as unknown as Pick<Dnd5eHeadlessCombatState, 'combatants'>

function action(value: Record<string, unknown>): Dnd5eHeadlessObservedAction {
  return value as unknown as Dnd5eHeadlessObservedAction
}

describe('D&D 5e stable activity identities', () => {
  it('creates deterministic ids and preserves kind boundaries', () => {
    expect(dnd5eTrackableDefinitionIdV1({ namespace: 'srd-5.1', kind: 'spell', localId: 'fireball' }))
      .toBe('dnd5e-2014:srd-5.1:spell:fireball')
    expect(dnd5eTrackableDefinitionIdV1({ namespace: 'srd-5.1', kind: 'item', localId: 'fireball' }))
      .toBe('dnd5e-2014:srd-5.1:item:fireball')
    expect(parseDnd5eTrackableDefinitionIdV1('dnd5e-2014:srd-5.1:spell:fireball')).toMatchObject({
      namespace: 'srd-5.1', kind: 'spell', localId: 'fireball',
    })
  })

  it('derives ids from Host-known actions rather than client-provided tracking fields', () => {
    expect(dnd5eTrackableDefinitionIdForActionV1(state, action({
      type: 'cast-spell', actorId: 'wizard', spellId: 'fireball', definitionId: 'spoofed',
    }))).toBe('dnd5e-2014:srd-5.1:spell:fireball')
    expect(dnd5eTrackableDefinitionIdForActionV1(state, action({
      type: 'move', actorId: 'wizard', to: { x: 1, y: 1 }, distance: 5,
    }))).toBe('dnd5e-2014:core:movement:move')
    expect(dnd5eTrackableDefinitionIdForActionV1(state, action({
      type: 'monster-action', actorId: 'goblin', actionId: 'scimitar', rolls: [],
    }))).toBe('dnd5e-2014:srd-5.1:monster-action:goblin.scimitar')
    expect(dnd5eTrackableDefinitionIdForActionV1(state, action({
      type: 'fighter-second-wind', actorId: 'wizard', resourceKey: 'dnd5e-second-wind', d10: 6,
    }))).toBe('dnd5e-2014:srd-5.1:feature:fighter.second-wind')
  })

  it('exposes a duplicate-free catalog for authoring and diagnostics', () => {
    const catalog = listDnd5eTrackableDefinitionsV1()
    const ids = catalog.map((entry) => entry.definitionId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('dnd5e-2014:srd-5.1:spell:fireball')
    expect(ids).toContain('dnd5e-2014:core:movement:move')
    expect(ids).toContain('dnd5e-2014:core:skill:perception')
    expect(ids).toContain('dnd5e-2014:core:saving-throw:dex')
    expect(ids).toContain('dnd5e-2014:srd-5.1:attack:dnd5e-longbow')
  })
})
