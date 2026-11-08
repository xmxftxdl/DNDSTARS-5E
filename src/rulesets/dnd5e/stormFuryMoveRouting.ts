import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import{dnd5eCombatantClassLevel,dnd5eCombatantHasSubclass}from'./headlessCombatPrimitives'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'./pluginApi'
/** A routing read only. It issues no Native, Room, original-die or world authority.
 * The caller uses the actual initial canonical movement preparation; the chosen
 * sequence still has to earn its own real preparation and final-hit operation. */
export function stormFuryMoveRequiresCanonicalSequence(state:Dnd5eHeadlessCombatState,moverId:string){const mover=state.combatants[moverId];if(!mover||dnd5eCombatantClassLevel(mover,'sorcerer')<14)return false;return mover.pluginFeatureIds.some(id=>{const feature=dnd5ePluginFeatureDefinition(id),declaration=feature?.declarativeAbility;return!!feature&&dnd5ePluginFeatureCurrentEnvelopeFullV1(id)&&feature.automation==='full'&&declaration?.automation==='full'&&declaration.mechanic?.kind==='storm-fury'&&declaration.level===14&&declaration.cost?.economy==='reaction'&&feature.sourceClassId==='sorcerer'&&!!feature.sourceSubclassId&&dnd5eCombatantHasSubclass(mover,'sorcerer',feature.sourceSubclassId)})}

/** Only actual possible targets opt the generic facade into this new family.
 * An unrelated owner elsewhere on the map cannot change ordinary replay.
 * This read grants no native origin, original die or Room permission. */
export function stormFuryMoveSourceNeedsNativeReaction(input:unknown){
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
 if(!object(input)||!object(input.prepared)||!object(input.prepared.action)||typeof input.prepared.action.actorTokenId!=='string'||!object(input.prepared.state)||!object(input.prepared.state.combatants))return false
 const targets=new Set([input.prepared.action.actorTokenId])
 if(object(input.attacks))for(const choice of Object.values(input.attacks))if(object(choice)&&object(choice.coverAttackRedirect)&&typeof choice.coverAttackRedirect.replacementTargetId==='string')targets.add(choice.coverAttackRedirect.replacementTargetId)
 const state=input.prepared.state as unknown as Dnd5eHeadlessCombatState
 return[...targets].some(id=>stormFuryMoveRequiresCanonicalSequence(state,id))
}
