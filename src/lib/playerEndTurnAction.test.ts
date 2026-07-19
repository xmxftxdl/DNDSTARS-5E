import { describe, expect, it } from 'vitest'
import { clearCharacterScopedRecord, removeDisengagedCharacterId } from './playerEndTurnAction'

describe('D&D 5e 回合结束本地状态辅助', () => {
  it('只清除当前角色作用域内的记录', () => {
    const record = {
      'hero:goblin': 2,
      'hero:dragon': 1,
      'other:goblin': 3,
      misc: 4,
    }

    expect(clearCharacterScopedRecord(record, 'hero')).toEqual({
      'other:goblin': 3,
      misc: 4,
    })
  })

  it('没有匹配记录时保持原对象引用', () => {
    const record = { 'other:goblin': 3 }
    expect(clearCharacterScopedRecord(record, 'hero')).toBe(record)
  })

  it('以不可变方式移除撤离状态', () => {
    const previous = new Set(['hero', 'other'])
    const next = removeDisengagedCharacterId(previous, 'hero')

    expect([...previous].sort()).toEqual(['hero', 'other'])
    expect([...next]).toEqual(['other'])
    expect(removeDisengagedCharacterId(next, 'missing')).toBe(next)
  })
})
