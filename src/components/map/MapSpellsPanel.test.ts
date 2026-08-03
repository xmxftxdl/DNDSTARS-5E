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
      unavailableMessage: '已固定的 4 环位已耗尽；请选择/右键固定 3 环',
    })
  })

  it('固定环位耗尽时保持原环位并明确提示可固定的更高环', () => {
    expect(resolveMapSpellSlotSelection({
      spellLevel: 2,
      availableLevels: [5, 4],
      pinnedSlotLevel: 3,
    })).toEqual({
      selectedSlot: 3,
      selectedSlotAvailable: false,
      unavailableMessage: '已固定的 3 环位已耗尽；请选择/右键固定 4 环',
    })
  })

  it('固定环位耗尽且没有其他法术位时给出终态提示', () => {
    expect(resolveMapSpellSlotSelection({
      spellLevel: 2,
      availableLevels: [],
      pinnedSlotLevel: 3,
    })).toEqual({
      selectedSlot: 3,
      selectedSlotAvailable: false,
      unavailableMessage: '已固定的 3 环位已耗尽；当前没有可用法术位',
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
