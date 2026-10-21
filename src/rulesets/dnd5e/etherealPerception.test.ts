import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantCanSee,
  dnd5eCombatantPairKey, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'

function phase() {
  return createDnd5eMechanicalEffect({ definitionId: 'test:ethereal', label: 'Ethereal', targetId: 'hero',
    source: { kind: 'spell', actorId: 'hero', rulesId: 'etherealness', magical: true },
    modifiers: { planarPhase: { plane: 'ethereal', ignoresMaterialCollision: true,
      suppressCrossPlaneEffects: true, unrestrictedVerticalMovement: true, materialSightRangeFeet: 60 } } })
}
it.each([5, 60, 61])('allows original-plane sight only within the declared range: %s ft', distance => {
  const make = (id: string, controller: 'dm' | 'player') => createDnd5eCombatant({
    id, name: id, controller, initiative: id === 'hero' ? 20 : 1, currentHp: 30, maxHp: 30,
    temporaryHp: 0, concentrating: false, armorClass: 10, proficiencyBonus: 2, speed: 30,
    position: { x: id === 'hero' ? 0 : distance, y: 0 },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  })

  const hero = make('hero', 'player'), target = make('target', 'dm')
  hero.classState.activeEffects = [phase()]
  const state = startDnd5eHeadlessCombat('phase', [hero, target])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(hero.id, target.id)]: distance }
  expect(dnd5eCombatantCanSee(state, hero.id, target.id)).toBe(distance <= 60)
  expect(dnd5eCombatantCanSee(state, target.id, hero.id)).toBe(false)
  expect(resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: hero.id, targetId: target.id,
    attackModifier: 5, d20: 18, damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' } }))
    .toMatchObject({ ok: false, reason: 'invalid-target' })
  const recovered = JSON.parse(JSON.stringify(state)) as typeof state
  expect(validateDnd5eActiveEffectsStrict(recovered.combatants.hero.classState.activeEffects)).toMatchObject({ ok: true })
  expect(dnd5eCombatantCanSee(recovered, hero.id, target.id)).toBe(distance <= 60)
})

it('rejects malformed sight declarations in saved effects', () => {
  for (const value of [-1, 0, 10001, Infinity, '60']) {
    const effect = phase()
    Object.assign(effect.modifiers!.planarPhase!, { materialSightRangeFeet: value })
    expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(false)
  }
})

it.each(['near', 'far', 'diagonal', 'vertical-far', 'stale-token', 'no-permission', 'suspended', 'invisible', 'wall'] as const)(
  'projects material creatures to the ethereal player without bypassing existing sight restrictions: %s', mode => {
    const effect = phase()
    if (mode === 'no-permission') delete effect.modifiers!.planarPhase!.materialSightRangeFeet
    if (mode === 'suspended') effect.suspendedBy = ['test-suppression']
    // Suspended phase is material again; use an ethereal target to verify the removed permission.
    const targetEffects = mode === 'suspended' ? [phase()] : []
    const maps = { maps: [{ id: 'phase', width: 500, height: 200, gridSize: 10, feetPerCell: 5,
      tokens: [{ id: 'hero', type: 'player', characterId: 'hero', size: 1, x: 10, y: 20,
        ...(mode === 'stale-token' ? { dnd5eCombatState: { activeEffects: [effect] } } : {}) },
        { id: 'target', type: 'enemy', label: 'Material target', size: 1, x: ['far', 'stale-token'].includes(mode) ? 140 : 130,
          y: mode === 'diagonal' ? 140 : 20, elevationFeet: mode === 'vertical-far' ? 70 : 0,
          dnd5eCombatState: { activeEffects: targetEffects, ...(mode === 'invisible' ? { conditions: ['invisible'] } : {}) } }] }] }
    const geometry = { schemaVersion: 2, updatedAt: 1, maps: [{ mapId: 'phase',
      walls: mode === 'wall' ? [{ id: 'wall', kind: 'wall', points: [{ x: 60, y: 0 }, { x: 60, y: 200 }],
        baseHeightFeet: 0, heightFeet: 100, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true }] : [],
      doors: [], windows: [], obstacles: [], lights: [], updatedAt: 1,
      vision: { enabled: true, defaultRangeFeet: 120, sharePartyVision: false, ambientLight: 'bright' } }] }
    const characters = { characters: [{ id: 'hero', dnd5eCombatState: { activeEffects: mode === 'stale-token' ? [] : [effect] } }] }
    const projected = projectMapsForPlayer(maps, geometry, 'hero', characters)
    const visible = projected.maps[0].tokens.find((token: { id: string; perceptionVisibility?: string }) => token.id === 'target')
    if (['near', 'diagonal', 'stale-token'].includes(mode)) expect(visible).toMatchObject({ label: 'Material target' })
    else expect(visible == null || ('perceptionVisibility' in visible && visible.perceptionVisibility === 'detected-unseen')).toBe(true)
  })

it.each([false, true])('limits allied material tokens with dynamic vision %s', enabled => {
  const maps = { maps: [{ id: 'phase', width: 500, height: 200, gridSize: 10, feetPerCell: 5,
    tokens: [
      { id: 'hero', type: 'player', characterId: 'hero', size: 1, x: 10, y: 20 },
      { id: 'near', type: 'player', characterId: 'near', size: 1, x: 130, y: 20 },
      { id: 'far', type: 'player', characterId: 'far', size: 1, x: 140, y: 20 },
    ] }] }
  const geometry = { schemaVersion: 2, updatedAt: 1, maps: [{ mapId: 'phase',
    walls: [], doors: [], windows: [], obstacles: [], lights: [], updatedAt: 1,
    vision: { enabled, defaultRangeFeet: 120, sharePartyVision: false, ambientLight: 'bright' } }] }
  const characters = { characters: [
    { id: 'hero', dnd5eCombatState: { activeEffects: [phase()] } },
    { id: 'near', dnd5eCombatState: { activeEffects: [] } },
    { id: 'far', dnd5eCombatState: { activeEffects: [] } },
  ] }
  const projected = projectMapsForPlayer(maps, geometry, 'hero', characters)
  expect(projected.maps[0].tokens.map((token: { id: string }) => token.id)).toEqual(['hero', 'near'])
})
