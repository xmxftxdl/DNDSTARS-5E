import '../activeEffects'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'dismiss', name: 'Dismiss',
 activation: { kind: 'free' }, target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
 outcomes: [{ id: 'dismiss', when: { kind: 'always' }, operations: [{ id: 'dismiss', kind: 'dismiss-owned-temporary-summons', sourceActivityIds: ['summon-a', 'summon-b'] }] }] }
it('exposes temporary summon dismissal as an executable free UI action', () => {
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(dnd5eActivityAutomationAnalysisV1(activity).missingComponents).toEqual([])
 expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
 expect(dnd5ePluginFeatureActionFromActivityV1(activity)).toMatchObject({id:'dismiss',economy:'none',targeting:{kind:'self'}})
})
it.each([[], ['summon-a','summon-a'], [''], Array.from({length:17},(_,i)=>'source-'+i)])('rejects an invalid source selector %j', ids => {
 const invalid=structuredClone(activity)
 Object.assign(invalid.outcomes[0].operations[0],{sourceActivityIds:ids})
 expect(validateDnd5eActivityDefinitionV1(invalid).some(error=>error.includes('sourceActivityIds'))).toBe(true)
})
