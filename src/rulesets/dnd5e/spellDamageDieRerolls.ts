import type {Dnd5eDamageType} from './damageTypes'
import type {Dnd5eCombatant} from './headlessCombatEngine'
import {dnd5ePluginFeatureDefinition} from './pluginApi'

/** The original group stays immutable; only the selected die positions change. */
export interface Dnd5eSpellDamageDieRerollUse {
  featureId: string
  rollId: string
  dieIndex: number
  reroll: number
}

export interface Dnd5eSpellDamageDiceGroup {
  id: string
  sides: number
  damageType: Dnd5eDamageType
  rolls: readonly number[]
}

export function dnd5eSpellDamageDieRerollRules(actor: Pick<Dnd5eCombatant,'pluginFeatureIds'>) {
  return actor.pluginFeatureIds.flatMap(featureId=>{
    const feature=dnd5ePluginFeatureDefinition(featureId)
    const rule=feature?.declarativeAbility?.mechanic
    return feature?.automation==='full'&&feature.declarativeAbility?.automation==='full'&&rule?.kind==='spell-damage-dice-reroll'
      ? [{featureId,rule}] : []
  })
}

/** Called only with Host-derived spell damage groups, never ordinary damage dice. */
export function applyDnd5eSpellDamageDieRerolls(
  actor:Pick<Dnd5eCombatant,'pluginFeatureIds'>,
  groups:readonly Dnd5eSpellDamageDiceGroup[],
  uses:readonly Dnd5eSpellDamageDieRerollUse[]|undefined,
):ReadonlyMap<string,readonly number[]> {
  const result=new Map<string,number[]>()
  for(const group of groups){
    if(result.has(group.id)||!Number.isInteger(group.sides)||group.sides<2||group.sides>100||
      group.rolls.some(value=>!Number.isInteger(value)||value<1||value>group.sides))throw Error('spell-damage-original-dice-invalid')
    result.set(group.id,[...group.rolls])
  }
  const rules=dnd5eSpellDamageDieRerollRules(actor),seen=new Set<string>()
  for(const use of uses??[]){
    const group=groups.find(group=>group.id===use.rollId)
    const owned=rules.find(rule=>rule.featureId===use.featureId)
    const key=JSON.stringify([use.rollId,use.dieIndex])
    if(!group||!owned||seen.has(key)||!Number.isInteger(use.dieIndex)||use.dieIndex<0||
      use.dieIndex>=group.rolls.length||!owned.rule.damageTypes.includes(group.damageType)||
      !owned.rule.originalFaces.includes(group.rolls[use.dieIndex])||
      !Number.isInteger(use.reroll)||use.reroll<1||use.reroll>group.sides)throw Error('spell-damage-die-reroll-invalid')
    seen.add(key)
    result.get(group.id)![use.dieIndex]=use.reroll
  }
  return result
}

/** Host UI collection retains every group/index; new one faces are never offered twice. */
export async function collectDnd5eSpellDamageDieRerolls(input:{
 actor:Pick<Dnd5eCombatant,'pluginFeatureIds'>;groups:readonly Dnd5eSpellDamageDiceGroup[];
 choose:(request:{featureId:string;group:Dnd5eSpellDamageDiceGroup;dieIndex:number})=>Promise<boolean>;
 roll:(request:{featureId:string;group:Dnd5eSpellDamageDiceGroup;dieIndex:number})=>Promise<number>;
}):Promise<readonly Dnd5eSpellDamageDieRerollUse[]>{
 const rules=dnd5eSpellDamageDieRerollRules(input.actor),uses:Dnd5eSpellDamageDieRerollUse[]=[]
 for(const group of input.groups)for(const[dieIndex,face]of group.rolls.entries()){
  const owned=rules.find(entry=>entry.rule.damageTypes.includes(group.damageType)&&entry.rule.originalFaces.includes(face));if(!owned)continue
  const request={featureId:owned.featureId,group:structuredClone(group),dieIndex}
  if(await input.choose(request))uses.push({featureId:owned.featureId,rollId:group.id,dieIndex,reroll:await input.roll(request)})
 }
 applyDnd5eSpellDamageDieRerolls(input.actor,input.groups,uses)
 return uses
}

export type Dnd5eSpellDamageDiceChoice=(request:{transactionId:string;actor:Dnd5eCombatant;character?:import('../../types/character').Character;spellName:string;group:Dnd5eSpellDamageDiceGroup})=>Promise<readonly Dnd5eSpellDamageDieRerollUse[]>

/** The existing area coordinator returns the same original array for one simultaneous wave. */
export function collectDnd5eSpellDamageDieRerollsForSharedPool(
 cache:WeakMap<readonly number[],Promise<readonly Dnd5eSpellDamageDieRerollUse[]>>,
 originalPool:readonly number[],collect:()=>Promise<readonly Dnd5eSpellDamageDieRerollUse[]>,
):Promise<readonly Dnd5eSpellDamageDieRerollUse[]>{
 const existing=cache.get(originalPool)
 if(existing)return existing
 const pending=collect();cache.set(originalPool,pending);return pending
}
