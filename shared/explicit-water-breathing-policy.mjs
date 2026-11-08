import {readSupportedCoreCharacterClassLevel} from './core-character-class-levels.mjs'
// Data-only projection from verified Host-installed packages. Never infer a
// feature from its name, and never accept a capability flag from a time request.
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
export function explicitWaterBreathingPoliciesFromPackage(p){
 const ns=p?.manifest?.id;if(typeof ns!=='string'||p.manifest.apiVersion!==2||p.manifest.rulesetId!=='dnd5e-2014-srd-5.1')return []
 if(!((p.format==='dndstars5e-content'&&p.schemaVersion===2)||(p.format==='dndstars5e-unified-content'&&p.schemaVersion===1)||(p.format==='dndstars5e-declarative'&&p.schemaVersion===1)))return []
 const definitions=p.format==='dndstars5e-unified-content'?p.definitions:undefined
 const rows=definitions?definitions.filter(d=>d?.kind==='feature').map(d=>({feature:d.payload,automation:d.automation?.level})):p.content?.features??p.legacy?.features??p.features
 if(!Array.isArray(rows))return subclassWaterBreathingPolicies(p,ns,definitions)
 const features=rows.flatMap(row=>{const f=definitions?row.feature:row,a=definitions?row.automation:f?.automation
  if(!record(f)||typeof f.id!=='string'||!['full','partial'].includes(a)||f.staticModifiers?.canBreatheWater!==true)return []
  // This finite projection covers explicitly granted, data-only permanent
  // features. More involved grants remain a separate reconciliation item.
  if(f.sourceFeatId||f.sourceClassId||f.sourceSubclassId||f.grantedByFeat||f.grantedBySubclass||f.eligibility||f.declarativeAbility||f.isAvailable||(f.requiredKnownSpellIds?.length??0)>0)return []
  const classes=f.classRequirements??[],choices=f.classChoiceRequirements??[]
  if(!Array.isArray(classes)||!classes.every(r=>typeof r?.classId==='string'&&Number.isSafeInteger(r.minimumLevel)&&r.minimumLevel>=1)||!Array.isArray(choices)||!choices.every(r=>typeof r?.classId==='string'&&typeof r.groupId==='string'&&Array.isArray(r.anyOf)&&r.anyOf.length>0&&r.anyOf.every(id=>typeof id==='string')))return []
  const minimum=f.minimumLevel??1;if(!Number.isSafeInteger(minimum)||minimum<1)return []
  return [{id:f.id.startsWith(ns+':')?f.id:ns+':'+f.id,minimumLevel:minimum,classRequirements:structuredClone(classes),classChoiceRequirements:structuredClone(choices)}]
 })
 return [...features,...subclassWaterBreathingPolicies(p,ns,definitions)]
}

// Finite data-only subclass passive policy. Every non-choice runtime predicate
// remains unsupported here; this does not grant a feature or trust request data.
function subclassWaterBreathingPolicies(p,ns,definitions){
 const rows=definitions?definitions.filter(d=>d?.kind==='subclass').map(d=>d.payload):p.content?.subclasses??p.legacy?.subclasses??p.subclasses
 if(!Array.isArray(rows))return []
 const qualify=id=>id.startsWith(ns+':')?id:ns+':'+id
 return rows.flatMap(s=>{
  if(!record(s)||typeof s.id!=='string'||typeof s.classId!=='string'||!Array.isArray(s.abilities))return []
  const subclassId=qualify(s.id)
  return s.abilities.flatMap(a=>{
   if(!record(a)||typeof a.id!=='string'||a.automation!=='full'||a.trigger?.kind!=='passive'||a.targeting?.kind!=='self'||a.mechanic?.kind!=='passive-defense'||a.mechanic.canBreatheWater!==true||!Number.isSafeInteger(a.level)||a.level<1||a.level>20)return []
   if(a.cost||a.requirements||a.duration||a.limits||(a.rolls?.length??0)>0||(a.choices?.length??0)>0||(a.effects?.length??0)>0||(a.activityEffects?.length??0)>0)return []
   const predicates=a.predicates??{}
   if(!record(predicates)||Object.keys(predicates).some(k=>k!=='subclassChoices'))return []
   const choices=predicates.subclassChoices??[]
   if(!Array.isArray(choices)||!choices.every(c=>record(c)&&typeof c.groupId==='string'&&typeof c.optionId==='string'&&Object.keys(c).every(k=>k==='groupId'||k==='optionId')))return []
   return [{id:qualify(s.id+'.'+a.id),sourceKind:'subclass-passive',subclassId,classId:s.classId,minimumLevel:a.level,classRequirements:[{classId:s.classId,minimumLevel:a.level}],classChoiceRequirements:choices.map(c=>({classId:s.classId,groupId:subclassId+'/'+c.groupId,anyOf:[c.optionId]}))}]
  })
 })
}
export function explicitCharacterCanBreatheWater(character,policies){
 if(!character)return false
 return (policies??[]).some(p=>(p.sourceKind==='subclass-passive'?(p.classId==='fighter'?character.dnd5eClassChoices?.fighter?.subclass:character.dnd5eClassChoices?.classes?.[p.classId]?.subclass)===p.subclassId:Array.isArray(character.dnd5ePluginFeatureIds)&&character.dnd5ePluginFeatureIds.includes(p.id))&&(p.sourceKind==='subclass-passive'||character.level>=p.minimumLevel)&&p.classRequirements.every(r=>{const level=readSupportedCoreCharacterClassLevel(character,r.classId);return level!==undefined&&level>=r.minimumLevel})&&p.classChoiceRequirements.every(r=>{const level=readSupportedCoreCharacterClassLevel(character,r.classId),selected=character.dnd5eClassChoices?.classes?.[r.classId]?.selections?.[r.groupId]??(r.classId==='fighter'?character.dnd5eClassChoices?.fighter?.extensionChoices?.[r.groupId]:undefined);return level>0&&Array.isArray(selected)&&r.anyOf.some(id=>selected.includes(id))}))
}

/** Base Constitution only, from verified Host-installed monster data. It grants
 * no water breathing, monster action, ownership or arbitrary token stat flag. */
export function explicitSummonedMonsterConstitutionsFromPackage(p){
 const ns=p?.manifest?.id;if(typeof ns!=='string'||p.manifest.apiVersion!==2||p.manifest.rulesetId!=='dnd5e-2014-srd-5.1')return []
 if(!((p.format==='dndstars5e-content'&&p.schemaVersion===2)||(p.format==='dndstars5e-unified-content'&&p.schemaVersion===1)||(p.format==='dndstars5e-declarative'&&p.schemaVersion===1)))return []
 const rows=p.format==='dndstars5e-unified-content'?p.definitions?.filter(d=>d?.kind==='monster').map(d=>d.payload):p.content?.monsters??p.legacy?.monsters??p.monsters
 if(!Array.isArray(rows))return []
 return rows.flatMap(m=>record(m)&&typeof m.id==='string'&&m.id.startsWith('room-monster:')&&m.source==='DM 自定义'&&record(m.abilities)&&Number.isSafeInteger(m.abilities.con)&&m.abilities.con>=1&&m.abilities.con<=30?[{pluginId:ns,monsterId:m.id,constitutionScore:m.abilities.con}]:[])
}
