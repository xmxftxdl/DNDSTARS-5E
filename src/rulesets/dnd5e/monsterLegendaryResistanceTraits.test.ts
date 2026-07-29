import { describe, expect, it } from 'vitest'
import { DND5E_SRD_MONSTERS } from './monsters'

describe('SRD Legendary Resistance trait declarations', () => {
  it('maps every monster resource to one structured Headless trait', () => {
    const legendaryMonsters = DND5E_SRD_MONSTERS.filter(
      (monster) => monster.legendaryResistanceUses != null,
    )

    expect(legendaryMonsters.length).toBeGreaterThan(0)
    for (const monster of legendaryMonsters) {
      const traits = monster.traits.filter((trait) =>
        /传奇抗性|legendary resistance/i.test(trait.name),
      )

      expect(traits, monster.id).toHaveLength(1)
      expect(traits[0], monster.id).toMatchObject({
        automation: 'headless',
        rule: {
          kind: 'legendary-resistance',
          maximumUses: monster.legendaryResistanceUses,
        },
      })
    }
  })
})
