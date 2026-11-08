import type{PreparedDnd5ePlayerEndTurn}from'./endTurnAction'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import{dnd5eDeathSavingThrowMode}from'./nextD20Advantage'
import{dnd5eActiveOptionalBonusDice}from'./activeEffects'
import{dnd5eHeldBardicInspirationDie,dnd5eDarkOnesOwnLuckAvailable,dnd5eSavingThrowRerollFeature,dnd5eFailedD20BonusOptions,dnd5eCombatantHasConcentrationEffect}from'./headlessCombatEngine'
import{dnd5eD20ChoiceRerollFeaturesForCharacter,dnd5ePostD20AdjustmentFeaturesForCharacter}from'./pluginApi'
import{dnd5eCoreInspirationChoiceRerollOption}from'../../lib/d20InterruptPolicy'
/** Scheduling availability only. Neither this boolean nor a prepared shape issues a die, original qualification, continuation or world result. */
export function canScheduleBountifulDeathRepeatPage(prepared:PreparedDnd5ePlayerEndTurn,map:BattleMap,characters:readonly Character[]):boolean{
 const actor=prepared.state.combatants[prepared.actorToken.id],character=prepared.actor,checks=prepared.activeEffectSavingThrows
 if(!actor||!character||actor.currentHp!==0||actor.deathSaves.dead||actor.deathSaves.stable||![actor.deathSaves.successes,actor.deathSaves.failures].every(value=>Number.isInteger(value)&&value>=0&&value<=2)||prepared.state.initiativeOrder[prepared.state.initiativeIndex]!==actor.id||dnd5eDeathSavingThrowMode(actor)!=='normal'||map.dnd5ePluginAreas?.length||checks.length!==1||prepared.activeEffectPeriodicDamage.length||prepared.activeEffectRandomConditions.length||prepared.swallowRegurgitationSavingThrows.length)return false
 const slot=checks[0],effect=slot.effect;if(slot.mode!==(actor.racialRules?.halflingLucky===true?'advantage':'normal')||slot.blessed||slot.baned||effect.repeatSave?.timing!=='target-turn-end'||effect.repeatSave.ability!=='wis'||effect.repeatSave.dc!==slot.dc||effect.repeatSave.damageOnFailure||!effect.source.rulesId?.endsWith('cause-fear')||!actor.classState.activeEffects?.some(e=>JSON.stringify(e)===JSON.stringify(effect)))return false
 if(dnd5eCombatantHasConcentrationEffect(prepared.state,actor.id,'bless')||dnd5eCombatantHasConcentrationEffect(prepared.state,actor.id,'bane')||dnd5eHeldBardicInspirationDie(actor)||dnd5eDarkOnesOwnLuckAvailable(actor)||dnd5eSavingThrowRerollFeature(actor)||(actor.classState.legendaryResistanceUses??0)>0||dnd5eActiveOptionalBonusDice(actor.classState.activeEffects,'saving-throw').length||dnd5eFailedD20BonusOptions(prepared.state,actor.id,'saving-throw').length||dnd5eCoreInspirationChoiceRerollOption(character,actor.id,'normal'))return false
 // Query available declared optional choices, without executing a hypothetical Native die or authorizing any physical input.
 if(characters.some(c=>dnd5ePostD20AdjustmentFeaturesForCharacter(c).length)||Array.from({length:20},(_,i)=>i+1).some(face=>dnd5eD20ChoiceRerollFeaturesForCharacter(character,'saving-throw','self-roll',face,{rollMode:'normal'}).length))return false
 return true
}
