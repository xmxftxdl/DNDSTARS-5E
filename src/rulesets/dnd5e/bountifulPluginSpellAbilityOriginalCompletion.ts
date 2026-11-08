import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone';
import{readBountifulPluginSpellAbilityOriginalQualification,type BountifulPluginSpellAbilityOriginalQualification}from'./bountifulPluginSpellAbilityOriginalBoundary';
import{resolveDnd5ePreparedWithMaterialDamageReactions,type Dnd5eDamageReactionFlowOptions}from'./damageReactionFlow';
import{bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt';
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction';
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0];
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value)),completed=new WeakMap<object,{sourceSignature:string;resultSignature:string;effectTimestamp:number}>();
/** Independent final proof: only the genuine fixed original facade plus Base
 * can issue it; a copied result or ended initial observer cannot do so. */
export function readBountifulPluginSpellAbilityCompletedOriginal(result:object,source:Source){const row=completed.get(result);if(!row)throw Error('plugin-spell-ability-completion:actual-completed-facade-required');if(signature(result)!==row.resultSignature)throw Error('plugin-spell-ability-completion:changed-actual-native-result');if(signature(source)!==row.sourceSignature)throw Error('plugin-spell-ability-completion:changed-actual-completed-source');return{source:cloneDnd5eHostTransactionInput(source),effectTimestamp:row.effectTimestamp}}
/** Receipts are input evidence; the Normal ACK owner separately authenticates
 * their exact current private rows before it may bind a world publication. */
export async function completeBountifulPluginSpellAbilityOriginal(input:{source:Source;pluginSpellAbilityOriginalQualification:BountifulPluginSpellAbilityOriginalQualification;receipts:readonly BountifulOriginalDieReceipt[];options:Dnd5eDamageReactionFlowOptions}){
 const facts=readBountifulPluginSpellAbilityOriginalQualification(input.pluginSpellAbilityOriginalQualification,input.source),first=input.receipts[0];if(!first||first.originalAdapterId!=='plugin-spell'||first.identity.parentId!==facts.source.prepared.action.id||first.identity.effectTimestamp!==facts.effectTimestamp||JSON.stringify(first.request)!==JSON.stringify(facts.request))throw Error('plugin-spell-ability-completion:exact-initial-original-required');
 const source={...facts.source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:facts.source.prepared.action.id,source:facts.source,receipts:input.receipts})},resolved=await resolveDnd5ePreparedWithMaterialDamageReactions(input.options,source,resolvePreparedDnd5ePluginSpellCast);
 readBountifulPluginSpellAbilityOriginalQualification(input.pluginSpellAbilityOriginalQualification,input.source);
 if(resolved.result.ok&&resolved.application)completed.set(resolved,{sourceSignature:signature(input.source),resultSignature:signature(resolved),effectTimestamp:facts.effectTimestamp});return resolved;
}
