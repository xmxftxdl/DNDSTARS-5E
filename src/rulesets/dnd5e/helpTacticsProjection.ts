import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import type{InitiativeEntry}from'../../components/map/InitiativeTracker'
import{dnd5ePluginFeaturesAvailableForCharacter,dnd5eCharacterHasPluginFeature}from'./pluginApi'
import{dnd5ePluginSubclassCurrentEnvelopeFullV1}from'./plugins/pluginContentCatalog'
import{createDnd5eMapCombatSnapshot}from'./mapBridge'
import{dnd5eBasicHelpTacticsRangeFeet,dnd5eBasicHelpTargetEligible}from'./headlessCombatEngine'
/** Read-only presentation; the actual prepared command and engine repeat the gate. */
export function dnd5eCharacterHelpTacticsRange(character:Character):number|undefined{const ranges=dnd5ePluginFeaturesAvailableForCharacter(character).flatMap(feature=>{const mechanic=feature.declarativeAbility?.mechanic;return mechanic?.kind==='help-tactics'&&feature.automation==='full'&&!!feature.sourceClassId&&!!feature.sourceSubclassId&&dnd5ePluginSubclassCurrentEnvelopeFullV1(feature.sourceSubclassId)&&dnd5eCharacterHasPluginFeature(character,feature.id)?[mechanic.attackRangeFeet]:[]});return ranges.length?Math.max(...ranges):undefined}
export function dnd5eMapHelpTacticsProjection(input:{map:BattleMap;characters:readonly Character[];actorTokenId:string;initiativeOrder:readonly InitiativeEntry[];combatId:string;round:number;worldMinute?:number}){const token=input.map.tokens.find(t=>t.id===input.actorTokenId),character=input.characters.find(c=>c.id===token?.characterId);if(!character||dnd5eCharacterHelpTacticsRange(character)===undefined)return undefined;const snapshot=createDnd5eMapCombatSnapshot(input),actor=snapshot.state.combatants[input.actorTokenId];if(!actor||dnd5eBasicHelpTacticsRangeFeet(actor)===undefined)return undefined;return{bonusAction:true,attackTargetIds:new Set(input.map.tokens.filter(t=>dnd5eBasicHelpTargetEligible(snapshot.state,input.actorTokenId,t.id,'attack')).map(t=>t.id))}}
