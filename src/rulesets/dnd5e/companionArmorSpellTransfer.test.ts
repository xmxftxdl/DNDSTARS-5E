import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { normalizeCharacter } from '../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } from './unifiedContent'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { applyDnd5eInventoryMutation } from './items'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { prepareDnd5eMapInventoryDrop } from './mapInventoryDrop'
import { prepareDnd5eMapInventoryPickup } from './mapInventoryPickup'
import { prepareDnd5eCompanionArmorChange, dnd5eCompanionSceneWornArmor } from './companionWornArmor'
import { getDnd5eSrdMonster } from './monsters'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { endDnd5eConcentration } from './headlessCombatEngine'
function wizard(spellId: string): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'wizard', name: '法师', player: '', avatar: '', accent: '',
    race: '人类', charClass: '法师', level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d6', ac: 14, speed: 30, initiativeBonus: 2,
    saveDC: 15, passivePerception: 11, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
    classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } },
  }
}

function token(id: string, type: 'player' | 'enemy', x: number, characterId?: string): Token {
  return { id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 }
}

it('casts an exported imported armor spell, transfers its item and ends its actual concentration', async()=>{
 const namespace='test.armor-spell-transfer',spellId=namespace+':ward',automation=automationCapabilityFromLegacyStatus('full')
 const source=parseDnd5eUnifiedContentBundleV1(JSON.stringify({format:'dndstars5e-unified-content',schemaVersion:1,
  manifest:{id:namespace,name:'Armor transfer',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},assets:[],
  definitions:[{schemaVersion:1,namespace,version:'1.0.0',id:'ward',kind:'spell',name:'Ward',automation,
   payload:{id:'ward',name:'Ward',level:2,school:'abjuration',ritual:false,castingTime:{value:1,unit:'action'},range:{type:'self'},
    targeting:{relation:'ally',includeSelf:true,maximumTargets:1},components:{verbal:false,somatic:false,material:false},
    duration:{type:'timed',value:1,unit:'hour',concentration:true},classes:['wizard'],description:'Synthetic armor transfer test',automation:{mode:'reference-only'}},
   activities:[{schemaVersion:1,id:'ward',name:'Ward',automation,activation:{kind:'action'},target:{kind:'self'},legacySource:{kind:'spell',id:'ward'},
    effects:[{schemaVersion:1,id:'ward',name:'Ward',stacking:'replace',duration:{kind:'concentration',maximumRounds:600},
     modifiers:[{kind:'armor-enchantment',itemSelection:'inventory-item',requiresNonmagical:true,armorClassBonus:{kind:'constant',value:1}}]}],
    outcomes:[{id:'ward',when:{kind:'always'},operations:[{id:'ward',kind:'apply-effect',target:'actor',effectId:'ward'}]}]}]}]}))!
 const restored=await readDnd5eStarMod(await exportDnd5eStarMod(source))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(restored.bundle))
 try{
  const initial=normalizeCharacter({...wizard(spellId),equipment:{},dnd5eInventory:{schemaVersion:3,revision:0,entries:[]}})
  const grant=applyDnd5eInventoryMutation([initial],{type:'grant',characterId:initial.id,templateId:'srd-5.1:equipment:dnd5e-chain-mail',quantity:1})
  expect(grant.ok).toBe(true)
  const actor=grant.characters[0],entry=actor.dnd5eInventory!.entries[0],caster=token('caster','player',25,actor.id)
  const map:BattleMap={id:'armor-transfer',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[caster]}
  const action:SharedPlayerActionState={id:'armor-spell-cast',type:'dnd5e-spell-cast',sourceMode:'player',status:'pending',mapId:map.id,actorTokenId:caster.id,characterId:actor.id,round:1,initiativeIndex:0,seq:1,updatedAt:1,
   dnd5eSpellCast:{spellId,castingClassId:'wizard',slotLevel:2,targetTokenId:caster.id,targetTokenIds:[caster.id],activityInventoryInstanceId:entry.instanceId,activityInventoryCharacterId:actor.id,expectedActivityInventoryRevision:actor.dnd5eInventory!.revision??0}}
  const prepared=prepareDnd5ePluginSpellCast({action,map,characters:[actor],initiativeOrder:[{tokenId:caster.id,label:caster.label,roll:20,color:'',emoji:''}]})
  if(!prepared.ok)throw Error(prepared.reason)
  const settled=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{activityRolls:{}}})
  expect(settled.result.ok,settled.result.ok?undefined:settled.result.reason).toBe(true)
  const application=settled.application!,owner=application.characters[0]
  expect(owner.classResources!['dnd5e-spell-slot-2'].current).toBe(0)
  expect(owner.concentrating).toBe(true)
  const drop=prepareDnd5eMapInventoryDrop({map:application.map,characters:application.characters,actorTokenId:caster.id,instanceId:entry.instanceId,expectedInventoryRevision:owner.dnd5eInventory!.revision??0,requestId:'armor-spell-drop',combatActive:false})
  if(!drop.ok)throw Error(drop.reason)
  drop.map.tokens.push({...token('undead','enemy',25),poolId:'srd-5.1:skeleton',dnd5eNativeArmorRemoved:true,dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:actor.id,sourceTokenId:caster.id,createdRound:1,expiresAfterRound:600,side:'player'}})
  const pickup=prepareDnd5eMapInventoryPickup({map:drop.map,characters:drop.characters,actorTokenId:'undead',objectTokenId:drop.objectTokenId,expectedReceiptId:drop.objectTokenId,expectedQuantity:1,combatActive:false})
  if(!pickup.ok)throw Error(pickup.reason)
  const bearer=pickup.map.tokens.find(t=>t.id==='undead')!
  const don=prepareDnd5eCompanionArmorChange({token:bearer,itemId:bearer.dnd5eCarriedObjects![0].id,proficient:true,combatActive:false,startedWorldMinute:0,completedWorldMinute:10})!
  expect(don.complete).toBe(true);bearer.dnd5eCarriedObjects=don.carried
  const project=()=>dnd5eCompanionSceneWornArmor(bearer,getDnd5eSrdMonster(bearer.poolId!),pickup.map,pickup.characters)?.armorClass
  expect(project()).toBe(17)
  const snapshot=createDnd5eMapCombatSnapshot({map:pickup.map,characters:pickup.characters,combatId:'after-cast',round:1,initiativeOrder:[{tokenId:caster.id,label:caster.label,roll:20,color:'',emoji:''}]})
  endDnd5eConcentration(snapshot.state,snapshot.state.combatants[caster.id],[])
  const ended=planDnd5eMapResultApplication({state:snapshot.state,map:pickup.map,characters:pickup.characters,characterIdByCombatantId:snapshot.characterIdByCombatantId})
  const endedBearer=ended.map.tokens.find(t=>t.id==='undead')!
  expect(ended.characters[0].concentrating).toBe(false)
  expect(dnd5eCompanionSceneWornArmor(endedBearer,getDnd5eSrdMonster(endedBearer.poolId!),ended.map,ended.characters)?.armorClass).toBe(16)
 }finally{dispose()}
})
