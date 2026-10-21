import {expect,it} from 'vitest'
import {applyDnd5ePersistentAreaMapChanges,dnd5ePersistentAreaMapChange} from './persistentAreaMapChanges'
import {createDnd5eCoreSpellArea,getDnd5eCoreSpellAreaDeclaration} from './coreSpellAreas'
import type {BattleMap} from '../../store/maps'

it('projects Host area updates, additions and removals without replacing unrelated areas',()=>{
 const area=createDnd5eCoreSpellArea({declaration:getDnd5eCoreSpellAreaDeclaration('spike-growth')!,actionId:'a',sourceCharacterId:'c',sourceTokenId:'t',sourceSaveDc:15,slotLevel:2,round:1,anchorCell:{col:0,row:0},cells:[{col:0,row:0}]})
 const map:BattleMap={id:'m',name:'m',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[],dnd5ePluginAreas:[area,{...area,id:'removed'}]}
 const after={...map,dnd5ePluginAreas:[{...area,label:'Updated'},{...area,id:'new'}]}
 const before=structuredClone({map,after})
 const event=dnd5ePersistentAreaMapChange(map,after)
 if(!event)throw Error('missing-delta')
 after.dnd5ePluginAreas[0].label='mutated-after-event'
 const live={...map,dnd5ePluginAreas:[...map.dnd5ePluginAreas!,{...area,id:'unrelated'}]}
 const result=applyDnd5ePersistentAreaMapChanges(live,[event])
 expect(result.dnd5ePluginAreas?.map(a=>a.id)).toEqual([area.id,'unrelated','new'])
 expect(result.dnd5ePluginAreas?.[0].label).toBe('Updated')
 expect(applyDnd5ePersistentAreaMapChanges(result,[event])).toEqual(result)
 expect(applyDnd5ePersistentAreaMapChanges({...live,id:'other'},[event])).toEqual({...live,id:'other'})
 expect(dnd5ePersistentAreaMapChange(map,map)).toBeUndefined()
 expect(()=>dnd5ePersistentAreaMapChange(map,{...after,id:'other'})).toThrow('persistent-area-map-mismatch')
 expect(map).toEqual(before.map)
})
