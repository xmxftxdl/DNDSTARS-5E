import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { dnd5eActivityFromAuthoringPresetV1 } from '../../../components/rules/dnd5eActivityTemplateModel'
import { dnd5eActivityAutomationAnalysisV1 } from './pluginMechanicsRegistry'

describe('D&D 5e mechanic handler coverage', () => {
  it('derives full coverage from registered handlers even when Legacy metadata says manual', () => {
    const activity = dnd5eActivityFromAuthoringPresetV1({
      id: 'persistent-area',
      label: 'Persistent area',
    }, [])
    const analysis = dnd5eActivityAutomationAnalysisV1({
      ...activity,
      automation: automationCapabilityFromLegacyStatus('manual'),
    })

    expect(analysis.capability.level).toBe('full')
    expect(analysis.missingComponents).toEqual([])
    expect(analysis.requiredComponents).toContain('operation:create-persistent-area')
  })

  it('does not accept a coarse full declaration when an operation requires DM adjudication', () => {
    const activity = dnd5eActivityFromAuthoringPresetV1({
      id: 'assisted-dm-boundary',
      label: 'DM boundary',
    }, [])
    const analysis = dnd5eActivityAutomationAnalysisV1({
      ...activity,
      automation: automationCapabilityFromLegacyStatus('full'),
    })

    expect(analysis.capability.level).toBe('assisted')
    expect(analysis.missingComponents).toContain('operation:manual-adjudication')
    expect(analysis.capability.limitations).toContain('Activity 包含显式 DM 裁定 operation。')
  })
})
