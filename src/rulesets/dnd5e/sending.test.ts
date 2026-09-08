import { describe, expect, it } from 'vitest'
import {
  dnd5eSendingMessageWordCount,
  normalizeDnd5eSendingDeclarationV1,
  normalizeDnd5eSendingResolutionV1,
} from './sending'

describe('Sending structured declaration and adjudication', () => {
  it('counts English words and individual Han characters consistently with the SRD 25-word cap', () => {
    expect(dnd5eSendingMessageWordCount('North gate safe; report immediately')).toBe(5)
    expect(dnd5eSendingMessageWordCount('月门安全')).toBe(4)
  })

  it('normalizes a familiar recipient and rejects messages over 25 words', () => {
    expect(normalizeDnd5eSendingDeclarationV1({
      schemaVersion: 1,
      recipientName: ' 银月城档案员伊蕾娜 ',
      message: ' 月门安全，立即回报。 ',
    })).toEqual({
      schemaVersion: 1,
      recipientName: '银月城档案员伊蕾娜',
      message: '月门安全，立即回报。',
    })
    expect(normalizeDnd5eSendingDeclarationV1({
      schemaVersion: 1,
      recipientName: '伊蕾娜',
      message: Array.from({ length: 26 }, (_, index) => `word${index}`).join(' '),
    })).toBeUndefined()
  })

  it('derives the exact same-plane and cross-plane 5 percent delivery boundary', () => {
    expect(normalizeDnd5eSendingResolutionV1({
      schemaVersion: 1,
      targetIntelligenceAtLeastOne: true,
      plane: 'same',
      delivered: true,
      reply: '收到。',
    })).toMatchObject({ plane: 'same', delivered: true, reply: '收到。' })
    expect(normalizeDnd5eSendingResolutionV1({
      schemaVersion: 1,
      targetIntelligenceAtLeastOne: true,
      plane: 'different',
      crossPlaneRoll: 5,
      delivered: false,
    })).toMatchObject({ plane: 'different', crossPlaneRoll: 5, delivered: false })
    expect(normalizeDnd5eSendingResolutionV1({
      schemaVersion: 1,
      targetIntelligenceAtLeastOne: true,
      plane: 'different',
      crossPlaneRoll: 6,
      delivered: true,
      reply: '道路畅通。',
    })).toMatchObject({ crossPlaneRoll: 6, delivered: true, reply: '道路畅通。' })
    expect(normalizeDnd5eSendingResolutionV1({
      schemaVersion: 1,
      targetIntelligenceAtLeastOne: true,
      plane: 'different',
      crossPlaneRoll: 5,
      delivered: true,
    })).toBeUndefined()
  })

  it('does not accept an intelligible reply when delivery failed or Intelligence is 0', () => {
    expect(normalizeDnd5eSendingResolutionV1({
      schemaVersion: 1,
      targetIntelligenceAtLeastOne: false,
      plane: 'same',
      delivered: true,
      reply: '不应存在',
    })).toBeUndefined()
    expect(normalizeDnd5eSendingResolutionV1({
      schemaVersion: 1,
      targetIntelligenceAtLeastOne: true,
      plane: 'different',
      crossPlaneRoll: 1,
      delivered: false,
      reply: '不应存在',
    })).toBeUndefined()
  })
})
