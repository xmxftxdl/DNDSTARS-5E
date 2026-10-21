import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eInterruptedFeatureSpellActivity } from './dnd5eInterruptedFeatureSpell'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'

it('removes interrupted spell saves without fabricating dice and keeps independent feature effects', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion:1,id:'feature',name:'Feature',
    activation:{kind:'bonus-action'},target:{kind:'creature',relation:'any',count:1,rangeFeet:60},
    automation:automationCapabilityFromLegacyStatus('full'),
    spellInvocation:{spellId:'command',castAtLevel:1,operationIds:['spell']},
    checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'wis',dc:{kind:'constant',value:14},scope:'per-target'}],
    outcomes:[{id:'spell',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'spell',kind:'temporary-hit-points',target:'target',amount:{kind:'constant',value:5}}]},
      {id:'feature',when:{kind:'always'},operations:[{id:'feature',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:1}}]}] }
  const before = JSON.stringify(activity)
  const projected = dnd5eInterruptedFeatureSpellActivity(activity)
  expect(projected.checks).toEqual([])
  const actor={id:'actor',controller:'player' as const,level:6,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:16},armorClass:10,currentHp:20,maxHp:20,conditions:[]}
  const result=resolveDnd5eActivity({activity:projected,actor,targets:[{...actor,id:'target'}],distanceFeetByTargetId:{target:5},rolls:{}})
  expect(result.ok).toBe(true)
  if(result.ok){expect(result.checks).toEqual([]);expect(result.proposals).toEqual([expect.objectContaining({operationId:'feature',targetId:'actor'})])}
  expect(JSON.stringify(activity)).toBe(before)
  const shared=structuredClone(activity)
  shared.outcomes[1].when={kind:'check',checkId:'save',result:'success'}
  expect(dnd5eInterruptedFeatureSpellActivity(shared).checks).toHaveLength(1)
})
