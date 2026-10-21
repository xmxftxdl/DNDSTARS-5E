import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { dnd5eActivityFromAuthoringPresetV1 } from '../../../components/rules/dnd5eActivityTemplateModel'
import { dnd5eActivityAutomationAnalysisV1 } from './pluginMechanicsRegistry'
import { dnd5eActivityHeadlessCompatibility } from '../activities/dnd5eActivityHeadlessCompiler'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1 } from '../activities/dnd5eActivityContracts'

describe('D&D 5e mechanic handler coverage', () => {
  const disabledMapOperations: Dnd5eActivityOperationV1[] = [
    { id: 'lock', kind: 'modify-map-object-lock', mode: 'knock', targetKinds: ['door'] },
    { id: 'light', kind: 'enchant-map-object-light', brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ffffff' },
    { id: 'mouth', kind: 'create-persistent-area', label: 'Mouth', durationRounds: 10, permanent: true, concentration: false, mappedObjectEnchantment: 'magic-mouth' },
    { id: 'passage', kind: 'create-persistent-area', label: 'Passage', durationRounds: 10, concentration: false, blocking: { suppressesMappedBarriers: true } },
  ]
  it('certifies the implemented typed consumable write path', () => {
    const activity = dnd5eActivityFromAuthoringPresetV1({ id: 'persistent-area', label: 'Synthetic purification' }, [])
    activity.outcomes = [{ id: 'execute', when: { kind: 'always' }, operations: [
      { id: 'purify', kind: 'purify-map-consumables', contaminants: ['poison', 'disease'] },
    ] }]
    expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
  })
  it.each(disabledMapOperations)('does not certify a registered but skipped map operation: $id', operation => {
    const activity = dnd5eActivityFromAuthoringPresetV1({ id: 'persistent-area', label: 'Synthetic boundary' }, [])
    activity.outcomes = [{ id: 'execute', when: { kind: 'always' }, operations: [operation] }]
    activity.automation = automationCapabilityFromLegacyStatus('full')
    const before = structuredClone(activity)
    const analysis = dnd5eActivityAutomationAnalysisV1(activity)
    expect(analysis.missingComponents).toEqual([])
    expect(analysis.handledComponents).toContain(`operation:${operation.kind}`)
    expect(analysis.capability.level).toBe('assisted')
    expect(analysis.capability.manualPhases).toEqual(expect.arrayContaining(['effects', 'persistence']))
    expect(analysis.capability.supportedPhases).not.toContain('effects')
    expect(analysis.capability.limitations.join()).toContain(`（${operation.id}）`)
    expect(activity).toEqual(before)
  })

  it('keeps the object summon restriction scoped to the runtime branch', () => {
    const activity = dnd5eActivityFromAuthoringPresetV1({ id: 'persistent-area', label: 'Synthetic boundary' }, [])
    activity.id = 'spell:true-polymorph'
    activity.outcomes = [{ id: 'execute', when: { kind: 'always' }, operations: [{ id: 'object-creature', kind: 'summon',
      monsterId: 'srd-5.1:zombie', count: { kind: 'constant', value: 1 }, durationRounds: 600, concentration: true,
      side: 'ally', timing: 'immediate', persistAfterConcentrationCompletes: true }] }]
    expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('assisted')
    expect(dnd5eActivityAutomationAnalysisV1({ ...activity, id: 'other-summon' }).capability.level).toBe('full')
  })
  it.each(['immediate','source-next-turn-start'] as const)('checks summon timing independently from the generic summon handler (%s)', timing=>{
    const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'spawn',name:'Spawn',activation:{kind:'action'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),
      outcomes:[{id:'spawn',when:{kind:'always'},operations:[{kind:'summon',id:'spawn',monsterId:'srd-5.1:zombie',count:{kind:'constant',value:1},timing,durationRounds:10,concentration:false,side:'enemy'}]}]}
    const analysis=dnd5eActivityAutomationAnalysisV1(activity)
    const compatibility=dnd5eActivityHeadlessCompatibility(activity)
    expect(analysis.capability.level).toBe('full')
    expect(compatibility.supported).toBe(true)
    if(timing==='source-next-turn-start') expect(analysis.handledComponents).toContain('summon-timing:source-next-turn-start')
  })
  it('recognizes the implemented inventory armor binding and source-rest lifecycle during import', () => {
    const analysis = dnd5eActivityAutomationAnalysisV1({
      schemaVersion:1,id:'armor-blessing',name:'Armor blessing',activation:{kind:'free'},target:{kind:'self'},
      invocation:{kind:'triggered',event:'long-rest-complete',confirmation:'actor-choice',retention:'single-event'},
      effects:[{schemaVersion:1,id:'armor',name:'Armor',stacking:'replace',duration:{kind:'permanent'},breakOn:['source-long-rest-complete'],
        modifiers:[{kind:'armor-enchantment',itemSelection:'inventory-item',requiresNonmagical:true,armorClassBonus:{kind:'constant',value:1}}]}],
      outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'bind',kind:'apply-effect',target:'actor',effectId:'armor'}]}],
      automation:automationCapabilityFromLegacyStatus('full'),
    })
    expect(analysis.missingComponents).toEqual([])
    expect(analysis.handledComponents).toContain('effect-modifier:armor-enchantment')
    expect(analysis.capability.level).toBe('full')
  })

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
