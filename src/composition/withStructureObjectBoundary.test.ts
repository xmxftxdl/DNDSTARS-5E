import {expect,it,vi} from 'vitest'
import {withStructureObjectBoundary} from './withStructureObjectBoundary'
import type {SharedRoomGatewayPort} from '../ports/sharedRoomGateway'
import {normalizeCharacter} from '../store/characters'
import {applyDnd5eInventoryGrantBundle,normalizeDnd5eInventory} from '../rulesets/dnd5e/items'
import {createEmptyMapGeometry} from '../lib/mapGeometry'

it('commits travel and item loss atomically, fences the roster, preserves inputs and ordinary save outcomes',async()=>{
 const binding={schemaVersion:1 as const,mapId:'site',structureId:'keep'}
 const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',equipment:{},maxHp:20,currentHp:20,dnd5eInventory:{schemaVersion:3,entries:[]}})
 const grant=applyDnd5eInventoryGrantBundle([hero],{characterId:'hero',receiptId:'boundary-grant',grants:[
  {templateId:'srd-5.1:item:potion-of-healing',quantity:1,structureBinding:binding},{templateId:'srd-5.1:item:potion-of-healing',quantity:2}]})
 const state:Record<string,any>={maps:{_sync:{revision:1},maps:[{id:'site',name:'Site',width:1000,height:1000,gridSize:50,feetPerCell:5,
  tokens:[{id:'hero-token',characterId:'hero',type:'player',label:'Hero',x:100,y:100,elevationFeet:0,size:1,color:'',emoji:''}]}]},
  characters:{_sync:{revision:1},characters:grant.characters},'map-geometry':{_sync:{revision:1},schemaVersion:3,maps:[{
   ...createEmptyMapGeometry('site',1),structureLifetimes:[{id:'keep',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:10080,entityIds:['wall'],
   objectBoundary:{points:[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}],bottomFeet:0,topFeet:30}}]}]}}
 const atomic=vi.fn(async(writes:any[],options:any)=>{
  for(const write of writes)if(write.expectedRevision!==state[write.name]._sync.revision)throw Error('conflict')
  for(const [name,revision] of Object.entries(options?.readRevisions??{})){
   if(writes.some(write=>write.name===name))throw Error('duplicate-read-write')
   if(revision!==(state[name]?._sync.revision??0))throw Error('conflict')
  }
  const revisions:Record<string,number>={}
  for(const write of writes){revisions[write.name]=state[write.name]._sync.revision+1;state[write.name]={...structuredClone(write.data),_sync:{revision:revisions[write.name]}}}
  return {status:'committed',transactionId:'test',revisions}
 })
 const ordinary=vi.fn(async()=>({status:'skipped',reason:'forbidden'}))
 const gateway=withStructureObjectBoundary({getRevisionWatermark:(name:string)=>state[name]?._sync.revision??0,
  loadResource:async(name:string)=>structuredClone(state[name]??null),saveResourcesAtomically:atomic,saveResourceWithResult:ordinary} as unknown as SharedRoomGatewayPort)
 const next=structuredClone(state.maps);next.maps[0].id='destination'
 const spellbookEdit=structuredClone(state.characters)
 spellbookEdit.characters[0].dnd5eClassChoices={classes:{wizard:{selections:{'wizard-spellbook':['test:spell']}}}}
 expect(await gateway.saveResourceWithResult('characters',spellbookEdit)).toEqual({status:'skipped',reason:'forbidden'})
 expect(ordinary).toHaveBeenCalledOnce()
 expect(atomic).not.toHaveBeenCalled()
 ordinary.mockClear()
 const before=structuredClone(state)
 await expect(gateway.saveResourcesAtomically([{name:'maps',data:next,expectedRevision:1}],{readRevisions:{characters:0}})).rejects.toThrow('conflict')
 expect(state).toEqual(before)
 await gateway.saveResourcesAtomically([{name:'maps',data:next,expectedRevision:1}])
 expect(state.maps.maps[0].id).toBe('destination')
 expect(normalizeDnd5eInventory(state.characters.characters[0]).entries.map(entry=>entry.quantity)).toEqual([2])
 expect(state.characters._sync.revision).toBe(2)
 expect(next).toEqual({...before.maps,maps:[{...before.maps.maps[0],id:'destination'}]})
 expect(await gateway.saveResourceWithResult('characters',state.characters)).toEqual({status:'skipped',reason:'forbidden'})
 expect(ordinary).toHaveBeenCalledOnce()
})
