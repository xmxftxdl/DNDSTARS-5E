import { describe, expect, it } from 'vitest'
import {
  MAP_SPELL_BASE_SLOT_UNAVAILABLE_MESSAGE,
  mapSpellDefaultSlotLevel,
  resolveMapSpellSlotSelection,
} from './MapSpellsPanel'

describe('MapSpellsPanel spell slot selection', () => {
  it('普通施法无锁定时坚持基础环，不会静默使用可用高环', () => {
    expect(mapSpellDefaultSlotLevel({
      spellLevel: 1,
    })).toBe(1)

    expect(resolveMapSpellSlotSelection({
      spellLevel: 1,
      availableLevels: [3],
    })).toEqual({
      selectedSlot: 1,
      selectedSlotAvailable: false,
      unavailableMessage: MAP_SPELL_BASE_SLOT_UNAVAILABLE_MESSAGE,
    })
  })

  it('用户固定高环后沿用共享锁定，并允许施法', () => {
    expect(resolveMapSpellSlotSelection({
      spellLevel: 1,
      availableLevels: [3],
      pinnedSlotLevel: 3,
    })).toEqual({
      selectedSlot: 3,
      selectedSlotAvailable: true,
      unavailableMessage: undefined,
    })

    expect(resolveMapSpellSlotSelection({
      spellLevel: 1,
      availableLevels: [3],
      pinnedSlotLevel: 4,
    })).toEqual({
      selectedSlot: 4,
      selectedSlotAvailable: false,
      unavailableMessage: undefined,
    })
  })

  it('戏法默认 0 环，契约施法默认唯一契约位', () => {
    expect(resolveMapSpellSlotSelection({
      spellLevel: 0,
      availableLevels: [0],
      pactSlotLevel: 3,
    })).toMatchObject({
      selectedSlot: 0,
      selectedSlotAvailable: true,
    })

    expect(resolveMapSpellSlotSelection({
      spellLevel: 1,
      availableLevels: [3],
      pactSlotLevel: 3,
    })).toMatchObject({
      selectedSlot: 3,
      selectedSlotAvailable: true,
    })
  })

  it('免费基础施放优先基础环，不被契约位自动覆盖', () => {
    expect(mapSpellDefaultSlotLevel({
      spellLevel: 1,
      pactSlotLevel: 3,
      hasFreeBaseCast: true,
    })).toBe(1)

    expect(resolveMapSpellSlotSelection({
      spellLevel: 1,
      availableLevels: [1, 3],
      pactSlotLevel: 3,
      hasFreeBaseCast: true,
    })).toMatchObject({
      selectedSlot: 1,
      selectedSlotAvailable: true,
    })
  })
})
