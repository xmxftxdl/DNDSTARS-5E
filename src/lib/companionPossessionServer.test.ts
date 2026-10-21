import {expect,it} from 'vitest'
import {removeCharacterConcentrationEffectsFromMaps} from '../../scripts/shared-server-core.mjs'
import {droppedDnd5eCompanionObjects} from '../rulesets/dnd5e/companionCarriedObjects'
import type {Token} from '../store/maps'

it.each(['corpse','vanish','hostile'] as const)('preserves companion possessions on server concentration cleanup: %s',mode=>{
 const token:Token={id:'summon',type:'enemy',label:'Skeleton',size:1,x:125,y:175,elevationFeet:20,hp:13,color:'',emoji:'',
  dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'caster',createdRound:1,expiresAfterRound:600,concentrationId:'danse',side:'player',
   ...(mode==='corpse'?{animatedCorpse:{id:'body',label:'Body',type:'enemy',size:1,x:25,y:25,hp:0,color:'',emoji:''}}:{}),
   ...(mode==='hostile'?{becomesHostileAfterConcentrationEnds:true}:{})},
  dnd5eCarriedObjects:[{id:'vessel',pickupReceipt:'pickup:source:1',label:'Vessel',objectState:{schemaVersion:1,wornOrCarried:true,inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'source'},waterContainer:{schemaVersion:1,open:false,capacityGallons:1,waterGallons:0.125},consumable:{kind:'drink',contaminants:['poison']}}}]}
 const caster:Token={id:'caster',characterId:'hero',type:'player',label:'Caster',size:1,x:25,y:25,color:'',emoji:''}
 const input={maps:[{id:'map',tokens:[caster,token]}]},before=structuredClone(input)
 const result=removeCharacterConcentrationEffectsFromMaps(input,'hero','danse')
 expect(result.changed).toBe(true)
 const tokens=result.next.maps[0].tokens
 if(mode==='hostile'){
  expect(tokens.find((t:{id:string})=>t.id==='summon')?.dnd5eCarriedObjects).toEqual(token.dnd5eCarriedObjects)
  expect(tokens.filter((t:{type?:string})=>t.type==='obstacle')).toHaveLength(0)
 }else{
  expect(tokens.filter((t:{type?:string})=>t.type==='obstacle')).toEqual(droppedDnd5eCompanionObjects(token))
  expect(tokens.some((t:{id:string})=>t.id==='summon')).toBe(false)
  if(mode==='corpse')expect(tokens.find((t:{id:string})=>t.id==='body')).toMatchObject({hp:0,x:125,y:175,elevationFeet:20})
 }
 const saved=JSON.parse(JSON.stringify(result.next))
 const again=removeCharacterConcentrationEffectsFromMaps(saved,'hero','danse')
 expect(again.next).toEqual(saved)
 expect(again.changed).toBe(false)
 expect(input).toEqual(before)
})
