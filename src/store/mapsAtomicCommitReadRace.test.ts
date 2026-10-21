import {afterEach,expect,it,vi} from 'vitest'
import {useMapStore,type BattleMap} from './maps'
import * as resources from '../composition/browserSharedRoomResources'
afterEach(()=>vi.restoreAllMocks())
it('does not let a delayed read erase an effect after an atomic commit acknowledges a newer revision',async()=>{
 const map={id:'atomic-help-map',dnd5ePendingMovementCompletions:[{id:'completion:move',actorTokenId:'target'}],name:'Map',width:500,height:500,gridSize:50,tokens:[{id:'target',x:25,y:25,type:'enemy',size:1,dnd5eCombatState:{helpedAttackSourceId:'helper'}}]} as BattleMap
 useMapStore.setState({maps:[map],selectedId:map.id})
 let revision=100
 vi.spyOn(resources,'getSharedResourceRevisionWatermark').mockImplementation(()=>revision)
 let release!:(value:unknown)=>void
 vi.spyOn(resources,'loadSharedResource').mockImplementation(()=>new Promise(resolve=>{release=resolve}) as never)
 const pending=useMapStore.getState().loadShared({force:true})
 revision=101
 const stale=structuredClone(map);stale.tokens[0].dnd5eCombatState={};stale.dnd5ePendingMovementCompletions=[]
 release({maps:[stale],selectedId:map.id,updatedAt:999,_sync:{revision:100}})
 await pending
 expect(useMapStore.getState().maps[0].tokens[0].dnd5eCombatState?.helpedAttackSourceId).toBe('helper')
 expect(useMapStore.getState().maps[0].dnd5ePendingMovementCompletions).toEqual(map.dnd5ePendingMovementCompletions)
 // Equal acknowledged revisions must remain replayable for transaction recovery.
 const committed=structuredClone(map);committed.tokens[0].x=75;committed.dnd5ePendingMovementCompletions=[]
 vi.mocked(resources.loadSharedResource).mockResolvedValue({maps:[committed],selectedId:map.id,updatedAt:1000,_sync:{revision:101}})
 await useMapStore.getState().loadShared({force:true})
 expect(useMapStore.getState().maps[0].tokens[0].x).toBe(75)
 expect(useMapStore.getState().maps[0].dnd5ePendingMovementCompletions).toEqual([])
})

it('does not overwrite remote maps when a read fails validation or transport',async()=>{
 useMapStore.setState({maps:[],selectedId:null})
 vi.spyOn(resources,'loadSharedResource').mockResolvedValue(null)
 const save=vi.spyOn(resources,'saveSharedResourceWithResult')
 await useMapStore.getState().loadShared({force:true})
 expect(save).not.toHaveBeenCalled()
 expect(useMapStore.getState().maps).toEqual([])
})
