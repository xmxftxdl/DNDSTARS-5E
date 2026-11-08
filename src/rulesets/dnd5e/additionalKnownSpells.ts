import{dnd5eClassProgression,dnd5ePactSlotLevel}from'./classes'
import{dnd5eEffectiveSpellcastingSourceForClassSnapshot}from'./subclassSpellcasting'
import{DND5E_SRD_SPELL_CATALOG}from'./spellCatalog'
import{dnd5ePluginRegistryStore}from'./plugins/pluginRegistryStore'
import{dnd5eSubclassAdditionalKnownSpellSourcesV1,type Dnd5eAdditionalKnownSpellContextV1,type Dnd5eAdditionalKnownSpellSourceV1}from'./plugins/pluginSubclassAdditionalKnownSpells'
export interface Dnd5eResolvedAdditionalKnownSpellSlotV1 extends Dnd5eAdditionalKnownSpellSourceV1{selectionKey:string;defaultSpellId:string;replacementSpellIds:readonly string[]}
/** Resolve actual source slots independently of the ordinary known array. */
export function dnd5eAdditionalKnownSpellSlotsV1(input:Dnd5eAdditionalKnownSpellContextV1):readonly Dnd5eResolvedAdditionalKnownSpellSlotV1[]{
 const declared=dnd5eSubclassAdditionalKnownSpellSourcesV1(input);if(!declared.length)return[]
 const source=dnd5eEffectiveSpellcastingSourceForClassSnapshot(input.classId,input.classLevel,input.subclassId),kind=source?.definition.spellcasting?.kind
 if(!source||!kind||!['full-known','half-known','one-third-known','pact'].includes(kind))return[]
 const maximum=kind==='pact'?dnd5ePactSlotLevel(input.classLevel):(dnd5eClassProgression(source.definition)[input.classLevel-1]?.spellSlots.length??0),catalog=[...DND5E_SRD_SPELL_CATALOG,...dnd5ePluginRegistryStore.spells.values()]
 return declared.flatMap(slot=>{const original=catalog.find(s=>s.id===slot.spellId);if(!original||original.level<=0||original.level>maximum)return[]
  const selectionKey=slot.sourceId+'/replacement',stored=input.selections[selectionKey],replacementSpellIds=catalog.filter(spell=>spell.level>0&&spell.level<=maximum&&slot.replacementClassSpellListIds?.some(classId=>(spell.classes as readonly string[]).includes(classId))).map(spell=>spell.id),override=stored?.length===2&&stored[0]===slot.choiceOptionId&&replacementSpellIds.includes(stored[1])?stored[1]:undefined
  return[{...slot,selectionKey,defaultSpellId:slot.spellId,spellId:override??slot.spellId,replacementSpellIds:[...new Set(replacementSpellIds)]}]
 })
}
export function dnd5eAdditionalKnownSpellIdsV1(input:Dnd5eAdditionalKnownSpellContextV1):readonly string[]{return[...new Set(dnd5eAdditionalKnownSpellSlotsV1(input).map(slot=>slot.spellId))]}
