import { describe, expect, it } from 'vitest'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eMonsterGenericAbilities, dnd5eMonsterHasGenericAbility } from './monsterGenericAbilities'

describe('D&D 5e monster generic abilities', () => {
  it('recognizes reusable Headless abilities from SRD stat blocks', () => {
    const wolf = getDnd5eSrdMonster('srd-5.1:wolf')!
    expect(dnd5eMonsterHasGenericAbility(wolf, 'pack-tactics')).toBe(true)
    expect(dnd5eMonsterGenericAbilities(wolf)).toContainEqual({
      id: 'pack-tactics',
      name: '集群战术',
      automation: 'headless',
    })
  })

  it('keeps unsupported generic abilities behind DM adjudication', () => {
    const monster = getDnd5eSrdMonster('srd-5.1:troll')!
    expect(dnd5eMonsterGenericAbilities(monster)).toContainEqual({
      id: 'regeneration',
      name: '再生',
      automation: 'dm-adjudication',
    })
  })
})
