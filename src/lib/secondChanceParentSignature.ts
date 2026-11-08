import type{Dnd5eHeadlessCombatState}from'../rulesets/dnd5e/headlessCombatEngine'
import{listRegisteredDnd5eActivityPackages}from'../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{ensureDnd5eCoreSpellActivitiesRegisteredV1}from'../rulesets/dnd5e/activities/dnd5eCoreSpellActivities'
import{dnd5ePluginFeatureDefinition}from'../rulesets/dnd5e/plugins/pluginContentCatalog'
/** A compact cross-reload definition guard. It is not a capability or an
 * authorization token, and cannot restore any process-local Host receipt. */
export async function secondChanceParentDefinitionSignature(state:Dnd5eHeadlessCombatState):Promise<string>{
 ensureDnd5eCoreSpellActivitiesRegisteredV1()
 const ids=[...new Set(Object.values(state.combatants).flatMap(actor=>actor.pluginFeatureIds))].sort()
 const text=JSON.stringify([listRegisteredDnd5eActivityPackages(),ids.map(id=>{const feature=dnd5ePluginFeatureDefinition(id);return[id,feature?.automation,feature?.declarativeAbility]})])
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))
 return 'sha256:'+Array.from(new Uint8Array(hash),value=>value.toString(16).padStart(2,'0')).join('')
}
