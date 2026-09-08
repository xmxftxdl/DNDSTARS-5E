import { describe, expect, it } from 'vitest'
import { dnd5eFleshToStoneTargetHasFlesh } from './fleshToStone'

describe('Flesh to Stone target material', () => {
  it.each([
    [{ statBlockId: 'srd-5.1:skeleton', creatureType: '亡灵' }, false],
    [{ statBlockId: 'srd-5.1:ghost', creatureType: '亡灵' }, false],
    [{ statBlockId: 'srd-5.1:stone-golem', creatureType: '构装' }, false],
    [{ statBlockId: 'srd-5.1:flesh-golem', creatureType: '构装' }, true],
    [{ statBlockId: 'srd-5.1:zombie', creatureType: '亡灵' }, true],
    [{ statBlockId: 'srd-5.1:lich', creatureType: '亡灵' }, true],
    [{ statBlockId: 'srd-5.1:goblin', creatureType: '类人生物' }, true],
    [{ creatureType: 'homebrew mystery' }, true],
  ] as const)('classifies %o as flesh=%s', (target, expected) => {
    expect(dnd5eFleshToStoneTargetHasFlesh(target)).toBe(expected)
  })
})
