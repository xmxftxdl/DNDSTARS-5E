import { expect, it, vi } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { normalizeSharedCampaignTime } from '../../lib/campaignTime'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import type { Character } from '../../types/character'
import { commitPactWeaponSummon, type PactAuthorityCharacter } from './pactWeaponSummonHost'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eBoundWeaponAbilityChoice, dnd5eOwnerViewBoundWeaponAbilityChoice, dnd5eWeaponAttackProfile } from './equipment'
import { projectPactWeaponOwnerStatus } from '../../../shared/pact-owner-status.mjs'

vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'dm',role:'dm'})}))
const ns='test.pact-owner-ability-view',subclass=ns+':blade'
function source(){return registerDnd5eRulesPlugin({manifest:{id:ns,name:'Native Pact ability source',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'Private'},setup(api){api.registerDeclarativeSubclass({schemaVersion:1,id:'blade',classId:'warlock',name:'Blade',summary:'Native Pact ability source',abilities:[{schemaVersion:1,id:'pact-ability',name:'Pact ability',description:'Use Charisma for a genuinely conjured Pact weapon',level:3,trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],mechanic:{kind:'pact-weapon-ability',ability:'cha'},automation:'full'}]})}})}
async function actualSummon(){
 const owner=normalizeCharacter({id:'owner',name:'Owner',charClass:'warlock',level:3,dnd5eClassLevels:{warlock:3},currentHp:20,maxHp:20,abilities:{str:10,dex:14,con:12,int:10,wis:10,cha:16},equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]},dnd5eClassChoices:{classes:{warlock:{subclass,selections:{'pact-boon':['blade']}}}}})
 let data:Record<string,unknown>={characters:{characters:[owner],_sync:{revision:1}},maps:{maps:[{id:'map',name:'Map',width:100,height:100,gridSize:10,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'token',characterId:'owner',type:'player',label:'Owner',x:20,y:30,size:1,color:'',emoji:''}]}],_sync:{revision:2}},combat:{mapId:'map',active:false,round:1,initiativeIndex:0,initiativeOrder:[],updatedAt:1,_sync:{revision:3}},'campaign-time':{...normalizeSharedCampaignTime({worldMinute:100,worldSecondRemainder:6,updatedAt:1}),_sync:{revision:4}}}
 const revision=(name:string)=>(data[name] as {_sync?:{revision:number}}|undefined)?._sync?.revision??0
 const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>data[name]==null?null:structuredClone(data[name] as T),saveResourcesAtomically:async(writes,options)=>{for(const w of writes)expect(w.expectedRevision).toBe(revision(w.name));for(const[name,value]of Object.entries(options?.readRevisions??{}))expect(value).toBe(revision(name));const next=structuredClone(data);for(const w of writes)next[w.name]={...(w.data as object),_sync:{revision:revision(w.name)+1}};data=next;return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
 const receipt=await commitPactWeaponSummon({mapId:'map',actorTokenId:'token',templateId:'srd-5.1:equipment:dnd5e-greatsword',expectedPactRevision:0,transactionId:'actual-summon'},gateway)
 const native=(data.characters as {characters:PactAuthorityCharacter[]}).characters[0]
 return{native,receipt}
}
function ownerView(native:PactAuthorityCharacter){const view=structuredClone(native) as PactAuthorityCharacter&{dnd5ePactWeaponStatus?:ReturnType<typeof projectPactWeaponOwnerStatus>};delete view.dnd5ePactWeaponAuthority;view.dnd5ePactWeaponStatus=projectPactWeaponOwnerStatus(native);return view}

it('actual Host-conjured two-handed Pact weapon exposes only an owner slot hint and a source-owned display choice',async()=>{
 const dispose=source();try{const{native,receipt}=await actualSummon(),view=ownerView(native),status=view.dnd5ePactWeaponStatus
  expect(dnd5eBoundWeaponAbilityChoice(native)).toBe('cha');expect(dnd5eWeaponAttackProfile(native,{boundWeaponAbility:'bound'})).toMatchObject({baseWeaponId:'dnd5e-greatsword',handsUsed:2,attackAbility:'cha',damage:{count:2,sides:6,bonus:3}})
  expect(status).toMatchObject({status:'present',summonedWeaponSlots:['mainWeapon']});expect(JSON.stringify(status)).not.toContain(receipt.inventoryInstanceId);expect(status).not.toHaveProperty('summons');expect(view).not.toHaveProperty('dnd5ePactWeaponAuthority');expect(dnd5eOwnerViewBoundWeaponAbilityChoice(view)).toBe('cha')
  // A presentation hint is deliberately insufficient for native settlement.
  expect(dnd5eBoundWeaponAbilityChoice(view)).toBeUndefined();expect(dnd5eWeaponAttackProfile(view,{boundWeaponAbility:'bound'})).toBeUndefined()
 }finally{dispose()}
})
it('the owner hint disappears for actual dismissed or invalid private identity/receipt and cannot lend a different slot',async()=>{
 const dispose=source();try{const{native}=await actualSummon();for(const mutate of[(c:PactAuthorityCharacter)=>{c.dnd5ePactWeaponAuthority!.summons=[]},(c:PactAuthorityCharacter)=>{c.dnd5ePactWeaponAuthority!.inventory.ownerId='someone-else'},(c:PactAuthorityCharacter)=>{c.dnd5ePactWeaponAuthority!.state.binding!.status='dismissed'},(c:PactAuthorityCharacter)=>{c.dnd5ePactWeaponAuthority!.summons[0].pactRevision=c.dnd5ePactWeaponAuthority!.state.revision+1}]){const changed=structuredClone(native);mutate(changed);expect(projectPactWeaponOwnerStatus(changed)?.summonedWeaponSlots).toBeUndefined()}
  expect(dnd5eOwnerViewBoundWeaponAbilityChoice(ownerView(native),'offHand')).toBeUndefined()
 }finally{dispose()}
})
it('actual source removal and another subclass/boon still deny the projected choice while private authorization remains required',async()=>{
 const dispose=source();let view:Character;try{const{native}=await actualSummon();view=ownerView(native);for(const changed of[{...view,level:2,dnd5eClassLevels:{warlock:2}},{...view,dnd5eClassChoices:{classes:{warlock:{subclass:'fiend',selections:{'pact-boon':['blade']}}}}},{...view,dnd5eClassChoices:{classes:{warlock:{subclass,selections:{'pact-boon':['tome']}}}}}])expect(dnd5eOwnerViewBoundWeaponAbilityChoice(changed)).toBeUndefined();expect(dnd5eOwnerViewBoundWeaponAbilityChoice(view)).toBe('cha')
 }finally{dispose()}
 expect(dnd5eOwnerViewBoundWeaponAbilityChoice(view!)).toBeUndefined();expect(dnd5eBoundWeaponAbilityChoice(view!)).toBeUndefined()
})
