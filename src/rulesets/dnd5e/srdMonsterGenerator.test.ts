import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
// @ts-expect-error The executable generator is intentionally plain ESM JavaScript.
import { normalizedDamageDefenses, normalizedMonster } from '../../../scripts/generate-srd-monsters.mjs'

const fixture = JSON.parse(await readFile(
  new URL('../../../scripts/fixtures/srd-monster-damage-defenses.json', import.meta.url),
  'utf8',
))

describe('SRD monster damage defense generation', () => {
  it('separates static types, conditional rules, and unparsed clauses without data loss', () => {
    expect(normalizedDamageDefenses(fixture.raw)).toEqual(fixture.expected)
  })

  it('attaches parsed and unparsed damage defenses to the generated monster', () => {
    const monster = normalizedMonster({
      index: 'damage-defense-fixture',
      name: 'Damage Defense Fixture',
      size: 'Medium',
      type: 'fiend',
      alignment: 'neutral evil',
      armor_class: [{ value: 10 }],
      hit_points: 1,
      hit_points_roll: '1d8',
      speed: { walk: '30 ft.' },
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      proficiencies: [],
      condition_immunities: [],
      senses: { passive_perception: 10 },
      languages: '--',
      challenge_rating: 1,
      xp: 200,
      special_abilities: [],
      actions: [],
      ...fixture.raw,
    })

    expect(monster.damageVulnerabilities).toEqual(fixture.expected.damageVulnerabilities)
    expect(monster.damageResistances).toEqual(fixture.expected.damageResistances)
    expect(monster.damageImmunities).toEqual(fixture.expected.damageImmunities)
    expect(monster.damageDefenseRules).toEqual(fixture.expected.damageDefenseRules)
    expect(monster.unparsedDamageDefenses).toEqual(fixture.expected.unparsedDamageDefenses)
  })
})
