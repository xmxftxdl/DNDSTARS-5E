import { describe, expect, it } from 'vitest'
import {
  dnd5eMagicMouthMessageWordCount,
  normalizeDnd5eMagicMouthConfigV1,
  normalizeDnd5eMagicMouthStateV1,
} from './magicMouth'

describe('Magic Mouth bounded UI contract', () => {
  it('counts Chinese characters and Latin words against the 25-word message limit', () => {
    expect(dnd5eMagicMouthMessageWordCount('警告：前方有危险')).toBe(7)
    expect(dnd5eMagicMouthMessageWordCount('Danger lies beyond this door')).toBe(5)
    expect(normalizeDnd5eMagicMouthConfigV1({
      schemaVersion: 1,
      message: '一二三四五六七八九十一二三四五六七八九十一二三四五六',
      trigger: '任意生物进入物件周围 30 尺',
      triggerMode: 'proximity',
      repeat: true,
    })).toBeUndefined()
  })

  it('normalizes the exact message, trigger, mode, repeat flag and mapped object', () => {
    expect(normalizeDnd5eMagicMouthStateV1({
      schemaVersion: 1,
      message: '  警告：前方有危险  ',
      trigger: ' 任意生物进入物件周围 30 尺 ',
      triggerMode: 'proximity',
      repeat: false,
      objectKind: 'obstacle-token',
      objectId: 'statue-1',
      objectLabel: '魔嘴石像',
    })).toEqual({
      schemaVersion: 1,
      message: '警告：前方有危险',
      trigger: '任意生物进入物件周围 30 尺',
      triggerMode: 'proximity',
      repeat: false,
      objectKind: 'obstacle-token',
      objectId: 'statue-1',
      objectLabel: '魔嘴石像',
    })
  })
})
