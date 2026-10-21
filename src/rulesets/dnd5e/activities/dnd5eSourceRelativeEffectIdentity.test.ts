import {expect,it} from 'vitest'
import {createDnd5eMechanicalEffect} from '../activeEffects'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from '../mapBridge'
import {normalizeCharacter} from '../../../store/characters'
import {migrateMapsState} from '../../../store/maps'
import {normalizeSharedCampaignTime} from '../../../lib/campaignTime'
import {reconcileDnd5eCharacterCampaignTime} from '../campaignTimeRules'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import {dnd5eActivityRootRequirementsSatisfiedV1} from './dnd5eActivityExecutor'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

it('preserves caster-relative retry protection through new scene token IDs and expires after 24 hours',()=>{
 const characters=['caster','target','other'].map(id=>normalizeCharacter({id,name:'Same name',charClass:'法师',level:14,currentHp:20,maxHp:20,dnd5eWorldTimeAppliedMinute:100}))
 const map=(id:string,suffix:string)=>migrateMapsState({maps:[{id,name:id,width:500,height:500,gridSize:50,tokens:characters.map((character,index)=>({id:character.id+suffix,characterId:character.id,label:character.name,type:'player',x:25+index*50,y:25,size:1,color:'#fff',emoji:''}))}]}).maps[0]
 const original=map('first','-old')
 const snapshot=createDnd5eMapCombatSnapshot({map:original,characters,worldMinute:100,combatId:'first',initiativeOrder:original.tokens.map(token=>({tokenId:token.id,label:token.label,color:'',emoji:'',roll:20}))})
 snapshot.state.combatants['target-old'].classState.activeEffects=[createDnd5eMechanicalEffect({id:'protection',definitionId:'scrying-retry',label:'Protection',targetId:'target-old',
  source:{kind:'spell',actorId:'caster-old',actorName:'Same name',rulesId:'scrying'},modifiers:{},duration:{type:'rounds',remainingRounds:14400,tickOn:'source-turn-end'}})]
 const application=planDnd5eMapResultApplication({map:original,characters,state:snapshot.state,characterIdByCombatantId:snapshot.characterIdByCombatantId})
 const saved=JSON.parse(JSON.stringify(application.characters)) as typeof characters
 expect(saved.find(character=>character.id==='target')?.dnd5eCombatState?.activeEffects?.[0].source.characterId).toBe('caster')
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'scrying-retry',name:'Retry gate',activation:{kind:'action'},target:{kind:'creature',count:1,relation:'any'},
  requirements:[{kind:'active-effect',subject:'target',source:'self',effectId:'scrying-retry',present:false}],outcomes:[],automation:automationCapabilityFromLegacyStatus('partial')}
 const second=map('second','-new')
 for(const minute of [100,1539,1540]){
  const clock=normalizeSharedCampaignTime({schemaVersion:2,worldMinute:minute,timers:[],advances:[],updatedAt:1})
  const advanced=saved.map(character=>reconcileDnd5eCharacterCampaignTime(character,clock).character)
  const next=createDnd5eMapCombatSnapshot({map:second,characters:advanced,worldMinute:minute,combatId:'second',initiativeOrder:second.tokens.map(token=>({tokenId:token.id,label:token.label,color:'',emoji:'',roll:20}))})
  for(const caster of ['caster','other']){
   const actor=next.state.combatants[caster+'-new'],target=next.state.combatants['target-new']
   // Even reusing the old token id cannot turn another character into its owner.
   const source={...dnd5eActivityActorSnapshotFromCombatantV1(actor,actor,next.state),id:caster==='other'?'caster-old':actor.id}
   const allowed=dnd5eActivityRootRequirementsSatisfiedV1({activity,actor:source,targets:[dnd5eActivityActorSnapshotFromCombatantV1(target,actor,next.state)],rolls:{}})
   expect(allowed,`${caster} at ${minute}`).toBe(caster==='other'||minute>=1540)
  }
 }
})
