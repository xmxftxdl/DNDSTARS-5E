import {campaignUnappliedEffectMinutes} from '../../../shared/combat-round-credits.mjs'
import {mapGeometryPointInPolygon,mapGeometryTokenElevation,type MapGeometryState} from '../../lib/mapGeometry'
import type {SharedCampaignTimeState} from '../../lib/campaignTime'
import type {Token} from '../../store/maps'

/** Host-only scene/time facts for a stationary recipient during a campaign time advance. */
export interface TempleCampaignHealingContext {
 geometry:MapGeometryState
 token:Token
 clock:SharedCampaignTimeState
 fromWorldMinute:number
 actorKey:string
}

/** Integrate the strongest active temple bonus over uncredited healing ticks. */
export function dnd5eTempleCampaignHealingBonus(context:TempleCampaignHealingContext,spellLevel:number,activeRounds:number,blockedRounds=0):number {
 if(!Number.isSafeInteger(spellLevel)||spellLevel<1||spellLevel>9||!Number.isSafeInteger(activeRounds)||activeRounds<=0)return 0
 const {geometry,token,clock,fromWorldMinute,actorKey}=context
 if(!Number.isSafeInteger(fromWorldMinute)||fromWorldMinute<0||clock.worldMinute<=fromWorldMinute)return 0
 const elevation=mapGeometryTokenElevation(geometry,token)
 const structures=(geometry.structureLifetimes??[]).filter(s=>s.replacementGroup==='temple-of-the-gods'&&s.templeWard&&s.objectBoundary&&
  elevation>=s.objectBoundary.bottomFeet&&elevation<s.objectBoundary.topFeet&&mapGeometryPointInPolygon(token,s.objectBoundary.points))
 if(!structures.length)return 0
 const cuts=[...new Set([fromWorldMinute,clock.worldMinute,
  ...structures.flatMap(s=>[s.createdWorldMinute,...s.expiresWorldMinute==null?[]:[s.expiresWorldMinute]]),
  ...clock.advances.flatMap(a=>[a.fromWorldMinute,a.toWorldMinute])])].filter(t=>t>=fromWorldMinute&&t<=clock.worldMinute).sort((a,b)=>a-b)
 let remaining=activeRounds,bonus=0,blocked=Math.max(0,blockedRounds)
 for(let i=1;i<cuts.length&&remaining>0;i++){
  const start=cuts[i-1],end=cuts[i]
  const rounds=Math.min(remaining,Math.max(0,Math.round(campaignUnappliedEffectMinutes({...clock,worldMinute:end},start,actorKey)*10)))
  remaining-=rounds
  const prevented=Math.min(rounds,blocked)
  blocked-=prevented
  const strength=Math.max(0,...structures.filter(s=>s.createdWorldMinute<=start&&(s.expiresWorldMinute==null||s.expiresWorldMinute>=end)).map(s=>s.templeWard!.healingBonus))
  bonus+=(rounds-prevented)*strength
 }
 return bonus
}
