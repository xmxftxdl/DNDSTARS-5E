import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../../rulesets/dnd5e/headlessCombatEngine'
import { createDnd5eConditionEffect } from '../../rulesets/dnd5e/activeEffects'
import { recentSightingTargetOptions } from './recentSightingTargets'

it('offers only current or recent targets, without exposing hidden positions or refreshing historical sightings', () => {
  const actors = ['actor', 'visible', 'recent', 'expired', 'unknown'].map((id, i) => createDnd5eCombatant({
    id, name: id, controller: 'player', initiative: 20-i, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: i*50, y: 25 }, concentrating: false,
  }))
  const state = startDnd5eHeadlessCombat('recent-preview', actors)
  state.mapId = 'map'
  state.combatants.actor.classState.recentCreatureSightings = {
    recent: { mapId: 'map', worldMinute: 9.5, label: 'Remembered target' }, expired: { mapId: 'map', worldMinute: 8 },
  }
  for (const id of ['recent', 'expired', 'unknown']) {
    state.combatants[id].classState.activeEffects = [createDnd5eConditionEffect({ condition: 'invisible', targetId: id, source: { kind: 'spell' } })]
    state.combatants[id].conditions = ['invisible']
  }
  const before = JSON.stringify(state)
  const options = (worldMinute?: number) => recentSightingTargetOptions({ state, actorId: 'actor', worldMinute, maximumAgeSeconds: 60 })
  expect([...options(10)]).toEqual([['visible', { currentlyVisible: true }], ['recent', { currentlyVisible: false, label: 'Remembered target' }]])
  expect([...options(11)]).toEqual([['visible', { currentlyVisible: true }]])
  expect([...options()]).toEqual([['visible', { currentlyVisible: true }]])
  // Server redaction removes invisibility mechanics; its explicit marker still wins.
  const redacted = structuredClone(state)
  redacted.combatants.recent.classState.activeEffects = []
  redacted.combatants.recent.conditions = []
  redacted.combatants.recent.name = '未见生物'
  expect(recentSightingTargetOptions({ state: redacted, actorId: 'actor', worldMinute: 10, maximumAgeSeconds: 60,
    detectedUnseenIds: new Set(['recent', 'visible']) }).get('recent')).toEqual({ currentlyVisible: false, label: 'Remembered target' })
  expect(recentSightingTargetOptions({ state: redacted, actorId: 'actor', worldMinute: 10, maximumAgeSeconds: 60,
    detectedUnseenIds: new Set(['recent', 'visible']) }).has('visible')).toBe(false)
  expect(JSON.stringify(state)).toBe(before)
  state.mapId = 'elsewhere'
  expect([...options(10)]).toEqual([['visible', { currentlyVisible: true }]])
})
