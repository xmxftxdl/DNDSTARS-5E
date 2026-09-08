import { describe, expect, it } from 'vitest'
import { normalizeCreatureTypes } from './monsterTypes'

describe('monster creature type normalization', () => {
  it('preserves safe campaign-specific creature types and deduplicates them case-insensitively', () => {
    expect(normalizeCreatureTypes([
      '亡灵',
      '星界寄生体',
      ' 星界寄生体 ',
      'CUSTOM TYPE',
      'custom type',
      '',
      42,
    ])).toEqual(['亡灵', '星界寄生体', 'CUSTOM TYPE'])
  })
})
