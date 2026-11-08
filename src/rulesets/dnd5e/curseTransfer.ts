import {dnd5eIsIncapacitated} from './passiveDefenses'
import {dnd5eHeadlessTurnKey,replaceDnd5eCombatantActiveEffects,type Dnd5eHeadlessCombatState} from './headlessCombatEngine'

/** Host transfer preserves the existing spell instance and authoritative concentration clock. */
export function transferSourceConcentrationEffect(state:Dnd5eHeadlessCombatState,input:{actorId:string;targetId:string;spellId:string;tags:readonly string[]}):boolean{
 const actor=state.combatants[input.actorId],target=state.combatants[input.targetId]
 if(!actor||!target||actor.currentHp<=0||actor.deathSaves.dead||dnd5eIsIncapacitated(actor)||!state.active||state.initiativeOrder[state.initiativeIndex]!==actor.id||!actor.concentrating||actor.classState.concentrationSpellId!==input.spellId||actor.magicSuppressed||target.deathSaves.dead)return false
 const key=dnd5eHeadlessTurnKey(state,actor.id)
 const candidates=Object.values(state.combatants).flatMap(bearer=>(bearer.classState.activeEffects??[]).filter(effect=>effect.source.actorId===actor.id&&effect.source.kind==='spell'&&effect.source.rulesId===input.spellId&&effect.duration.type==='concentration'&&effect.duration.sourceActorId===actor.id&&effect.duration.concentrationId===input.spellId&&!effect.suspendedBy?.length&&input.tags.every(tag=>effect.tags?.includes(tag))&&effect.bearerZeroHitPointsTurnKey!=null&&effect.bearerZeroHitPointsTurnKey!==key).map(effect=>({bearer,effect})))
 if(candidates.length!==1||candidates[0].bearer.id===target.id)return false
 const {bearer,effect}=candidates[0]
 if(target.classState.activeEffects?.some(candidate=>candidate.id===effect.id))return false
 const moved=structuredClone(effect);delete moved.bearerZeroHitPointsTurnKey
 const remaining=(bearer.classState.activeEffects??[]).filter(candidate=>candidate.id!==effect.id)
 replaceDnd5eCombatantActiveEffects(bearer,remaining)
 replaceDnd5eCombatantActiveEffects(target,[...target.classState.activeEffects??[],moved])
 const stillAffectsBearer=remaining.some(candidate=>candidate.duration.type==='concentration'&&candidate.duration.sourceActorId===actor.id&&candidate.duration.concentrationId===input.spellId)
 if(!stillAffectsBearer&&bearer.classState.concentrationEffectsBySource?.[actor.id]===input.spellId){const entries={...bearer.classState.concentrationEffectsBySource};delete entries[actor.id];bearer.classState.concentrationEffectsBySource=entries}
 target.classState.concentrationEffectsBySource={...target.classState.concentrationEffectsBySource,[actor.id]:input.spellId}
 actor.classState.concentrationTargetIds=[...new Set([...(actor.classState.concentrationTargetIds??[]).filter(id=>id!==bearer.id||stillAffectsBearer),target.id])]
 return true
}
