import type {Character} from '../../types/character'
import type {SharedCampaignTimeState} from '../../lib/campaignTime'
import {validCampaignRestSessions} from '../../../shared/campaign-rest-sessions.mjs'
import {dnd5eRestActivityReceiptKey} from './restActivityWindows'

export interface Dnd5eRestStartActivityWindow {
  schemaVersion:1; characterId:string; sessionId:string;
  receipts:Record<string,'used'|'declined'>
}
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=160&&value.trim()===value
export function normalizeDnd5eRestStartActivityWindow(value:unknown,characterId:string):Dnd5eRestStartActivityWindow|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return
  const row=value as Dnd5eRestStartActivityWindow
  if(row.schemaVersion!==1||row.characterId!==characterId||!id(row.sessionId)||!row.receipts||typeof row.receipts!=='object'||Array.isArray(row.receipts))return
  const entries=Object.entries(row.receipts)
  if(entries.length>1024||entries.some(([key,status])=>{
    if(!['used','declined'].includes(status))return true
    try{const ids:unknown=JSON.parse(key);return !Array.isArray(ids)||ids.length!==2||ids.some(value=>typeof value!=='string'||!/^[a-z0-9][a-z0-9._:-]{0,255}$/.test(value))}catch{return true}
  }))return
  return {schemaVersion:1,characterId,sessionId:row.sessionId,receipts:Object.fromEntries(entries)}
}
export function openDnd5eRestStartActivityWindow(character:Character,clock:SharedCampaignTimeState){
  if(!validCampaignRestSessions(clock.restSessions,clock.worldMinute,clock.advances))return
  const sessions=(clock.restSessions??[]).filter(row=>row.status==='active'&&row.characterIds.includes(character.id))
  if(sessions.length!==1||sessions[0].startedAtWorldMinute!==clock.worldMinute)return
  const session=sessions[0]
  const saved=normalizeDnd5eRestStartActivityWindow(character.dnd5eRestStartActivityWindow,character.id)
  if(character.dnd5eRestStartActivityWindow!=null&&!saved)return
  const ledger:Dnd5eRestStartActivityWindow=saved?.sessionId===session.id?saved:{schemaVersion:1,characterId:character.id,sessionId:session.id,receipts:{}}
  return {...ledger,event:session.kind==='long-rest'?'long-rest-started' as const:'short-rest-started' as const,eventId:`rest-start:${session.id}`}
}
export function consumeDnd5eRestStartActivityWindow(character:Character,clock:SharedCampaignTimeState,input:{eventId:string;packageId:string;activityId:string;outcome:'used'|'declined'}):Character|undefined{
  if(![input.packageId,input.activityId].every(value=>/^[a-z0-9][a-z0-9._:-]{0,255}$/.test(value))||!['used','declined'].includes(input.outcome))return
  const window=openDnd5eRestStartActivityWindow(character,clock)
  const key=dnd5eRestActivityReceiptKey(input.packageId,input.activityId)
  if(!window||window.eventId!==input.eventId||window.receipts[key]||Object.keys(window.receipts).length>=1024)return
  return {...character,dnd5eRestStartActivityWindow:{schemaVersion:1,characterId:character.id,sessionId:window.sessionId,receipts:{...window.receipts,[key]:input.outcome}}}
}
