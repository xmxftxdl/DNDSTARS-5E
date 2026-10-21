import { describe, expect, it } from 'vitest'
import {
  automationCapabilityFromLegacyStatus,
  validateAutomationCapability,
} from './automationCapability'

describe('automation capability contract', () => {
  it('reports malformed imported claims without throwing or accepting an unknown level', () => {
    const malformed = { schemaVersion: 1, level: 'partial', supportedPhases: [], manualPhases: [] }
    expect(validateAutomationCapability(malformed as unknown as Parameters<typeof validateAutomationCapability>[0])).toEqual([
      'automation limitations must be an array of strings', 'unknown automation level: partial',
    ])
  })
  it('turns legacy partial automation into an explicit assisted phase split', () => {
    const capability = automationCapabilityFromLegacyStatus('partial', ['区域移动需要 DM 裁定。'])
    expect(capability).toMatchObject({
      schemaVersion: 1,
      level: 'assisted',
      supportedPhases: ['eligibility', 'cost', 'targeting', 'persistence'],
      limitations: ['区域移动需要 DM 裁定。'],
    })
    expect(capability.manualPhases).toContain('effects')
    expect(validateAutomationCapability(capability)).toEqual([])
  })

  it('does not allow display-only content to claim executable phases', () => {
    expect(validateAutomationCapability({
      schemaVersion: 1,
      level: 'display-only',
      supportedPhases: ['damage'],
      manualPhases: [],
      limitations: ['仅展示。'],
    })).toEqual(['display-only automation cannot declare supported phases'])
  })
})
