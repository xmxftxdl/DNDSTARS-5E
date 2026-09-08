import { describe, expect, it } from 'vitest'
import {
  dnd5eWishDuplicateSpellFromInput,
  normalizeDnd5eWishDeclarationV1,
} from './wish'

describe('Wish declaration', () => {
  it('resolves a duplicated SRD spell by Chinese name, English name, or id and rejects 9th-level spells', () => {
    expect(dnd5eWishDuplicateSpellFromInput('火球术')).toMatchObject({ id: 'fireball', level: 3 })
    expect(dnd5eWishDuplicateSpellFromInput('Fireball')).toMatchObject({ id: 'fireball', level: 3 })
    expect(dnd5eWishDuplicateSpellFromInput('fireball')).toMatchObject({ id: 'fireball', level: 3 })
    expect(dnd5eWishDuplicateSpellFromInput('wish')).toBeUndefined()
  })

  it('normalizes all seven bounded declarations', () => {
    const targets = [{ tokenId: 'token-a', name: '法师' }]
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'duplicate-spell',
      spellId: 'fireball',
      spellName: '火球术',
      spellLevel: 3,
    })).toMatchObject({ mode: 'duplicate-spell', spellId: 'fireball' })
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'create-object',
      objectDescription: '纯金王冠',
      valueGp: 25_000,
      maximumDimensionFeet: 3,
      placementDescription: '施法者面前的空地',
    })).toMatchObject({ mode: 'create-object', valueGp: 25_000 })
    expect(normalizeDnd5eWishDeclarationV1({ schemaVersion: 1, mode: 'heal-and-restore', targets }))
      .toMatchObject({ mode: 'heal-and-restore' })
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'grant-resistance',
      targets,
      damageType: 'fire',
    })).toMatchObject({ mode: 'grant-resistance', damageType: 'fire' })
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'grant-immunity',
      targets,
      namedEffect: '火球术',
    })).toMatchObject({ mode: 'grant-immunity', namedEffect: '火球术' })
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'reroll-last-round',
      rollDescription: '食人魔攻击检定，原结果 19',
      rollMode: 'disadvantage',
    })).toMatchObject({ mode: 'reroll-last-round', rollMode: 'disadvantage' })
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'open-ended',
      exactWish: '我希望我们安全返回银月城。',
    })).toMatchObject({ mode: 'open-ended' })
  })

  it('rejects boundary violations and duplicate targets', () => {
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'create-object',
      objectDescription: '城堡',
      valueGp: 25_001,
      maximumDimensionFeet: 301,
      placementDescription: '这里',
    })).toBeUndefined()
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'grant-resistance',
      targets: [{ tokenId: 'a', name: '甲' }, { tokenId: 'a', name: '甲' }],
      damageType: 'fire',
    })).toBeUndefined()
    expect(normalizeDnd5eWishDeclarationV1({
      schemaVersion: 1,
      mode: 'duplicate-spell',
      spellId: 'fireball',
      spellName: '错误名称',
      spellLevel: 3,
    })).toBeUndefined()
  })
})
