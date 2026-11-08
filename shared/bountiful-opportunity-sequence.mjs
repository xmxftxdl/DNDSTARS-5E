/** Data-only reader for a mechanically derived whole-move missing-raw fact.
 * It never evaluates graph nodes or creates a native client capability. */
export function bountifulOpportunitySequenceSourceFacts(wire){try{
 const object=ref=>{const node=wire.nodes[ref?.ref];if(node?.kind!=='object')throw Error('object');return Object.fromEntries(node.entries)}
 const plain=(value,depth=0)=>{if(depth>100)throw Error('depth');if(value===undefined||value===null||['string','number','boolean'].includes(typeof value))return value;if(value?.undefined===true)return undefined;const node=wire.nodes[value?.ref];if(node?.kind==='array')return node.items.map(item=>plain(item,depth+1));if(node?.kind==='object')return Object.fromEntries(node.entries.map(([key,item])=>[key,plain(item,depth+1)]));throw Error('non-json-fact')}
 const source=object(wire.root),prepared=object(source.prepared),input=object(prepared.input),initial=object(prepared.initial),state=object(prepared.state),combatants=object(state.combatants)
 return{action:plain(prepared.action),map:plain(prepared.map),characters:plain(prepared.characters),input:plain(prepared.input),initialAction:plain(initial.action),initialMap:plain(initial.map),initialCharacters:plain(initial.characters),pending:plain(source.pending),preceding:plain(source.preceding),turns:Object.fromEntries(Object.entries(combatants).map(([id,value])=>[id,plain(object(value).turn)])),combatId:plain(state.combatId),round:plain(state.round),initiativeIndex:plain(state.initiativeIndex),initiativeOrder:plain(state.initiativeOrder),initiativeSlotIds:plain(state.initiativeSlotIds),firstHostNow:plain(input.firstHostNow)}
 }catch{return null}}
export function bountifulOpportunitySequenceContinuationFacts(wire){try{
 const object=ref=>{const node=wire.nodes[ref?.ref];if(node?.kind!=='object')throw Error('object');return Object.fromEntries(node.entries)}
 const plain=(value,depth=0)=>{if(depth>100)throw Error('depth');if(value===undefined||value===null||['string','number','boolean'].includes(typeof value))return value;if(value?.undefined===true)return undefined;const node=wire.nodes[value?.ref];if(node?.kind==='array')return node.items.map(item=>plain(item,depth+1));if(node?.kind==='object')return Object.fromEntries(node.entries.map(([key,item])=>[key,plain(item,depth+1)]));throw Error('non-json-fact')}
 const source=object(wire.root)
 if(Object.keys(source).some(key=>!['prepared','transactionId','attacks','hostOriginalOpportunityRolls'].includes(key)))return null
 return{transactionId:plain(source.transactionId),attacks:plain(source.attacks),rawBook:plain(source.hostOriginalOpportunityRolls)}
 }catch{return null}}

const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const keys=(v,allowed)=>record(v)&&Object.keys(v).every(key=>allowed.includes(key))
const plainData=(v,depth=0)=>depth<=32&&(v===undefined||v===null||typeof v==='boolean'||typeof v==='string'&&v.length<=4000||typeof v==='number'&&Number.isFinite(v)||Array.isArray(v)&&v.length<=1024&&v.every(x=>plainData(x,depth+1))||record(v)&&Object.keys(v).length<=256&&Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype','prepared','state'].includes(k)&&plainData(x,depth+1)))
const attackFields=['coverAttackRedirect','d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','bardicInspirationRoll','strokeOfLuck','cuttingWords','cuttingWordsDamage','postD20Adjustment','shieldSpellReaction','shieldSpellcastingSavingThrows','uncannyDodge','tranquilitySave','hurlThroughHellDamageRolls','standAgainstTide','damageRolls','savageAttacksRoll','wholeWeaponDamageReroll','classDamageRolls','inventoryEffectRolls','airborneFallDamageRollsByCombatantId','attackDecoyRolls','areaAttackAdvantageReaction','disadvantageNegationChoice']
const text=v=>typeof v==='string'&&v.length>0&&v.length<=2000,die=(v,sides=1000)=>Number.isInteger(v)&&v>=1&&v<=sides,rolls=v=>Array.isArray(v)&&v.length<=1024&&v.every(n=>die(n)),saveFields=['d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','rerollResourceKey','rerollD20','rerollD20Second','bardicInspirationRoll','darkOnesOwnLuckRoll']
const saveRoll=v=>keys(v,saveFields)&&die(v.d20,20)&&['d20Second','halflingLuckyD20','halflingLuckyD20Second','rerollD20','rerollD20Second'].every(k=>v[k]===undefined||die(v[k],20))&&['blessRoll','baneRoll','bardicInspirationRoll','darkOnesOwnLuckRoll'].every(k=>v[k]===undefined||die(v[k]))&&(v.rerollResourceKey===undefined||text(v.rerollResourceKey))
const cutting=v=>keys(v,['bardId','roll','distanceFeet'])&&text(v.bardId)&&die(v.roll)&&Number.isFinite(v.distanceFeet)&&v.distanceFeet>=0
const classRolls=v=>Array.isArray(v)&&v.every(row=>keys(row,['source','rollId','rolls'])&&text(row.source)&&(row.rollId===undefined||text(row.rollId))&&rolls(row.rolls))
/** Only concrete native AttackInput fields can cross this protocol. In
 * particular no caller state, prepared operation or execution metadata does. */
export function validBountifulOpportunityCollectorAttack(attack){
 if(record(attack)&&Object.keys(attack).length===1&&attack.reactionDecision==='decline')return true
 if(!keys(attack,attackFields)||!plainData(attack)||!Number.isInteger(attack.d20)||attack.d20<1||attack.d20>20||!Array.isArray(attack.damageRolls)||attack.damageRolls.some(v=>!Number.isInteger(v)||v<1))return false
 for(const key of['d20Second','halflingLuckyD20','halflingLuckyD20Second'])if(attack[key]!==undefined&&(!Number.isInteger(attack[key])||attack[key]<1||attack[key]>20))return false
 for(const key of['strokeOfLuck','shieldSpellReaction','uncannyDodge'])if(attack[key]!==undefined&&typeof attack[key]!=='boolean')return false
 for(const key of['blessRoll','baneRoll','bardicInspirationRoll','savageAttacksRoll'])if(attack[key]!==undefined&&(!Number.isInteger(attack[key])||attack[key]<1))return false
 if(attack.coverAttackRedirect!==undefined&&(!keys(attack.coverAttackRedirect,['featureId','originalTargetId','replacementTargetId'])||Object.keys(attack.coverAttackRedirect).length!==3||!Object.values(attack.coverAttackRedirect).every(text)))return false
 if(attack.tranquilitySave!==undefined&&!saveRoll(attack.tranquilitySave))return false
 if(attack.areaAttackAdvantageReaction!==undefined&&(!keys(attack.areaAttackAdvantageReaction,['areaId','sourceId'])||!text(attack.areaAttackAdvantageReaction.areaId)||!text(attack.areaAttackAdvantageReaction.sourceId)))return false
 if(attack.disadvantageNegationChoice!==undefined&&(!keys(attack.disadvantageNegationChoice,['featureId','rollId','transactionId'])||!Object.values(attack.disadvantageNegationChoice).every(text)||Object.keys(attack.disadvantageNegationChoice).length!==3))return false
 for(const key of['cuttingWords','cuttingWordsDamage'])if(attack[key]!==undefined&&!cutting(attack[key]))return false
 if(attack.postD20Adjustment!==undefined&&(!keys(attack.postD20Adjustment,['sourceId','featureId','direction','roll'])||!text(attack.postD20Adjustment.sourceId)||!text(attack.postD20Adjustment.featureId)||!['add','subtract'].includes(attack.postD20Adjustment.direction)||!die(attack.postD20Adjustment.roll)))return false
 if(attack.wholeWeaponDamageReroll!==undefined&&(!keys(attack.wholeWeaponDamageReroll,['originalRolls','rerolledRolls','selection'])||!rolls(attack.wholeWeaponDamageReroll.originalRolls)||!rolls(attack.wholeWeaponDamageReroll.rerolledRolls)||!['original','rerolled'].includes(attack.wholeWeaponDamageReroll.selection)))return false
 if(attack.classDamageRolls!==undefined&&!classRolls(attack.classDamageRolls))return false
 for(const key of['inventoryEffectRolls','airborneFallDamageRollsByCombatantId'])if(attack[key]!==undefined&&(!record(attack[key])||!Object.entries(attack[key]).every(([id,values])=>text(id)&&rolls(values))))return false
 if(attack.hurlThroughHellDamageRolls!==undefined&&!rolls(attack.hurlThroughHellDamageRolls))return false
 if(attack.attackDecoyRolls!==undefined&&(!Array.isArray(attack.attackDecoyRolls)||!attack.attackDecoyRolls.every(row=>keys(row,['effectId','redirectD20','occurrenceId'])&&text(row.effectId)&&text(row.occurrenceId)&&die(row.redirectD20,20))))return false
 if(attack.standAgainstTide!==undefined){const v=attack.standAgainstTide;if(!keys(v,['shieldSpellcastingSavingThrows','featureId','targetId','distanceFeet','d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','bardicInspirationRoll','cuttingWords','cuttingWordsDamage','strokeOfLuck','mode','areaAttackAdvantageReaction','protectionReactionActorId','shieldSpellReaction','uncannyDodge','tranquilitySave','hurlThroughHellDamageRolls','damageRolls','classDamageRolls','openingAttackSavingThrow','attackAttemptWardSaves'])||!text(v.targetId)||!Number.isFinite(v.distanceFeet)||v.distanceFeet<0||!die(v.d20,20)||!Array.isArray(v.damageRolls)||!v.damageRolls.every(rolls)||v.mode!==undefined&&!['normal','advantage','disadvantage'].includes(v.mode))return false}
 return true
}
export function bountifulOpportunityCollectorContinuationFacts(wire){
 const facts=bountifulOpportunitySequenceContinuationFacts(wire)
 return facts&&text(facts.transactionId)&&record(facts.attacks)&&Object.keys(facts.attacks).length<=128&&Object.entries(facts.attacks).every(([id,attack])=>text(id)&&validBountifulOpportunityCollectorAttack(attack))&&Array.isArray(facts.rawBook)&&facts.rawBook.length<=128&&facts.rawBook.every(row=>keys(row,['actorId','values','hostOriginalRollId','hostOriginalRollIssuerMode','hostOriginalDiceCursor'])&&text(row.actorId)&&text(row.hostOriginalRollId)&&['dm','player'].includes(row.hostOriginalRollIssuerMode)&&Number.isSafeInteger(row.hostOriginalDiceCursor)&&row.hostOriginalDiceCursor>=1&&Array.isArray(row.values)&&row.values.length>=1&&row.values.length<=2&&row.values.every(v=>die(v,20)))?facts:null
}
