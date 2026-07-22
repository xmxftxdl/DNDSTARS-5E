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

  it('preserves imported advanced fields and mixed attack data across a form save', () => {
    const original = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const imported = {
      ...original,
      savingThrows: { dex: 4 },
      skills: [{ key: 'stealth', name: '隐匿', bonus: 6 }],
      senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
      damageResistances: ['fire' as const],
      reactions: [{ id: 'parry', name: '招架', description: 'AC 暂时提高 2。', kind: 'other' as const, automation: 'dm-adjudication' as const }],
      actions: [
        {
          ...original.actions[0],
          attack: {
            ...original.actions[0].attack!,
            damage: [
              ...original.actions[0].attack!.damage,
              { average: 3, count: 1, sides: 6, bonus: 0, type: 'fire' as const },
            ],
          },
        },
        { id: 'multiattack', name: '多重攻击', description: '先爪击，再爪击。', kind: 'multiattack' as const, sequence: [original.actions[0].id, original.actions[0].id], automation: 'headless' as const },
      ],
    }
    const rebuilt = buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(imported))
    expect(rebuilt).toMatchObject({
      savingThrows: { dex: 4 },
      skills: [{ key: 'stealth', bonus: 6 }],
      senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
      damageResistances: ['fire'],
      reactions: [{ id: 'parry' }],
    })
    expect(rebuilt.actions.find((action) => action.kind === 'weapon-attack')?.attack?.damage).toHaveLength(2)
    expect(rebuilt.actions.find((action) => action.kind === 'multiattack')?.sequence).toEqual([
      original.actions[0].id, original.actions[0].id,
    ])
  })

  it('preserves legendary, lair and spellcasting capabilities across a form save', () => {
    const original = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const imported = {
      ...original,
      legendaryResistanceUses: 3,
      legendaryActions: [{
        id: 'legendary-step', name: '传奇步伐', description: '移动至多一半速度。',
        kind: 'other' as const, legendaryCost: 1, automation: 'dm-adjudication' as const,
      }],
      lairActions: [{
        id: 'lair-tremor', name: '巢穴震动', description: '巢穴地面发生震动。',
        kind: 'other' as const, automation: 'dm-adjudication' as const,
      }],
      spellcasting: {
        description: '该怪物是一名 5 级施法者。', casterLevel: 5, ability: 'int' as const,
        saveDc: 14, attackBonus: 6, slots: { '3': 1 },
        spells: [{ id: 'fireball', name: '火球术', level: 3 }],
        automation: 'headless' as const,
      },
      capabilities: {
        ...original.capabilities!, legendary: true, spellcaster: true,
      },
    }

    const rebuilt = buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(imported))
    expect(rebuilt).toMatchObject({
      legendaryResistanceUses: 3,
      legendaryActions: [{ id: 'legendary-step', legendaryCost: 1 }],
      lairActions: [{ id: 'lair-tremor' }],
      spellcasting: { casterLevel: 5, ability: 'int', saveDc: 14 },
      capabilities: { legendary: true, spellcaster: true },
    })
  })

  it('rejects malformed capability metadata at the schema boundary', () => {
    const monster = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    expect(parseDnd5eMonsterStatBlock({
      ...monster,
      capabilities: { ...monster.capabilities, legendary: 'yes' },
    }).ok).toBe(false)
    expect(parseDnd5eMonsterStatBlock({ ...monster, legendaryResistanceUses: -1 }).ok).toBe(false)
  })
})
