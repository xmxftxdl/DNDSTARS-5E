import{restoreBountifulPluginSpellAbilityOriginalCollectorSession,readBountifulPluginSpellAbilityOriginalRecoveryProof}from'./bountifulPluginSpellAbilityOriginalRecovery';
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import type{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction';
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0];
/** Restore the same authenticated queued declaration before rebuilding its dice UI.
 * A fresh Page preparation clock is not an original operation identity. */
export async function restoreBountifulPluginSpellAbilityInitialSource(prepared:Source['prepared']):Promise<Source|undefined>{
 if(prepared.spell.id!=='telekinesis'||prepared.payload.activityChoices?.movement!=='hold'||prepared.activity?.checks?.length!==1||prepared.activity.checks[0].kind!=='opposed-ability-check')return undefined;
 let session:Awaited<ReturnType<typeof restoreBountifulPluginSpellAbilityOriginalCollectorSession>>;
 try{session=await restoreBountifulPluginSpellAbilityOriginalCollectorSession({parentId:prepared.action.id,mapId:prepared.map.id,combatId:prepared.state.combatId})}catch(error){if(error instanceof Error&&error.message==='plugin-spell-ability-original:current-private-book-required')return undefined;throw error}
 try{const {source}=readBountifulPluginSpellAbilityOriginalRecoveryProof(session.originalBookProof());if(JSON.stringify(encodeSecondChanceParentWire(source.prepared.action))!==JSON.stringify(encodeSecondChanceParentWire(prepared.action)))throw Error('plugin-spell-initial:changed-queued-declaration');return source}finally{await session.dispose()}
}
