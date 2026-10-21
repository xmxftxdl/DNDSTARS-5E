import { describe, expect, it } from 'vitest'
import { DND5E_SRD_MONSTERS } from './monsters'
import { validateDnd5eMonsterSchema } from './monsterSchema'
import { buildDnd5eCustomMonster, dnd5eCustomMonsterDraftFromStatBlock } from './customMonsterWorkshop'
import { dnd5eChallengeRatingValue, dnd5eWildShapeFormAllowedForLevel } from './wildShape'
import { dnd5eMonsterToEnemyTemplate } from '../../lib/enemyPool'

describe('source stat blocks without a challenge rating', () => {
  const unrated = () => ({ ...structuredClone(DND5E_SRD_MONSTERS.find(monster => monster.slug === 'wolf')!), challenge: { rating: '—' } })

  it('preserves absent CR and XP through JSON, workshop editing and enemy projection', () => {
    const source = unrated()
    expect(validateDnd5eMonsterSchema(source)).toEqual([])
    const restored = buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(JSON.parse(JSON.stringify(source))))
    expect(restored.challenge).toEqual({ rating: '—' })
    expect(validateDnd5eMonsterSchema(restored)).toEqual([])
    expect(dnd5eMonsterToEnemyTemplate(restored).experiencePoints).toBeUndefined()
  })

  it('does not mistake absent CR for a CR zero beast', () => {
    expect(dnd5eChallengeRatingValue(unrated().challenge.rating)).toBe(Number.POSITIVE_INFINITY)
    expect(dnd5eWildShapeFormAllowedForLevel(20, unrated())).toBe(false)
  })

  it('still requires XP for rated creatures and rejects invalid XP', () => {
    for (const challenge of [{ rating: '0' }, { rating: '1/4' }, { rating: '—', xp: -1 }, { rating: '—', xp: Number.NaN }]) {
      expect(validateDnd5eMonsterSchema({ ...unrated(), challenge }).length).toBeGreaterThan(0)
    }
  })
})
