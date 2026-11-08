import{normalizeDnd5eActiveEffects,dnd5eOpposedHostRollModes,dnd5eHeldBardicInspirationDie,dnd5eDarkOnesOwnLuckAvailable,dnd5eD20ChoiceRerollFeaturesForCharacter,dnd5eEnemyD20ModifierFeaturesForCharacter,dnd5ePostD20AdjustmentFeaturesForCharacter}from'../../application/combat/dnd5eCombatRules'
import{DND5E_CORE_INSPIRATION_RESOURCE_KEY}from'../../lib/d20InterruptPolicy'
import{collectBountifulActivityOriginals}from'./bountifulActivityOriginalCollector'
import{getRegisteredDnd5eActivity}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{createBountifulActivityLocalAuthority,resolveBountifulActivityOriginalForNormalAck}from'../../rulesets/dnd5e/bountifulLuckNormalAck'
import{beginDnd5eBountifulActivityCharacterPublication,type Dnd5eOpportunityCharacterPublicationScope}from'../../rulesets/dnd5e/opportunityCharacterPublication'
import{BountifulOriginalParentPending}from'../../rulesets/dnd5e/bountifulLuckPersistentRoomDriver'
import{projectDnd5eCombatApplicationStoreState}from'./combatApplicationStoreProjection'
import type{applyDnd5eCombatResultApplication}from'./commitDnd5eCombatResult'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
type Collector=Parameters<typeof collectBountifulActivityOriginals>[0]
type Source=Collector['source']
type Effect=NonNullable<Source['prepared']['state']['combatants'][string]['classState']['activeEffects']>[number]
/** Routing only. Preserve the exact source for the Native/book authorities.
 * Defined mechanics must be pure D20 ability modes; schema-normalized empty
 * slots are recognized without admitting unknown fields or additional dice. */
function hasOnlyActivityAbilityModes(effect:Effect){
 const metadata=new Set(['schemaVersion','id','definitionId','label','description','tags','kind','source','appliedAt','appliedRound','appliedTurnKey','duration','stackingKey','stackingPolicy','visibility','modifiers','targetId']),modeKeys=new Set(['abilityCheckAdvantages','abilityCheckDisadvantages','savingThrowAdvantages','savingThrowDisadvantages']),abilities=new Set(['str','dex','con','int','wis','cha']),modifiers=effect.modifiers as Record<string,unknown>|undefined
 // Query a metadata/mode-only projection, never the source passed to Native.
 // The normalizer retains some unknown own keys, so derive its standard empty
 // slots from this bounded projection before comparing every original key.
 const basis={...Object.fromEntries(Object.entries(effect).filter(([key])=>metadata.has(key))),modifiers:Object.fromEntries(Object.entries(modifiers??{}).filter(([key])=>modeKeys.has(key)))},normalized=normalizeDnd5eActiveEffects([basis]);if(normalized.length!==1)return false
 // Character authority projection additionally preserves these three named
 // empty schema slots; a defined value still represents another mechanic.
 const known=new Set([...Object.keys(normalized[0]),'suspendedBy','legacyCondition','maximizedDamageRoll']),knownModifiers=new Set(Object.keys(normalized[0].modifiers??{}))
 return effect.schemaVersion===1&&(effect.kind==='buff'||effect.kind==='debuff')&&Object.entries(effect).every(([key,value])=>metadata.has(key)||known.has(key)&&value===undefined)&&!!modifiers&&Object.entries(modifiers).some(([key,value])=>key.startsWith('abilityCheck')&&Array.isArray(value)&&value.length>0)&&Object.entries(modifiers).every(([key,value])=>knownModifiers.has(key)&&(value===undefined||modeKeys.has(key)&&Array.isArray(value)&&value.length>0&&value.every(ability=>typeof ability==='string'&&abilities.has(ability))))
}
type LocalInput=Parameters<typeof createBountifulActivityLocalAuthority>[0]
/** First bounded actual Page consumer. Other activities and Native Lucky/extra
 * effect consumers keep their existing entry until their own true producers are
 * connected; this gate is routing only, never a physical or result grant. */
export function canBeginBountifulActivityHoldEntry(source:Source){
 const p=source.prepared,definition=getRegisteredDnd5eActivity(p.headlessAction.pluginId,p.headlessAction.actionId),payload=p.headlessAction.payload
 if(definition?.id!=='spell:telekinesis:control'||!payload||typeof payload!=='object'||Array.isArray(payload))return false
 const choices=payload.activityChoices;if(!choices||typeof choices!=='object'||Array.isArray(choices)||choices.movement!=='hold')return false
 // Preserve the old richer D20 consumer when another physical/choice source
 // is available. The value below is only a conservative availability query;
 // it is never supplied to a Native run, input book or physical request.
 const rollers=[p.actorToken,...p.targetTokens];if(rollers.some(token=>{const actor=p.state.combatants[token.id],character=p.characters.find(c=>c.id===token.characterId);return!actor||!character||(dnd5eHeldBardicInspirationDie(actor)??0)>0||dnd5eDarkOnesOwnLuckAvailable(actor)||(character.classResources?.[DND5E_CORE_INSPIRATION_RESOURCE_KEY]?.current??0)>0||dnd5eD20ChoiceRerollFeaturesForCharacter(character,'ability-check','self-roll',1,{rollMode:'normal'}).length>0}))return false
 if(p.characters.filter(c=>p.map.tokens.some(token=>token.characterId===c.id)).some(c=>dnd5eEnemyD20ModifierFeaturesForCharacter(c).some(feature=>String(feature.declarativeAbility?.mechanic?.kind)!=='ally-natural-one')||dnd5ePostD20AdjustmentFeaturesForCharacter(c).some(feature=>{const m=feature.declarativeAbility?.mechanic;return m?.kind==='post-d20-adjustment'&&m.rollKinds.includes('ability-check')})))return false
 const caster=p.state.combatants[p.actorToken.id],check=definition.checks?.length===1?definition.checks[0]:undefined
 // Each actor's Own stage is issued by the actual Native session and bound
 // independently to its protected original pool, prefix and actor controller.
 // This query only routes the already supported opposed D20 modes.
 const casterOwn=caster?.racialRules?.halflingLucky===true&&check?.kind==='opposed-ability-check'&&p.targetTokens.length===1&&p.targetTokens.every(token=>{const target=p.state.combatants[token.id];return!!target&&['normal','advantage','disadvantage'].includes(dnd5eOpposedHostRollModes(check,caster,target).source)})
 const targetOwn=check?.kind==='opposed-ability-check'&&p.targetTokens.length===1&&p.targetTokens.every(token=>{const target=p.state.combatants[token.id],modes=target&&dnd5eOpposedHostRollModes(check,caster,target);return target?.racialRules?.halflingLucky===true&&!!modes&&['normal','advantage','disadvantage'].includes(modes.source)&&['normal','advantage','disadvantage'].includes(modes.target)})
 return[p.actorToken,...p.targetTokens].every(token=>!!token.characterId&&(p.state.combatants[token.id]?.racialRules?.halflingLucky!==true||token.id===p.actorToken.id&&casterOwn||token.id!==p.actorToken.id&&targetOwn)&&(p.state.combatants[token.id]?.classState.activeEffects??[]).every(effect=>effect.grantedActivities?.includes('spell:telekinesis:control')||effect.tags?.includes('telekinesis-controlled')||hasOnlyActivityAbilityModes(effect)))
}
export async function beginBountifulActivityHoldEntry(input:Collector&{action:SharedPlayerActionState;readProjection:LocalInput['readProjection'];readAnchors:LocalInput['readAnchors'];onPublication:(scope:Dnd5eOpportunityCharacterPublicationScope)=>void;applyReactions:(values:Readonly<Record<string,number>>)=>void}){
 if(!canBeginBountifulActivityHoldEntry(input.source))return undefined
 const local=createBountifulActivityLocalAuthority(input),identity={parentId:input.action.id,mapId:input.source.prepared.map.id,combatId:input.source.prepared.state.combatId}
 let restore=false
 try{await input.gateway.loadBountifulActivityOriginalSource(identity);restore=true}catch(error){if(!(error instanceof Error)||error.message!=='activity-original:current-private-book-required')throw error}
 // A stale existing book cannot be reset by the initial path: the unchanged
 // Node register contract rejects its scope/T1 before any physical callback.
 const collected=await collectBountifulActivityOriginals({...input,restore})
 if(collected.status!=='originals-collected'){await collected.dispose();throw new BountifulOriginalParentPending(input.action.id,0)}
 const source=collected.source,initial=cloneDnd5eHostTransactionInput(input.readProjection());let resolved:Awaited<ReturnType<typeof resolveBountifulActivityOriginalForNormalAck>>|undefined,applied=false
 return{hasOriginal:!!collected.qualification,get source(){return cloneDnd5eHostTransactionInput(source)},async resolve(options:Parameters<typeof resolveBountifulActivityOriginalForNormalAck>[0]['options']){
  if(resolved||!collected.qualification||!collected.continuation)throw Error('activity-hold-entry:actual-original-completion-required')
  resolved=await resolveBountifulActivityOriginalForNormalAck({action:input.action,source,activityOriginalQualification:collected.qualification,activityOriginalContinuation:collected.continuation,options:{...options,authorityUnchanged:local.authorityUnchanged}},input.gateway)
  await collected.dispose();return cloneDnd5eHostTransactionInput(resolved)
 },apply(applicationInput:Parameters<typeof applyDnd5eCombatResultApplication>[0],apply:(value:Parameters<typeof applyDnd5eCombatResultApplication>[0])=>ReturnType<typeof applyDnd5eCombatResultApplication>){
  if(applied||!resolved?.application)throw Error('activity-hold-entry:actual-native-before-application-required')
  let receipt:ReturnType<typeof applyDnd5eCombatResultApplication>|undefined
  local.applyNative((application,reactions)=>{
   const native=projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application}),proposed=projectDnd5eCombatApplicationStoreState({map:initial.map,characters:initial.characters,application:applicationInput.application})
   if(JSON.stringify(native)!==JSON.stringify(proposed))throw Error('activity-hold-entry:unissued-room-postprocessing')
   const scope=beginDnd5eBountifulActivityCharacterPublication(local);input.onPublication(scope)
   receipt=apply({...applicationInput,application})
   input.applyReactions(reactions)
   const current=input.readProjection();if(Object.entries(reactions).some(([id,value])=>current.reactionEconomies[id]!==value))throw Error('activity-hold-entry:actual-reaction-projection-required')
  })
  if(!receipt)throw Error('activity-hold-entry:actual-store-application-required');applied=true;return receipt
 },dispose:()=>collected.dispose()}
}
