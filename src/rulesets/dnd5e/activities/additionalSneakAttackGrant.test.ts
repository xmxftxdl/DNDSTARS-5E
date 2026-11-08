import {afterEach,expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,type Dnd5eWeaponClassDamageContext} from '../headlessCombatEngine'
import {registerDnd5eActivityPackage,clearDnd5eActivityRegistryForTests} from './dnd5eActivityRegistry'
import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
const definition=():Dnd5eActivityDefinitionV1=>({schemaVersion:1,id:'extra',name:'Extra',activation:{kind:'free'},target:{kind:'self'},requirements:[{kind:'combat-active'},{kind:'attack-action-used'},{kind:'action-economy-available',economy:'bonus-action'},{kind:'once-per-turn',key:'extra'}],legacySource:{kind:'feature',id:'extra'},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'extra',when:{kind:'always'},operations:[{id:'extra',kind:'grant-weapon-attack',target:'actor',grantId:'extra',label:'Extra',economy:'bonus-action',expires:'turn-end',attacks:1,additionalSneakAttackDifferentTarget:true}]}]})
const context:Dnd5eWeaponClassDamageContext={weaponId:'rapier',mode:'melee',finesse:true,strengthBased:false,weaponDamageSides:8,damageType:'piercing',adjacentEnemyOfTarget:true,proficient:true,weaponProperties:['finesse']}
function combat(){const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,classId:'rogue',classLevels:{rogue:3},level:3,abilities:{str:10,dex:16,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:['test.extra:extra']});return startDnd5eHeadlessCombat('extra-contract',[actor,...['a','b'].map(id=>({...structuredClone(actor),id,name:id,controller:'dm' as const,initiative:10,classId:undefined,classLevels:undefined,pluginFeatureIds:[]}))])}
afterEach(clearDnd5eActivityRegistryForTests)
it.each(['different','same','ordinary','missing-history','forged-dice']as const)('bounds repeated Sneak Attack to the actual grant and distinct Host target: %s',mode=>{
 registerDnd5eActivityPackage({packageId:'test.extra',packageVersion:'1.0.0',activities:[definition()]})
 let state=combat()
 const first=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'actor',targetId:'a',attackModifier:5,d20:15,damage:{count:1,sides:8,bonus:0,rolls:[1],type:'piercing'},classDamageContext:context,classDamageRolls:[{source:'sneak-attack',rolls:[1,1]}]})
 expect(first.ok).toBe(true);state=first.state
 const command={schemaVersion:1 as const,commandId:'grant',actorId:'actor',packageId:'test.extra',packageVersion:'1.0.0',activityId:'extra',targetIds:['actor'],expectedRevision:1}
 const granted=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,command,authoritativeRolls:{},confirmedBy:'actor'})
 expect(granted.result.ok).toBe(true);if(granted.phase!=='commit'||!granted.result.ok)throw Error('Grant failed')
 state=JSON.parse(JSON.stringify(granted.result.state))
 if(mode==='ordinary'||mode==='forged-dice')delete state.combatants.actor.classState.activityWeaponAttackGrants!.extra.additionalSneakAttackDifferentTarget
 if(mode==='missing-history')delete state.combatants.actor.classState.sneakAttackTargetsByTurnKey
 const target=mode==='same'?'a':'b',sneak=mode==='different'||mode==='forged-dice',hp=state.combatants[target].currentHp
 const attack={type:'attack' as const,actorId:'actor',targetId:target,attackModifier:5,d20:15,spendAction:false,spendBonusAction:true,activityWeaponAttackGrantId:'extra',damage:{count:1,sides:8,bonus:0,rolls:[1],type:'piercing' as const},classDamageContext:context,classDamageRolls:sneak?[{source:'sneak-attack' as const,rolls:[1,1]}]:[]}
 const result=resolveDnd5eHeadlessAction(state,attack)
 expect(result.ok).toBe(mode!=='forged-dice')
 expect(result.state.combatants[target].currentHp).toBe(hp-(mode==='forged-dice'?0:mode==='different'?3:1))
 expect(result.state.combatants.actor.turn.bonusActionAvailable).toBe(mode==='forged-dice')
 if(result.ok){
  expect(result.state.combatants.actor.classState.activityWeaponAttackGrants?.extra).toBeUndefined()
  expect(resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(result.state)),attack).ok).toBe(false)
 }
})
it.each([{economy:'none'},{attacks:2},{available:'next-own-turn'},{additionalSneakAttackDifferentTarget:false},{allowUnarmedStrikes:false}])('rejects malformed or expanded extra-attack grants: %j',patch=>{
 const activity=definition(),operation=activity.outcomes[0].operations[0]
 Object.assign(operation,patch)
 expect(validateDnd5eActivityDefinitionV1(activity).length).toBeGreaterThan(0)
})
