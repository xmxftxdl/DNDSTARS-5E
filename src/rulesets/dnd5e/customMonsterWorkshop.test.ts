import { describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
  dnd5eCustomMonsterDraftFromStatBlock,
} from './customMonsterWorkshop'
import { dnd5eMonsterActionAutomation, parseDnd5eMonsterStatBlock } from './monsterSchema'

describe('D&D 5e custom monster workshop', () => {
  it('builds a schema-valid room monster with a Headless weapon attack', () => {
    const monster = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    expect(monster.id).toMatch(/^room-monster:/)
    expect(monster.source).toBe('DM 自定义')
    expect(parseDnd5eMonsterStatBlock(monster).ok).toBe(true)
    expect(dnd5eMonsterActionAutomation(monster.actions[0])).toBe('headless')
  })

  it('round-trips an edited monster and generates a multiattack declaration', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions[0].attacksPerAction = 2
    const monster = buildDnd5eCustomMonster(draft)
    expect(monster.actions[0]).toMatchObject({ kind: 'multiattack', sequence: [draft.actions[0].id, draft.actions[0].id] })
    expect(buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(monster))).toMatchObject({ id: monster.id, slug: monster.slug })
  })

  it('rejects invalid dice instead of saving an unresolvable attack', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions[0].damageDice = 'lots'
    expect(() => buildDnd5eCustomMonster(draft)).toThrow('伤害骰格式无效')
  })
})
