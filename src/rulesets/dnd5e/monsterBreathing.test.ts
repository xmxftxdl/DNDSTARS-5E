import { expect, it } from 'vitest'
import catalog from './generated/srdMonsters.generated.json'
import { monsterBreathingProfiles } from '../../../shared/monster-breathing-profiles.mjs'
import { dnd5eNativeMonsterBreathing } from './monsterBreathing'

it('keeps every shared breathing profile tied to the bundled SRD record', () => {
  expect(Object.keys(monsterBreathingProfiles).sort()).toEqual(catalog.monsters.map(monster => monster.id).sort())
  for (const monster of catalog.monsters) {
    const profile = monsterBreathingProfiles[monster.id]
    expect(profile.constitutionScore, monster.id).toBe(monster.abilities.con)
    const names = (monster.traits ?? []).map(trait => trait.name)
    expect(Boolean(profile.canBreatheWater), monster.id).toBe(
      names.includes('Amphibious') || names.includes('Limited Amphibiousness') || names.includes('Water Breathing'))
    const hold = monster.traits?.find(trait => trait.name === 'Hold Breath')?.description
      .match(/can hold its breath for (\d+) (minute|hour)s?/)
    expect(profile.holdBreathSeconds, monster.id).toBe(hold ? Number(hold[1]) * (hold[2] === 'hour' ? 3600 : 60) : undefined)
    expect(dnd5eNativeMonsterBreathing(monster.id)).not.toHaveProperty('constitutionScore')
  }
})

it('does not grant traits to unknown IDs or allow mutation of shared records through the lookup result', () => {
  expect(dnd5eNativeMonsterBreathing('custom:fish')).toEqual({})
  const result = dnd5eNativeMonsterBreathing('srd-5.1:crocodile')
  result.holdBreathSeconds = 1
  expect(dnd5eNativeMonsterBreathing('srd-5.1:crocodile').holdBreathSeconds).toBe(900)
})
