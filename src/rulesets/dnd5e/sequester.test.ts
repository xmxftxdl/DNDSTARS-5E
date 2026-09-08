import { describe, expect, it } from 'vitest'
import {
  normalizeDnd5eSequesterDeclarationV1,
  normalizeDnd5eSequesterResolutionV1,
} from './sequester'

describe('Sequester structured declaration and adjudication', () => {
  it('normalizes a map target and optional observable early-ending condition', () => {
    expect(normalizeDnd5eSequesterDeclarationV1({
      schemaVersion: 1,
      targetKind: 'creature',
      targetTokenId: 'cleric-token',
      targetName: ' 全法术测试牧师 ',
      endingCondition: ' 当银钟   在附近敲响三次时 ',
    })).toEqual({
      schemaVersion: 1,
      targetKind: 'creature',
      targetTokenId: 'cleric-token',
      targetName: '全法术测试牧师',
      endingCondition: '当银钟 在附近敲响三次时',
    })
  })

  it('rejects unbounded or malformed player fields', () => {
    expect(normalizeDnd5eSequesterDeclarationV1({
      schemaVersion: 1,
      targetKind: 'location',
      targetTokenId: 'target',
      targetName: '目标',
    })).toBeUndefined()
    expect(normalizeDnd5eSequesterDeclarationV1({
      schemaVersion: 1,
      targetKind: 'object',
      targetTokenId: 'target',
      targetName: '目标',
      endingCondition: 'x'.repeat(501),
    })).toBeUndefined()
  })

  it('requires an explicit Host-authored willingness boolean', () => {
    expect(normalizeDnd5eSequesterResolutionV1({
      schemaVersion: 1,
      willingCreatureConfirmed: true,
    })).toEqual({ schemaVersion: 1, willingCreatureConfirmed: true })
    expect(normalizeDnd5eSequesterResolutionV1({ schemaVersion: 1 })).toBeUndefined()
  })
})
