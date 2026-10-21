import {useEffect,useRef} from 'react'
import {useNavigate} from 'react-router-dom'
import {browserSharedRoomService} from '../composition/browserSharedRoomService'
import {COMBAT_INTERRUPT_RESOURCE,type SharedCombatInterruptQueueState} from '../lib/combatInterruptQueue'
import {campaignVisibleInterruptQueue} from '../lib/campaignInterruptScope'
import {resolveCombatInterruptPromptSelection} from '../lib/combatInterruptPrompts'
import {getRoomSession} from '../lib/roomSession'
import {getAssignedPlayerCharacterId,getPlayerCharacter,playerViewCharacters} from '../lib/playerView'
import {useCharacterStore} from '../store/characters'
import {useMapStore} from '../store/maps'

/** Bring an authorized player to an expiring structure's reaction, from any page. */
export default function CampaignExpiryReactionNavigation({active,mapsPath}:{active:boolean;mapsPath:string}){
 const navigate=useNavigate(),navigateRef=useRef(navigate)
 navigateRef.current=navigate
 const handled=useRef(new Set<string>())
 const characters=useCharacterStore(state=>state.characters)
 useEffect(()=>{
  const session=getRoomSession()
  if(!active||session?.role!=='player')return
  let cancelled=false
  const load=async()=>{
   const queue=campaignVisibleInterruptQueue(await browserSharedRoomService.loadSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE),'')
   if(cancelled||!queue)return
   const assignedCharacterId=getAssignedPlayerCharacterId(session.slot)
   const options={slot:session.slot,assignedCharacterId}
   const player=getPlayerCharacter(characters,options)
   const selection=resolveCombatInterruptPromptSelection({queue,mapId:queue.mapId,now:Date.now(),suppressed:{},answerContext:{
    characters,visibleCharacters:playerViewCharacters(characters,options),playerCharId:player?.id,assignedCharacterId,
    roomMemberId:session.memberId,authority:'player',tokens:useMapStore.getState().maps.find(map=>map.id===queue.mapId)?.tokens??[],
   }})
   const pending=selection['plugin-choice']?.interrupt
   if(!pending||handled.current.has(pending.id))return
   handled.current.add(pending.id)
   navigateRef.current(mapsPath)
  }
  const unsubscribe=browserSharedRoomService.subscribeSharedResourceInvalidation(COMBAT_INTERRUPT_RESOURCE,load,{recoveryMs:3_000})
  return()=>{cancelled=true;unsubscribe()}
 },[active,mapsPath,characters])
 return null
}
