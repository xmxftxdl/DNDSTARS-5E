import type {AttackResolution} from '../contracts'
import type {Dnd5eCombatEvent,Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eCombatantClassLevel,dnd5eCombatantHasSubclass} from './headlessCombatPrimitives'
import {dnd5ePluginFeatureDefinition} from './pluginApi'
import {dnd5eIsIncapacitated,dnd5eReactionsPrevented} from './passiveDefenses'
import {effectiveDnd5eActiveEffects} from './activeEffects'
export interface IncomingHitNegationFacts{event:Extract<Dnd5eCombatEvent,{type:'attack-resolved'}>;attack:AttackResolution}
export interface IncomingHitNegationChoice{featureId:string;die:number}
export function incomingHitNegationOptions(state:Dnd5eHeadlessCombatState,event:IncomingHitNegationFacts['event']){
 const owner=state.combatants[event.targetId],attacker=state.combatants[event.actorId]
 if(!event.hit||!owner||!attacker||owner.currentHp<=0||owner.deathSaves.dead||!owner.turn.reactionAvailable||dnd5eIsIncapacitated(owner)||dnd5eReactionsPrevented(owner))return[]
 return owner.pluginFeatureIds.flatMap(featureId=>{
  const feature=dnd5ePluginFeatureDefinition(featureId),ability=feature?.declarativeAbility,mechanic=ability?.mechanic
  if(!feature||feature.automation!=='full'||ability?.automation!=='full'||mechanic?.kind!=='incoming-hit-die-negation'||ability.cost?.economy!=='reaction'||ability.cost.resources?.length)return[]
  if(feature.sourceClassId&&(dnd5eCombatantClassLevel(owner,feature.sourceClassId)<(feature.minimumLevel??ability.level)||(feature.sourceSubclassId&&!dnd5eCombatantHasSubclass(owner,feature.sourceClassId,feature.sourceSubclassId))))return[]
  if(feature.classRequirements?.some(r=>{const level=Object.entries(owner.classLevels??{}).find(([id])=>id===r.classId)?.[1]??(owner.classId===r.classId?owner.level:0);return level<r.minimumLevel}))return[]
  const rulesId=mechanic.requiredAttackerSourceActivityId.includes(':')?mechanic.requiredAttackerSourceActivityId:feature.ownerPluginId+':'+mechanic.requiredAttackerSourceActivityId
  const ownCurse=effectiveDnd5eActiveEffects(attacker.classState.activeEffects).some(effect=>effect.source.pluginId===feature.ownerPluginId&&effect.source.rulesId===rulesId&&
   (effect.source.actorId===owner.id||!!effect.source.characterId&&effect.source.characterId===owner.classState.wardingBondParticipantCharacterId))
  return ownCurse?[{featureId,dieSides:mechanic.dieSides,minimumRoll:mechanic.minimumRoll}]:[]
 })
}
type Listener=(facts:IncomingHitNegationFacts,snapshot:Dnd5eHeadlessCombatState)=>IncomingHitNegationChoice|void
let active:{listener:Listener;error?:unknown;interrupted?:boolean;negated?:{actorId:string;targetId:string}}|undefined
export function withIncomingHitNegationCheckpoints<T>(listener:Listener,run:()=>T):T{const prior=active;active={listener};try{return run()}finally{active=prior}}
export function visitIncomingHitNegationCheckpoint(state:Dnd5eHeadlessCombatState,event:IncomingHitNegationFacts['event'],attack:AttackResolution){
 if(active)active.negated=undefined
 if(!active||!event.hit)return
 const facts={event:structuredClone(event),attack:structuredClone(attack)}
 try{const choice=active.listener(facts,structuredClone(state));return choice?{facts,choice}:undefined}catch(error){active.error=error;active.interrupted=true;throw error}
}
export function rethrowIncomingHitNegationInterruption(){if(active?.interrupted)throw active.error}

export function markIncomingHitWasNegated(actorId:string,targetId:string){if(active)active.negated={actorId,targetId}}
export function incomingHitWasNegated(actorId:string,targetId:string){return active?.negated?.actorId===actorId&&active.negated.targetId===targetId}
