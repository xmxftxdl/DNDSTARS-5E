import type { AttackResolution, D20RollMode } from '../contracts'
import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState, Dnd5eSpellcastingSavingThrowRoll, Dnd5eClassDamageDefinition, Dnd5eClassDamageRolls } from './headlessCombatEngine'
import { dnd5eCombatantClassLevel, dnd5eCombatantHasSubclass } from './headlessCombatPrimitives'
import { dnd5eIsIncapacitated, dnd5ePreventsAttackAdvantage } from './passiveDefenses'
import { dnd5eDeclarativeResourceKey, dnd5ePluginFeatureCurrentEnvelopeFullV1, dnd5ePluginResourceDefinition, registeredDnd5ePluginFeatures } from './pluginApi'
import { resolveDnd5eRollMode, type Dnd5eRollModeResolution } from './rollMode'

export interface MasterDuelistOption { featureId: string; resourceId: string }
export interface MasterDuelistMissFrame {
  id: string
  parentId: string
  actorId: string
  targetId: string
  originalRolls: readonly number[]
  originalMode: Dnd5eRollModeResolution
  rerollMode: Dnd5eRollModeResolution
  originalD20: number
  originalTotal: number
  armorClass: number
  options: readonly MasterDuelistOption[]
}
export interface MasterDuelistChoice { frameId: string; featureId: string; rolls: readonly number[] }
type Listener = (frame: Readonly<MasterDuelistMissFrame>, snapshot: Dnd5eHeadlessCombatState) => MasterDuelistChoice | undefined
interface NativeAttack {
  ordinal: number; state: Dnd5eHeadlessCombatState; actorId: string; targetId: string
  rolls: readonly number[]; mode: Dnd5eRollModeResolution; advantageAllowed: boolean; meleeAttack:boolean
  suppressed?:boolean; asked: boolean; acceptedFrameId?:string; damagePermitted?:boolean; damageGroup:number
}
interface Scope {
  parentId: string; listener: Listener; nextOrdinal: number; attacks: Map<string, NativeAttack>
  activityMisses:Set<string>;activityOverrides:Map<string,Dnd5eRollModeResolution>;activityDamage:Map<string,readonly number[]>;currentAttack?:NativeAttack; ports:MasterDuelistPorts; error?: unknown; interrupted?: boolean
}
let active: Scope | undefined
const issued = new WeakMap<object, { scope: Scope; attack: NativeAttack }>()

/** The wrapper is a Host execution port, never a field accepted from an action wire. */
export function withMasterDuelistCheckpoints<T>(parentId: string, listener: Listener, run: () => T, ports:MasterDuelistPorts={}): T {
  if (!parentId || parentId.length > 2000) throw Error('master-duelist:original-parent-required')
  const prior = active
  active = { parentId, listener, nextOrdinal: 0, attacks: new Map(),activityMisses:new Set(),activityOverrides:new Map(),activityDamage:new Map(),ports }
  const scope=active
  try { const result=run();if(scope.interrupted)throw scope.error;return result } finally { active = prior }
}

/** Called only at the actual native roll boundary, with pre-consumption source reasons. */
export function recordMasterDuelistOriginalAttack(input: {
  state: Dnd5eHeadlessCombatState; actorId: string; targetId: string; rolls: readonly number[]
  mode: Dnd5eRollModeResolution; advantageAllowed: boolean; meleeAttack:boolean
}): void {
  if (!active) return
  const canonical = resolveDnd5eRollMode({
    advantage: input.mode.advantageReasons.map(reason => ({active:true,reason})),
    disadvantage: input.mode.disadvantageReasons.map(reason => ({active:true,reason})),
  })
  if (canonical.mode !== input.mode.mode) throw Error('master-duelist:actual-mode-reasons-required')
  const row:NativeAttack = {
    ...input, rolls:[...input.rolls], mode:structuredClone(input.mode),
    ordinal:active.nextOrdinal++, asked:false,damageGroup:0,
  }
  active.attacks.set(input.actorId,row);active.currentAttack=row
}

/** Incoming native replacements change this very attack pool; they do not issue a new attack. */
export function recordMasterDuelistEffectivePool(actorId: string, rolls: readonly number[], mode: D20RollMode): void {
  const row = active?.currentAttack
  if (!row || row.actorId!==actorId) return
  if (row.mode.mode !== mode) throw Error('master-duelist:actual-pool-mode-mismatch')
  row.rolls = [...rolls]
}

export function masterDuelistOptions(state: Dnd5eHeadlessCombatState, actorId: string): MasterDuelistOption[] {
  const actor = state.combatants[actorId]
  if (!actor || actor.currentHp <= 0 || actor.deathSaves.dead || dnd5eIsIncapacitated(actor)) return []
  return registeredDnd5ePluginFeatures().flatMap(feature => {
    const ability = feature.declarativeAbility
    if (feature.automation !== 'full' || ability?.automation !== 'full' ||
      ability.mechanic?.kind !== 'missed-attack-advantage-reroll' ||
      !dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id) ||
      !actor.pluginFeatureIds.includes(feature.id) || !feature.sourceClassId || !feature.sourceSubclassId ||
      dnd5eCombatantClassLevel(actor,feature.sourceClassId) < (feature.minimumLevel ?? ability.level) ||
      !dnd5eCombatantHasSubclass(actor,feature.sourceClassId,feature.sourceSubclassId) ||
      ability.trigger.kind !== 'after-attack-miss' || (ability.cost?.economy ?? 'none') !== 'none' ||
      ability.cost?.resources?.length !== 1) return []
    const cost = ability.cost.resources[0]!
    if (cost.amount !== 1 || (cost.scope ?? 'plugin') !== 'plugin') return []
    const resourceId = dnd5eDeclarativeResourceKey(feature.ownerPluginId,cost)
    const definition = dnd5ePluginResourceDefinition(resourceId), current = actor.classResources[resourceId]
    const classLevel = definition ? dnd5eCombatantClassLevel(actor,definition.classId) : 0
    const maximum = typeof definition?.maximum === 'number' ? definition.maximum : definition?.maximum[Math.min(classLevel-1,definition.maximum.length-1)]
    if (!definition || definition.resetOn !== 'short-rest' || definition.restRecovery ||
      definition.restoreOnCombatStart || definition.combatStartRecovery ||
      maximum !== 1 || classLevel < (definition.minimumLevel ?? 1) || definition.classId !== feature.sourceClassId ||
      (definition.subclassId != null && !dnd5eCombatantHasSubclass(actor,definition.classId,definition.subclassId)) ||
      !current || current.max !== 1 || current.current < 1) return []
    return [{featureId:feature.id,resourceId}]
  })
}

/** Source reasons survive cancellation: normal caused by advantage+disadvantage remains normal. */
export function masterDuelistRerollMode(original: Dnd5eRollModeResolution, advantageAllowed: boolean): Dnd5eRollModeResolution {
  return resolveDnd5eRollMode({
    advantage: [
      ...original.advantageReasons.map(reason => ({active:advantageAllowed,reason})),
      {active:advantageAllowed,reason:'master-duelist-reroll'},
    ],
    disadvantage:original.disadvantageReasons.map(reason => ({active:true,reason})),
  })
}

export function visitMasterDuelistFinalMiss(input: {
  state: Dnd5eHeadlessCombatState
  actorId: string
  targetId: string
  attack: AttackResolution
  hit: boolean
  armorClass: number
  spendResource: (resourceId: string) => boolean
  events: Dnd5eCombatEvent[]
}): { rolls: readonly number[]; mode: Dnd5eRollModeResolution; frameId: string } | undefined {
  if (!active || input.hit) return undefined
  const options = masterDuelistOptions(input.state,input.actorId)
  if (!options.length) return undefined
  const row = active.currentAttack
  if (!row || row.state !== input.state || row.actorId !== input.actorId || row.targetId !== input.targetId) throw Error('master-duelist:actual-native-attack-required')
  if (row.asked||row.suppressed) return undefined
  const selected = row.mode.mode === 'advantage' ? Math.max(...row.rolls) :
    row.mode.mode === 'disadvantage' ? Math.min(...row.rolls) : row.rolls[0]
  if (selected !== input.attack.roll.d20 || row.rolls.some(value => !Number.isInteger(value) || value<1 || value>20)) {
    throw Error('master-duelist:actual-effective-pool-required')
  }
  row.asked = true
  const nextMode = masterDuelistRerollMode(row.mode,!dnd5ePreventsAttackAdvantage(input.state.combatants[input.targetId]!))
  const frame: MasterDuelistMissFrame = Object.freeze({
    id:JSON.stringify(['master-duelist',active.parentId,row.ordinal,input.actorId,input.targetId]),
    parentId:active.parentId,actorId:input.actorId,targetId:input.targetId,
    originalRolls:Object.freeze([...row.rolls]),originalMode:structuredClone(row.mode),
    rerollMode:structuredClone(nextMode),originalD20:input.attack.roll.d20,
    originalTotal:input.attack.roll.total,armorClass:input.armorClass,
    options:Object.freeze(options.map(option=>Object.freeze({...option}))),
  })
  issued.set(frame,{scope:active,attack:row})
  let choice: MasterDuelistChoice | undefined
  try { choice = active.listener(frame,structuredClone(input.state)) }
  catch(error) { active.error=error;active.interrupted=true;throw error }
  if (!choice) return undefined
  const proof = issued.get(frame)
  if (!proof || proof.scope !== active || proof.attack !== row || choice.frameId !== frame.id) throw Error('master-duelist:current-issued-miss-required')
  const option = masterDuelistOptions(input.state,input.actorId).find(option=>option.featureId===choice!.featureId)
  if (!option) throw Error('master-duelist:current-owned-source-required')
  const count = nextMode.mode === 'normal' ? 1 : 2
  if (choice.rolls.length !== count || choice.rolls.some(value=>!Number.isInteger(value)||value<1||value>20)) throw Error('master-duelist:new-whole-pool-required')
  if (!input.spendResource(option.resourceId)) throw Error('master-duelist:resource-unavailable')
  input.events.push({type:'class-state-changed',actorId:input.actorId,stateKey:'master-duelist:'+choice.featureId,active:true})
  row.rolls=[...choice.rolls];row.mode=structuredClone(nextMode);row.acceptedFrameId=frame.id
  return {rolls:[...choice.rolls],mode:nextMode,frameId:frame.id}
}

export function rethrowMasterDuelistInterruption(): void {
  if (active?.interrupted) throw active.error
}

export interface MasterDuelistDamageRequest {
  id: string; frameId: string; actorId: string; targetId: string
  count: number; sides: number; existingRolls: readonly number[]; critical: boolean
}
export interface MasterDuelistDefenseChoice { shieldSpellReaction?: boolean; shieldSpellcastingSavingThrows?:readonly Dnd5eSpellcastingSavingThrowRoll[] }
export interface MasterDuelistDefenseRequest {readonly frameId:string;readonly actorId:string;readonly targetId:string;readonly attack:AttackResolution;readonly armorClass:number;readonly shieldAvailable:boolean}
export interface MasterDuelistPorts {
  damage?: (request: Readonly<MasterDuelistDamageRequest>) => readonly number[]
  defense?: (request: Readonly<MasterDuelistDefenseRequest>, snapshot:Dnd5eHeadlessCombatState) => MasterDuelistDefenseChoice
}

/** Nested native attacks restore the exact enclosing attack, including its late damage role. */
export function withMasterDuelistNativeAttackScope<T>(run:()=>T):T {
  if(!active)return run()
  const scope=active,previous=scope.currentAttack,overrides=scope.activityOverrides,misses=scope.activityMisses,damage=scope.activityDamage
  scope.currentAttack=undefined;scope.activityOverrides=new Map();scope.activityMisses=new Set();scope.activityDamage=new Map()
  try{return run()}finally{scope.currentAttack=previous;scope.activityOverrides=overrides;scope.activityMisses=misses;scope.activityDamage=damage}
}

export function masterDuelistNativeModeAfterOverride(original:Dnd5eRollModeResolution,mode:D20RollMode):Dnd5eRollModeResolution {
  if(original.mode===mode)return structuredClone(original)
  return resolveDnd5eRollMode({
    advantage:mode==='advantage'?(original.advantageReasons.length?original.advantageReasons:['native-mode-override']).map(reason=>({active:true,reason})):[],
    disadvantage:mode==='disadvantage'?(original.disadvantageReasons.length?original.disadvantageReasons:['native-mode-override']).map(reason=>({active:true,reason})):[],
  })
}

export function requestMasterDuelistNativeDefense(input:{
  frameId:string;actorId:string;targetId:string;attack:AttackResolution;armorClass:number;shieldAvailable:boolean;state:Dnd5eHeadlessCombatState
}):MasterDuelistDefenseChoice {
  const row=active?.currentAttack
  if(!active||row?.acceptedFrameId!==input.frameId||row.actorId!==input.actorId||row.targetId!==input.targetId)throw Error('master-duelist:accepted-native-reroll-required')
  try{
    const choice=active.ports.defense?.(Object.freeze({frameId:input.frameId,actorId:input.actorId,targetId:input.targetId,attack:structuredClone(input.attack),armorClass:input.armorClass,shieldAvailable:input.shieldAvailable}),structuredClone(input.state))??{}
    if(choice.shieldSpellReaction!==undefined&&typeof choice.shieldSpellReaction!=='boolean')throw Error('master-duelist:native-defense-choice-invalid')
     if(choice.shieldSpellReaction===true&&!input.shieldAvailable)throw Error('master-duelist:native-defense-unavailable')
     if(choice.shieldSpellcastingSavingThrows!==undefined&&(!Array.isArray(choice.shieldSpellcastingSavingThrows)||choice.shieldSpellReaction!==true))throw Error('master-duelist:native-defense-save-choice-invalid')
     return choice
  }catch(error){active.error=error;active.interrupted=true;throw error}
}

export function markMasterDuelistNativeDamage(frameId:string,hit:boolean):void {
  const row=active?.currentAttack
  if(!row||row.acceptedFrameId!==frameId)throw Error('master-duelist:accepted-native-reroll-required')
  row.damagePermitted=hit;row.damageGroup=0
}

/** Only a genuinely accepted native miss-to-hit can request the real missing damage dice. */
export function supplementMasterDuelistNativeDamage<T extends import('../contracts').DamageRollInput>(input:T):T {
  const row=active?.currentAttack
  if(!active||!row?.damagePermitted||!row.acceptedFrameId)return input
  const ordinal=row.damageGroup++,needed=input.count*(input.critical?2:1)
  if(input.rolls.length>=needed||input.count<1)return input
  if(!Number.isSafeInteger(input.count)||input.count<1||input.count>1000||!Number.isSafeInteger(input.sides)||input.sides<2||input.sides>10000)throw Error('master-duelist:native-damage-profile-invalid')
  const request:MasterDuelistDamageRequest={id:JSON.stringify(['master-duelist-damage',row.acceptedFrameId,ordinal,input.count,input.sides,input.critical===true,input.rolls]),frameId:row.acceptedFrameId,actorId:row.actorId,targetId:row.targetId,count:needed-input.rolls.length,sides:input.sides,existingRolls:Object.freeze([...input.rolls]),critical:input.critical===true}
  try{
    if(!active.ports.damage)throw Error('master-duelist:actual-new-damage-required')
    const extra=active.ports.damage(Object.freeze(request))
    if(extra.length!==request.count||extra.some(value=>!Number.isInteger(value)||value<1||value>input.sides))throw Error('master-duelist:actual-new-damage-invalid')
    return{...input,rolls:[...input.rolls,...extra]}
  }catch(error){active.error=error;active.interrupted=true;throw error}
}

export function masterDuelistHasNativeAttack(state:Dnd5eHeadlessCombatState,actorId:string,targetId:string):boolean{const row=active?.currentAttack;return !!row&&row.state===state&&row.actorId===actorId&&row.targetId===targetId}
export function masterDuelistNativeMeleeAttack():boolean{return active?.currentAttack?.meleeAttack===true}

export function suppressMasterDuelistNativeAttack():void{if(active?.currentAttack)active.currentAttack.suppressed=true}

const activitySources=new WeakMap<object,Dnd5eRollModeResolution>()
export function recordMasterDuelistActivityMode(check:object,mode:Dnd5eRollModeResolution):void{if(active)activitySources.set(check,structuredClone(mode))}
export function masterDuelistActivityModeSource(check:object):Dnd5eRollModeResolution|undefined{return activitySources.get(check)}
export function masterDuelistActivityOverride(key:string):Dnd5eRollModeResolution|undefined{return active?.activityOverrides.get(key)}
export function bindMasterDuelistActivityReplacement(key:string,hit:boolean):void{
 const row=active?.currentAttack
 if(active&&row?.acceptedFrameId){active.activityOverrides.set(key,structuredClone(row.mode));if(!hit)active.activityMisses.add(key)}
}
export function supplementMasterDuelistActivityDamage(input:{targetId:string;rollId:string;count:number;sides:number;rolls:readonly number[];critical:boolean}):readonly number[]|undefined{
 if(!active)return
 const key=JSON.stringify([input.targetId,input.rollId,input.count,input.sides,input.critical])
 const cached=active.activityDamage.get(key)
 if(cached)return cached
 const row=active.currentAttack
 if(!row?.damagePermitted||row.targetId!==input.targetId||!row.acceptedFrameId)return
 const result=supplementMasterDuelistNativeDamage(input)
 if(result.rolls.length===input.rolls.length)return
 const values=Object.freeze([...result.rolls]);active.activityDamage.set(key,values);return values
}

export function masterDuelistActivityForcedMiss(key:string):boolean{return active?.activityMisses.has(key)===true}
export function masterDuelistCheckpointsActive():boolean{return !!active}

export function masterDuelistHasActivityReplacement():boolean{return (active?.activityOverrides.size??0)>0}

/** Real native post-hit definitions determine missing class pools; no action wire grants this permission. */
export function supplementMasterDuelistNativeClassDamage(definitions:readonly Dnd5eClassDamageDefinition[], supplied:readonly Dnd5eClassDamageRolls[], critical:boolean):readonly Dnd5eClassDamageRolls[]{
 const row=active?.currentAttack
 if(!active||!row?.damagePermitted||!row.acceptedFrameId)return supplied
 const result=[...supplied]
 for(const definition of definitions){
  const id=definition.rollId??definition.source
  if(result.some(entry=>(entry.rollId??entry.source)===id))continue
  const input={count:definition.count,sides:definition.sides,bonus:definition.bonus??0,critical:critical&&definition.doubleOnCritical,rolls:[] as readonly number[]}
  const resolved=supplementMasterDuelistNativeDamage(input)
  result.push({source:definition.source,...(definition.rollId?{rollId:definition.rollId}:{}),rolls:resolved.rolls})
 }
 return result
}
