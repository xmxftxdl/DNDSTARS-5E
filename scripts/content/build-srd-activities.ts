import {createHash} from 'node:crypto'
import {writeFileSync} from 'node:fs'
import * as source from './srdSpellActivities.authoring'
import {DND5E_SRD_SPELL_CATALOG} from '../../src/rulesets/dnd5e/spellCatalog'
 const ids=DND5E_SRD_SPELL_CATALOG.map(s=>s.id)
 const entries=(fn: (id:string)=>unknown)=>Object.fromEntries(ids.flatMap(id=>{const value=fn(id);return value?[[id,value]]:[]}))
 const snapshot={
  full:source.dnd5eSrdAuditedFullContentDefinitionsV1(),partial:source.dnd5eSrdAuditedPartialContentDefinitionsV1(),manual:source.dnd5eSrdAuditedManualContentDefinitionsV1(),
  definitions:entries(source.dnd5eSrdAuditedSpellDefinitionV1), activities:entries(source.dnd5eSrdAuditedSpellActivityV1),
  partialDefinitions:entries(source.dnd5eSrdAuditedPartialSpellDefinitionV1), partialActivities:entries(source.dnd5eSrdAuditedPartialSpellActivityV1),
  overrides:entries(source.dnd5eSrdAuditedCoreOverrideSpellActivityV1),
  celestial:Array.from({length:10},(_,i)=>source.dnd5eConjureCelestialChoicesAtSlotV1(i)),
  elemental:Array.from({length:10},(_,i)=>source.dnd5eConjureElementalChoicesAtSlotV1(i)),
  fey:Array.from({length:10},(_,i)=>source.dnd5eConjureFeyChoicesAtSlotV1(i)),
  minor:Object.fromEntries(['one-cr-2','two-cr-1','four-cr-half','eight-cr-quarter'].map(id=>[id,source.dnd5eConjureMinorElementalChoicesForFormationV1(id)])),
  woodland:Object.fromEntries(['one-cr-2','two-cr-1','four-cr-half','eight-cr-quarter'].map(id=>[id,source.dnd5eConjureWoodlandBeingChoicesForFormationV1(id)])),
 }
 const dictionary: Record<string,string> = {}
 const text=JSON.stringify(snapshot,(key,v)=>{
  if(typeof v==='function')throw Error('Executable value')
  if(v === undefined) return {$undefined:true}
  if (['name','description','label','summary'].includes(key) && typeof v === 'string') {
   const id = `text.${createHash('sha256').update(v).digest('hex')}`
   dictionary[id] = v
   return {$text:id}
  }
  return v
 })
 writeFileSync('src/content/srd-5.1/localization/audited.zh-CN.json',JSON.stringify(dictionary)+'\n','utf8')
 if(Object.keys(snapshot.definitions).length < 190) throw Error('Incomplete spell export')
 writeFileSync('src/content/srd-5.1/audited-spells.json',text+'\n','utf8')
