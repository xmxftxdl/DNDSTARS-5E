import {afterEach,expect,it,vi} from 'vitest'
import {normalizeCharacter,useCharacterStore,clearPendingAuthorityCharacterPatchesForTest,mergePendingAuthorityCharacterPatches,publishCharactersAtSnapshotRevision} from './characters'
import * as roomResources from '../composition/browserSharedRoomResources'
import * as appMode from '../lib/appMode'
import {createDnd5eConditionEffect} from '../rulesets/dnd5e/activeEffects'
afterEach(()=>{clearPendingAuthorityCharacterPatchesForTest();vi.restoreAllMocks()})
it('acknowledges applied concentration fields independently of later authority sighting metadata, then accepts lawful concentration removal',()=>{
 const before=normalizeCharacter({id:'hero',name:'Hero',level:7,charClass:'邪术师',currentHp:30,maxHp:30,dnd5eCombatState:{schemaVersion:2},concentrating:false})
 const effect={...createDnd5eConditionEffect({id:'sight',condition:'invisible',targetId:'hero-token',source:{kind:'feature',actorId:'hero-token'},duration:{type:'concentration',sourceActorId:'hero-token',concentrationId:'sight'}}),modifiers:{darkvisionRangeFeet:30,throughSolidObjectsRangeFeet:30}}
 const applied={...before,concentrating:true,dnd5eCombatState:{schemaVersion:2 as const,activeEffects:[effect],concentrationSpellId:'sight',recentCreatureSightings:{ally:{mapId:'map',worldMinute:101,label:'ally-token'}}}}
 useCharacterStore.setState({characters:[before],selectedId:'hero'})
 useCharacterStore.getState().applyAuthorityUpdate('hero',applied,{protectPatchUntilAcknowledged:true})
 const echo={...applied,dnd5eCombatState:{...applied.dnd5eCombatState,recentCreatureSightings:{ally:{mapId:'map',worldMinute:101,label:'Ally'},enemy:{mapId:'map',worldMinute:101,label:'Enemy'}}}}
 mergePendingAuthorityCharacterPatches([echo])
 const ended={...echo,concentrating:false,dnd5eCombatState:{schemaVersion:2 as const,recentCreatureSightings:echo.dnd5eCombatState.recentCreatureSightings}}
 const [merged]=mergePendingAuthorityCharacterPatches([ended])
 expect(merged.concentrating).toBe(false)
 expect(merged.dnd5eCombatState?.activeEffects).toBeUndefined()
 expect(merged.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
 expect(merged.dnd5eCombatState?.recentCreatureSightings).toEqual(echo.dnd5eCombatState.recentCreatureSightings)
})
it('binds a whole-roster publication to its exact fetched revision, and never retries a rejected old array',async()=>{
 vi.spyOn(appMode,'isPlayerPort').mockReturnValue(false)
 const save=vi.spyOn(roomResources,'saveSharedResourcesAtomically').mockResolvedValue({status:'committed',transactionId:'snapshot',revisions:{characters:139}})
 const payload={characters:[],selectedId:null,updatedAt:1}
 await expect(publishCharactersAtSnapshotRevision(payload,137)).resolves.toEqual({status:'saved',revision:139})
 expect(save).toHaveBeenCalledExactlyOnceWith([{name:'characters',data:payload,expectedRevision:137}])
 save.mockClear();save.mockRejectedValue(new Error('state-transaction-conflict:characters'))
 await expect(publishCharactersAtSnapshotRevision(payload,137)).rejects.toThrow('state-transaction-conflict:characters')
 expect(save).toHaveBeenCalledTimes(1)
})
it('keeps ordinary player profile publication on its existing restricted route',async()=>{
 vi.spyOn(appMode,'isPlayerPort').mockReturnValue(true)
 const save=vi.spyOn(roomResources,'saveSharedResourceWithResult').mockResolvedValue({status:'saved',revision:140})
 const atomic=vi.spyOn(roomResources,'saveSharedResourcesAtomically')
 const payload={characters:[],selectedId:null,updatedAt:1}
 await expect(publishCharactersAtSnapshotRevision(payload,139)).resolves.toEqual({status:'saved',revision:140})
 expect(save).toHaveBeenCalledExactlyOnceWith('characters',payload)
 expect(atomic).not.toHaveBeenCalled()
})
it('retains actual unacknowledged HP, resources and effect changes while preserving an unrelated remote effect',()=>{
 const before=normalizeCharacter({id:'hero',name:'Hero',level:7,currentHp:30,maxHp:30,classResources:{pool:{current:1,max:1}},dnd5eCombatState:{schemaVersion:2}})
 const ours=createDnd5eConditionEffect({id:'ours',condition:'invisible',targetId:'hero',source:{kind:'feature'}})
 const remote=createDnd5eConditionEffect({id:'remote',condition:'frightened',targetId:'hero',source:{kind:'feature'}})
 useCharacterStore.setState({characters:[before],selectedId:'hero'})
 useCharacterStore.getState().applyAuthorityUpdate('hero',{currentHp:20,classResources:{pool:{current:0,max:1}},dnd5eCombatState:{schemaVersion:2,activeEffects:[ours]}},{protectPatchUntilAcknowledged:true})
 const echo={...before,dnd5eCombatState:{schemaVersion:2 as const,activeEffects:[remote]}}
 const [protectedCharacter]=mergePendingAuthorityCharacterPatches([echo])
 expect(protectedCharacter.currentHp).toBe(20)
 expect(protectedCharacter.classResources?.pool.current).toBe(0)
 expect(protectedCharacter.dnd5eCombatState?.activeEffects).toEqual([remote,ours])
 const acknowledged={...protectedCharacter,dnd5eCombatState:{...protectedCharacter.dnd5eCombatState,activeEffects:[remote,ours]}}
 mergePendingAuthorityCharacterPatches([acknowledged])
 const removed={...acknowledged,dnd5eCombatState:{schemaVersion:2 as const,activeEffects:[remote]}}
 expect(mergePendingAuthorityCharacterPatches([removed])[0].dnd5eCombatState?.activeEffects).toEqual([remote])
})
