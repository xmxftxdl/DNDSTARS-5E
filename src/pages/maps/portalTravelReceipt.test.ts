import {expect,it} from 'vitest'
import type {BattleMap,Token} from '../../store/maps'
import {applyApprovedPortalTravelReceipts,portalTravelReceipt} from './portalTravelReceipt'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from '../../rulesets/dnd5e/mapBridge'
import {settleDnd5eTemplePortalEntry} from '../../rulesets/dnd5e/templePortalEntry'
import {settleDnd5eWordOfRecallTeleport} from '../../rulesets/dnd5e/wordOfRecall'

const token=(id:string,x=25):Token=>({id,type:'enemy',label:id,x,y:25,size:1,color:'',emoji:'',hp:10,maxHp:10})
const map=(id:string,tokens:Token[]):BattleMap=>({id,name:id,width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens})

it('combines recall placement, individual temple saves and selective transfer without moving the denied caster',async()=>{
 const source=map('source',['caster','companion'].map((id,index)=>({...token(id,25+index*50),poolId:'srd-5.1:imp'})))
 const destination=map('destination',[]),geometry=createEmptyMapGeometry(destination.id)
 geometry.structureLifetimes=[{id:'temple',casterId:'builder',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:[],replacementGroup:'temple-of-the-gods',
  objectBoundary:{points:[{x:0,y:0},{x:500,y:0},{x:500,y:500},{x:0,y:500}],bottomFeet:0,topFeet:20},
  templeWard:{hostileCreatureTypes:['fiend'],saveDc:18,healingBonus:5,lighting:'none'}}]
 const proposed=settleDnd5eWordOfRecallTeleport({maps:[source,destination],sourceMapId:source.id,actorTokenId:'caster',
  declaration:{schemaVersion:1,mode:'recall',targets:[{tokenId:'companion',name:'Companion'}]},
  sanctuary:{schemaVersion:1,id:'sanctuary',kind:'recall-sanctuary',sourceActorId:'caster',subjectActorId:'caster',sourceActivityId:'cast',createdWorldMinute:0,slotLevel:6,
   sanctuaryName:'Temple',deityConnection:'Test',destinationMapId:destination.id,destinationMapName:destination.name,destinationX:125,destinationY:125,destinationElevationFeet:0}})
 expect(proposed.ok).toBe(true);if(!proposed.ok)throw Error(proposed.reason)
 let maps=[source,destination]
 const approvals=[]
 for(const id of proposed.movedTokenIds){
  const live=maps.find(map=>map.id===source.id)!
  const receipt=portalTravelReceipt(live,proposed.maps.find(map=>map.id===destination.id)!,id)
  const snapshot=createDnd5eMapCombatSnapshot({map:live,geometry:createEmptyMapGeometry(source.id),characters:[],worldMinute:100,combatId:'recall',
   initiativeOrder:live.tokens.map(token=>({tokenId:token.id,roll:20,label:token.label,emoji:'',color:''}))})
  const entry=await settleDnd5eTemplePortalEntry({state:snapshot.state,destinationScene:{map:destination,geometry,worldMinute:100,projectedTokenIds:[]},event:receipt.event,
   isCurrent:()=>true,roll:async()=>({d20:id==='caster'?1:20,d20Second:id==='caster'?1:20})})
  expect(entry.ok).toBe(true);if(!entry.ok)throw Error(entry.reason)
  const application=planDnd5eMapResultApplication({state:entry.state,events:[...entry.events],map:live,characters:[],characterIdByCombatantId:snapshot.characterIdByCombatantId})
  maps=maps.map(map=>map.id===source.id?application.map:map)
  if(entry.allowed)approvals.push(receipt)
 }
 const final=applyApprovedPortalTravelReceipts(maps,approvals)
 expect(final[0].tokens.map(token=>token.id)).toEqual(['caster'])
 expect(final[0].tokens[0]).toMatchObject({x:25,y:25,hp:10,dnd5eCombatState:{activeEffects:expect.arrayContaining([
  expect.objectContaining({definitionId:'temple-of-the-gods:entry-denied',source:expect.objectContaining({rulesId:'temple-entry:destination:temple'})})])}})
 expect(final[1].tokens.map(token=>token.id)).toEqual(['companion'])
 expect(source.tokens).toHaveLength(2);expect(destination.tokens).toHaveLength(0)
})

it('moves only approved companions and preserves post-save state instead of the stale proposal',()=>{
 const source=map('source',[token('caster'),token('companion',75)])
 const destination=map('destination',[])
 const proposal=map('destination',[token('caster',125),token('companion',175)])
 const approved=portalTravelReceipt(source,proposal,'companion')
 const latest=map('source',[{...source.tokens[0],hp:7,dnd5eCombatState:{conditions:['frightened']}},
  {...source.tokens[1],hp:8,dnd5eCombatState:{conditions:['poisoned']}}])
 const before=structuredClone([latest,destination])
 const result=applyApprovedPortalTravelReceipts([latest,destination],[approved])
 expect(result[0].tokens).toEqual([latest.tokens[0]])
 expect(result[1].tokens).toEqual([{...latest.tokens[1],x:175,elevationFeet:undefined,movementAnimation:undefined}])
 expect(result.flatMap(map=>map.tokens).map(token=>token.id).sort()).toEqual(['caster','companion'])
 expect([latest,destination]).toEqual(before)
})

it('keeps all travelers and saved effects when all entries are denied',()=>{
 const maps=[map('source',[token('caster'),token('companion')]),map('destination',[])]
 expect(applyApprovedPortalTravelReceipts(maps,[])).toEqual(maps)
})

it('applies multiple same-map arrivals without dropping denied or unrelated creatures',()=>{
 const source=map('source',[token('caster'),token('companion',75),token('denied',225)])
 const proposal=map('source',[token('caster',125),token('companion',175),token('denied',225)])
 const result=applyApprovedPortalTravelReceipts([source],['caster','companion'].map(id=>portalTravelReceipt(source,proposal,id)))
 expect(result[0].tokens).toHaveLength(3)
 expect(result[0].tokens.find(token=>token.id==='denied')).toEqual(source.tokens[2])
 expect(result[0].tokens.find(token=>token.id==='caster')?.x).toBe(125)
 expect(result[0].tokens.find(token=>token.id==='companion')?.x).toBe(175)
})

it('rejects duplicate or missing traveler approvals without mutating input',()=>{
 const source=map('source',[token('caster')]),destination=map('destination',[])
 const receipt=portalTravelReceipt(source,map('destination',[token('caster',125)]),'caster')
 const before=structuredClone([source,destination])
 expect(()=>applyApprovedPortalTravelReceipts([source,destination],[receipt,receipt])).toThrow('portal-approved-traveler-invalid')
 expect(()=>applyApprovedPortalTravelReceipts([map('source',[]),destination],[receipt])).toThrow('portal-approved-traveler-invalid')
 expect([source,destination]).toEqual(before)
})
