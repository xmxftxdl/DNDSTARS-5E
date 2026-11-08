import { expect, it } from 'vitest'
import { exportPdfContentModule } from '../pdfContentModule'
import { exportLegacyDnd5eStarMod, projectDnd5eStarModRuntime } from '../starModAdapter'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from '../contentPackageV2'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'

const activity=(sleep:boolean):Dnd5eActivityDefinitionV1=>({schemaVersion:1,id:sleep?'sleep':'coma',name:sleep?'Explicit forced sleep':'Ordinary unconsciousness',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1},legacySource:{kind:'feature',id:sleep?'sleep':'coma'},automation:automationCapabilityFromLegacyStatus('full'),consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'condition',kind:'apply-standard-condition',target:'target',condition:'unconscious',...(sleep?{sleep:'forced' as const}:{}),duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'}}]}]})

it('validates forced sleep only for unconsciousness and preserves the declaration through two archive imports',async()=>{
  const forced=activity(true)
  expect(validateDnd5eActivityDefinitionV1(forced)).toEqual([])
  for(const invalid of [{condition:'prone'},{sleep:true},{sleep:'voluntary'}]){
    const changed=structuredClone(forced)
    Object.assign(changed.outcomes[0].operations[0],invalid)
    expect(validateDnd5eActivityDefinitionV1(changed).length).toBeGreaterThan(0)
  }
  const activities=[forced,activity(false)]
  const draft={schemaVersion:1 as const,assumptions:[],unsupported:[],contentJson:JSON.stringify({name:'Sleep provenance fixture',features:activities.map(a=>({id:a.id,name:a.name,summary:'Synthetic',description:'Synthetic',automation:'full'})),activities})}
  const archive=await exportPdfContentModule({id:'test.sleep-provenance',name:'Sleep provenance',version:'1.0.0',inventoryComplete:true,entries:[{sourceId:'fixture',name:'Fixture',draft}]})
  const first=parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(archive.bytes))!
  const second=parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(await exportLegacyDnd5eStarMod(first)))!
  for(const pkg of [first,second]){
    expect(pkg.content.activities?.find(a=>a.id==='sleep')?.outcomes[0].operations[0]).toMatchObject({sleep:'forced'})
    const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try{
      for(const sleep of [true,false])for(const immune of [true,false]){
        const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:[`${pkg.manifest.id}:${sleep?'sleep':'coma'}`]})
        const target={...structuredClone(actor),id:'target',controller:'dm' as const,initiative:10,pluginFeatureIds:[],cannotBeForcedToSleep:immune}
        const state=startDnd5eHeadlessCombat('sleep-provenance',[actor,target])
        const before=structuredClone(state)
        const result=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,authoritativeRolls:{},confirmedBy:'actor',command:{schemaVersion:1,commandId:`${sleep}-${immune}`,actorId:'actor',packageId:pkg.manifest.id,packageVersion:pkg.manifest.version,activityId:sleep?'sleep':'coma',targetIds:['target'],expectedRevision:1}})
        expect(result.result.ok,JSON.stringify(result.result)).toBe(true)
        expect(state).toEqual(before)
        if(result.result.ok){
          expect(result.result.state.combatants.target.conditions.includes('unconscious')).toBe(!(sleep&&immune))
          expect(result.result.state.combatants.actor.turn.actionAvailable).toBe(false)
          expect(JSON.parse(JSON.stringify(result.result.state)).combatants.target.cannotBeForcedToSleep).toBe(immune)
        }
      }
    } finally {dispose()}
  }
})
