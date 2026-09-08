import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import { dnd5eConditionSourceCreatureTypes } from './conditionSource'

function sourceToken(patch: Partial<Token>): Token {
  return {
    id: 'source',
    label: '来源',
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'enemy',
    ...patch,
  }
}

describe('dnd5eConditionSourceCreatureTypes', () => {
  it('retains a manually assigned celestial creature type', () => {
    expect(dnd5eConditionSourceCreatureTypes(sourceToken({
      creatureTypes: ['天界生物'],
    }))).toContain('天界生物')
  })

  it('resolves the authoritative SRD monster type from the token pool id', () => {
    expect(dnd5eConditionSourceCreatureTypes(sourceToken({
      poolId: 'srd-5.1:deva',
    }))).toContain('天界生物')
  })
})
