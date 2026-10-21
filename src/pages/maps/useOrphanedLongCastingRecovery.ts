import {useEffect} from 'react'
import {browserSharedRoomService} from '../../composition/browserSharedRoomService'
import {useCharacterStore} from '../../store/characters'
import {useMapStore} from '../../store/maps'
import {endRoomConcentration} from '../../store/roomCommands'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedPlayerActionRequestQueueState,SharedPlayerActionProcessedState} from '../../lib/sharedCombatTypes'
import {dnd5eLongCastingBindingFromConcentrationId,type Dnd5eLongCastingBinding} from '../../rulesets/dnd5e/longCastingIdentity'
import {dnd5eLongCastingLocallyActive} from '../../rulesets/dnd5e/longCastingContinuity'
import {dmPlayerActionAuthorityLockName,type PlayerActionAuthorityLockManager} from './useMapsPlayerActionTransport'
import {roomLongCastingOwnerActive} from './roomLongCastingOwner'

interface CastingOwner {id:string;dnd5eCombatState?:{concentrationSpellId?:string}}
export async function recoverOrphanedLongCasting(input:{
 mapId:string;readCharacters:()=>readonly CastingOwner[];locallyActive:(binding:Dnd5eLongCastingBinding)=>boolean;
 pending:(requestId:string)=>Promise<boolean>;locks:PlayerActionAuthorityLockManager;
 ownerActive?:(binding:Dnd5eLongCastingBinding)=>Promise<boolean>;
 end:(binding:Dnd5eLongCastingBinding,expectedId:string)=>Promise<void>;
}):Promise<number>{
 let recovered=0
 for(const character of input.readCharacters()){
  const id=character.dnd5eCombatState?.concentrationSpellId, binding=id&&dnd5eLongCastingBindingFromConcentrationId(id)
  if(!binding||binding.mapId!==input.mapId||binding.actorCharacterId!==character.id||input.locallyActive(binding))continue
  await input.locks.request(dmPlayerActionAuthorityLockName(binding.mapId,binding.requestId),{mode:'exclusive',ifAvailable:true},async lock=>{
   if(!lock||input.locallyActive(binding)||await input.pending(binding.requestId))return false
   if(input.ownerActive&&await input.ownerActive(binding))return false
   const owners=input.readCharacters().filter(c=>c.id===binding.actorCharacterId)
   if(owners.length!==1||owners[0].dnd5eCombatState?.concentrationSpellId!==id)return false
   await input.end(binding,id);recovered++;return true
  })
 }
 return recovered
}

/** Runs outside the player action transaction; live requests own the same Web Lock. */
export function useOrphanedLongCastingRecovery(isDm:boolean,mapId:string|undefined):void{
 useEffect(()=>{
  if(!isDm||!mapId||getRoomSession()?.role!=='dm'||typeof navigator==='undefined'||!navigator.locks)return
  let disposed=false
  const recover=async()=>{
   if(!useCharacterStore.getState().characters.some(character=>{
    const id=character.dnd5eCombatState?.concentrationSpellId,binding=id?dnd5eLongCastingBindingFromConcentrationId(id):undefined
    return binding?.mapId===mapId&&!dnd5eLongCastingLocallyActive(binding)
   }))return
   await Promise.all([useCharacterStore.getState().loadShared(),useMapStore.getState().loadShared()])
   if(disposed)return
   await recoverOrphanedLongCasting({mapId,readCharacters:()=>disposed?[]:useCharacterStore.getState().characters,
    ownerActive:roomLongCastingOwnerActive,
    locallyActive:dnd5eLongCastingLocallyActive,locks:navigator.locks as PlayerActionAuthorityLockManager,
    pending:async requestId=>{
     const[queue,processed]=await Promise.all([
      browserSharedRoomService.loadSharedResource<SharedPlayerActionRequestQueueState>('player-action-requests'),
      browserSharedRoomService.loadSharedResource<SharedPlayerActionProcessedState>('player-action-processed'),
     ])
     return disposed||(!processed?.actionIds.includes(requestId)&&!!queue?.requests.some(a=>a.id===requestId&&a.status==='pending'))
    },
    end:async(binding,expectedId)=>{
     if(disposed)return
     const result=await endRoomConcentration({characterId:binding.actorCharacterId,mapId:binding.mapId,
      tokenId:binding.actorTokenId,expectedConcentrationId:expectedId})
     if(result.status==='rejected')throw Error('orphan-casting-cleanup-rejected')
    },
   })
  }
  const stop=browserSharedRoomService.subscribeSharedResourceInvalidation('characters',recover,{recoveryMs:3000,recoverWhenHidden:true,refreshOnVisibilityRestore:true})
  return()=>{disposed=true;stop()}
 },[isDm,mapId])
}
