import { describe, expect, it } from 'vitest'
import { dnd5eMapInteractionRequiresDmAdjudication } from './mapInteractionActionProcessor'

describe('dnd5eMapInteractionRequiresDmAdjudication', () => {
  it('does not ask the DM to approve an authoritative automatic door opening twice', () => {
    expect(dnd5eMapInteractionRequiresDmAdjudication({
      operation: 'open',
      automaticSuccess: true,
    })).toBe(false)
  })

  it('keeps DM adjudication for checks and every non-opening interaction', () => {
    expect(dnd5eMapInteractionRequiresDmAdjudication({
      operation: 'open',
      automaticSuccess: false,
    })).toBe(true)
    expect(dnd5eMapInteractionRequiresDmAdjudication({
      operation: 'unlock',
      automaticSuccess: false,
    })).toBe(true)
    expect(dnd5eMapInteractionRequiresDmAdjudication({
      operation: 'break',
      automaticSuccess: false,
    })).toBe(true)
    expect(dnd5eMapInteractionRequiresDmAdjudication({
      operation: 'close',
      automaticSuccess: true,
    })).toBe(true)
  })
})
