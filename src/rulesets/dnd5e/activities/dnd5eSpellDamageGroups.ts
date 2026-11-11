import {getRegisteredDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {grantedDamageSource,type Dnd5eHeadlessCombatState} from '../headlessCombatEngine'
import type {Character} from '../../../types/character'
import type {Dnd5eSpellDamageDiceChoice} from '../spellDamageDieRerolls'
import type {Dnd5eActivityDefinitionV1,Dnd5eActivityOutcomeWhenV1} from './dnd5eActivityContracts'
import {dnd5eActivityOperationDamageTypeV1} from './dnd5eActivityExecutor'
import {collectDnd5eFormulaRollDeclarations,type Dnd5eFormulaRollResult} from './dnd5eFormula'
import type {Dnd5eSpellDamageDiceGroup} from '../spellDamageDieRerolls'
import type {Dnd5eDamageType} from '../damageTypes'
function branchSelected(when:Dnd5eActivityOutcomeWhenV1,choices:Readonly<Record<string,string>>|undefined):boolean{
 if(when.kind==='choice')return choices?.[when.choiceId]===when.optionId
 if(when.kind==='all')return when.conditions.every(condition=>branchSelected(condition,choices))
 if(when.kind==='predicate'&&when.predicate.kind==='choice')return choices?.[when.predicate.choiceId]===when.predicate.optionId
 return true
}
/** Spell damage classification from the selected installed recipe, including misses. */
export function dnd5eActivitySpellDamageGroups(input:{activity:Dnd5eActivityDefinitionV1;packageId?:string;choices?:Readonly<Record<string,string>>;rolls:Readonly<Record<string,Dnd5eFormulaRollResult>>;parentDamageType?:Dnd5eDamageType;collectGroups?:boolean}):{damageTypes:readonly Dnd5eDamageType[];groups:readonly (Dnd5eSpellDamageDiceGroup&{formulaRollId:string;damageSource?:'actor'|'grant-source'})[]}{
 const damageTypes=new Set<Dnd5eDamageType>(),groups=new Map<string,Dnd5eSpellDamageDiceGroup&{formulaRollId:string;damageSource?:'actor'|'grant-source'}>()
 if(input.activity.legacySource?.kind!=='spell')return{damageTypes:[],groups:[]}
 for(const outcome of input.activity.outcomes){if(!branchSelected(outcome.when,input.choices))continue
  for(const operation of outcome.operations){
   if(operation.kind==='create-persistent-area')for(const trigger of operation.triggers??[])if(trigger.damage)damageTypes.add(trigger.damage.type)
   if(operation.kind==='apply-effect'){
    const effect=input.activity.effects?.find(effect=>effect.id===operation.effectId);if(effect?.periodicDamage)damageTypes.add(effect.periodicDamage.type)
    const relatives=input.packageId?getRegisteredDnd5eActivityPackage(input.packageId)?.activities:[]
    for(const linked of relatives??[]){
     if(linked.id===input.activity.id||linked.legacySource?.kind!=='spell'||linked.legacySource.id!==input.activity.legacySource.id||!linked.requirements?.some(requirement=>requirement.kind==='active-effect'&&requirement.subject==='actor'&&requirement.present&&requirement.source==='self'&&requirement.effectId===operation.effectId))continue
     const linkedTypes=dnd5eActivitySpellDamageGroups({activity:linked,choices:input.choices,rolls:input.rolls,parentDamageType:input.parentDamageType,collectGroups:false}).damageTypes
     linkedTypes.forEach(type=>damageTypes.add(type))
    }
   }
   if(operation.kind!=='damage')continue
   const damageType=dnd5eActivityOperationDamageTypeV1(operation,input);damageTypes.add(damageType)
   if(input.collectGroups===false)continue
   for(const declaration of collectDnd5eFormulaRollDeclarations([operation.amount]))for(const[key,roll]of Object.entries(input.rolls)){
    if(key!==declaration.id&&!key.startsWith(declaration.id+':'))continue
    const group={id:key,formulaRollId:declaration.id,sides:declaration.sides,damageType,rolls:roll.values,damageSource:operation.damageSource}
    const previous=groups.get(key);if(previous&&(previous.damageType!==damageType||previous.sides!==declaration.sides||previous.damageSource!==operation.damageSource))throw Error('ambiguous shared spell damage dice')
    groups.set(key,group)
   }
  }
 }
 return{damageTypes:[...damageTypes],groups:[...groups.values()]}
}

/** Collect choices only after the Host has rolled a selected installed spell recipe. */
export async function collectDnd5eActivitySpellDamageDieChoices(input:{
 state:Dnd5eHeadlessCombatState;actorId:string;targetIds:readonly string[];packageId:string;activity:Dnd5eActivityDefinitionV1;
 choices?:Readonly<Record<string,string>>;rolls:Readonly<Record<string,Dnd5eFormulaRollResult>>;transactionId:string;
 charactersByCombatantId?:Readonly<Record<string,Character>>;choose?:Dnd5eSpellDamageDiceChoice;
}):Promise<Readonly<Record<string,Dnd5eFormulaRollResult>>>{
 const rolls={...input.rolls};if(!input.choose)return rolls
 const bearer=input.state.combatants[input.actorId];if(!bearer)return rolls
 for(const group of dnd5eActivitySpellDamageGroups({...input,rolls}).groups){
  if(rolls[group.id].spellDamageDieRerolls?.length)continue
  const targetId=input.targetIds.find(id=>group.id.endsWith(':'+id))??input.targetIds[0]
  const grant=group.damageSource==='grant-source'&&targetId?grantedDamageSource(input.state,bearer,input.packageId,input.activity.id,targetId):undefined
  const owner=group.damageSource==='grant-source'?(grant?.source.kind==='spell'?grant.actor:undefined):bearer
  if(!owner)continue
  const uses=await input.choose({transactionId:input.transactionId,actor:structuredClone(owner),character:input.charactersByCombatantId?.[owner.id],spellName:input.activity.name,group:structuredClone(group)})
  if(uses.length)rolls[group.id]={...rolls[group.id],spellDamageDieRerolls:uses.map(use=>({...use,rollId:group.formulaRollId}))}
 }
 return rolls
}
