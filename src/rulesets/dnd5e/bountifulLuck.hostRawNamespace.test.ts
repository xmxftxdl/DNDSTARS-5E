import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import {ensureBountifulEquipmentContinuation} from './bountifulEquipmentContinuationHost'

import {dnd5eWeaponAttackProfile} from './equipment'

import type {Character} from '../../types/character'


import { durableD20RollId } from '../../lib/rollConfirmation';
import {syncCharacterClassResources} from '../../lib/classResources'

import {beginBountifulEquipmentOriginal} from './bountifulLuckEquipmentOriginal'


import {it,expect,vi} from 'vitest'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import { prepareDnd5eEquipmentAttack } from './equipmentAttackAction';

import {applyDnd5eInventoryMutation} from './items'
import type {BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'

import {driveBountifulOriginalParent,BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDieRollId,nextBountifulOriginalDieOwner,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'



vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))

function hero(options: { current?: number; attuned?: boolean; identified?: boolean } = {}): Character {
  return normalizeCharacter({
    id: 'hero',
    name: 'Hero',
    player: 'Player',
    charClass: 'Fighter',
    level: 1,
    maxHp: 12,
    currentHp: 12,
    equipment: {
      mainWeapon: {
        id: 'plugin:blade',
        name: 'Fate Blade',
        slot: 'mainWeapon',
        dnd5e: {
          kind: 'weapon', category: 'martial', mode: 'melee',
          damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str', reachFeet: 5,
        },
      },
    },
    dnd5eInventory: {
      schemaVersion: 3,
      revision: 0,
      entries: [{
        instanceId: 'blade-1',
        templateId: 'plugin:blade',
        quantity: 1,
        acquiredAt: 1,
        equippedSlot: 'mainWeapon',
        attuned: options.attuned ?? true,
        identified: options.identified ?? true,
        item: {
          id: 'plugin:blade',
          name: 'Fate Blade',
          category: 'equipment',
          icon: 'weapon',
          description: 'Test item',
          rulesText: 'Test item',
          stackable: false,
          equipment: {
            id: 'plugin:blade',
            name: 'Fate Blade',
            slot: 'mainWeapon',
            dnd5e: {
              kind: 'weapon', category: 'martial', mode: 'melee',
              damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str', reachFeet: 5,
            },
          },
          magicItem: { kind: 'weapon', rarity: 'rare', attunement: 'required', automation: 'headless' },
          resources: [{ id: 'charges', label: 'Charges', maximum: 4, resetOn: 'dawn' }],
          headlessEffects: [{
            schemaVersion: 1,
            id: 'attack-reroll',
            kind: 'attack-roll-reroll',
            resourceId: 'charges',
            maximumDice: 1,
            trigger: 'after-attack-roll',
            appliesTo: 'attacks-with-this-weapon',
          }],
          source: { book: 'Test', license: 'CC0' },
        },
        resources: {
          charges: {
            id: 'charges', label: 'Charges', current: options.current ?? 4, maximum: 4, resetOn: 'dawn',
          },
        },
      }],
    },
  })
}


it.each([0])('actual BL finalized die remains protected while an independent original die uses a real active charged equipment source (%i)',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson("{\n  \"name\": \"DM 本地规则\",\n  \"version\": \"1.0.0\",\n  \"races\": [],\n  \"backgrounds\": [],\n  \"features\": [],\n  \"feats\": [\n    {\n      \"id\": \"bountiful-luck\",\n      \"name\": \"慷慨吉运\",\n      \"summary\": \"半身人可用反应帮助附近可见盟友重骰攻击、技能或豁免检定中掷出的1。\",\n      \"description\": \"先决条件为半身人。当你周围30尺内你可见的盟友在攻击检定、技能检定或豁免检定的d20中掷出1时，你可以使用反应使其重骰一次；盟友必须接受新的结果。使用此能力后，直到你的下个回合结束前，你无法使用幸运种族特性。\",\n      \"automation\": \"full\",\n      \"prerequisite\": {\n        \"raceIds\": [\n          \"halfling\"\n        ]\n      },\n      \"declarativeAbility\": {\n        \"schemaVersion\": 1,\n        \"id\": \"bountiful-luck\",\n        \"name\": \"慷慨吉运\",\n        \"description\": \"先决条件为半身人。当你周围30尺内你可见的盟友在攻击检定、技能检定或豁免检定的d20中掷出1时，你可以使用反应使其重骰一次；盟友必须接受新的结果。使用此能力后，直到你的下个回合结束前，你无法使用幸运种族特性。\",\n        \"level\": 1,\n        \"trigger\": {\n          \"kind\": \"after-d20-roll\"\n        },\n        \"cost\": {\n          \"economy\": \"reaction\"\n        },\n        \"targeting\": {\n          \"kind\": \"single-creature\",\n          \"relation\": \"ally\",\n          \"rangeFeet\": 30,\n          \"requiresSight\": true,\n          \"includeSelf\": false\n        },\n        \"effects\": [],\n        \"automation\": \"full\",\n        \"mechanic\": {\n          \"kind\": \"ally-natural-one-reroll\"\n        }\n      }\n    }\n  ],\n  \"spells\": [],\n  \"items\": [],\n  \"abilityGenerationMethods\": [],\n  \"headlessActions\": [],\n  \"activities\": [],\n  \"classes\": [],\n  \"subclasses\": [],\n  \"monsters\": []\n}")
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 const disposeExtra=registerDnd5eRulesPlugin({manifest:{id:'test.bound-extra',name:'Extra die',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0-1.0'},setup(api){api.registerFeat({id:'accuracy',name:'Extra die',summary:'Extra die',description:'A real registered advantage-only test feature',automation:'full',resources:[{id:'uses',label:'Uses',maximum:1,resetOn:'long-rest'}],declarativeAbility:{schemaVersion:1,id:'accuracy',name:'Extra die',description:'Extra die',level:1,trigger:{kind:'after-d20-roll'},targeting:{kind:'self'},effects:[],automation:'full',cost:{economy:'none',resources:[{resourceId:'uses',amount:1}]},mechanic:{kind:'d20-choice-reroll',rollKinds:['attack'],scopes:['self-roll'],additionalDice:1,selection:'highest',requiresAdvantage:true,attackAbilities:['dex','int','wis','cha']}}})}})
 try{
  const make=(id:string,feat:boolean)=>normalizeCharacter({id,name:id,roomMemberId:id+'-member',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,abilities:{str:10,dex:14,con:14,int:10,wis:10,cha:10},currentHp:30,maxHp:30,dnd5eFeatIds:feat?[pkg.manifest.id+':bountiful-luck']:[]})
  const actor=syncCharacterClassResources({...make('ally',false),rulesetId:'dnd5e-2014-srd-5.1',dnd5eFeatIds:['test.bound-extra:accuracy']});actor.race='人类';actor.dnd5eRaceId='human';actor.inspiration=1;actor.dnd5eCombatState={bardicInspirationDie:6,bardicInspirationSourceId:'first-token',bardicInspirationRoundsRemaining:10};actor.equipment=hero().equipment;actor.dnd5eInventory=hero().dnd5eInventory;
  const characters=[applyDnd5eInventoryMutation([actor],{type:'grant',characterId:actor.id,templateId:'srd-5.1:item:arrows',quantity:20}).characters[0],make('first',true),make('second',true),make('target',false)]
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,index)=>({id:c.id+'-token',characterId:c.id,type:index===3?'enemy':'player',label:c.name,x:index===0?25:index===3?75:index===1?125:175,y:25,size:1,color:'',emoji:''}))}
  const action:SharedPlayerActionState={id:'parent',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',roomMemberId:'ally-member',type:'dnd5e-weapon-attack',actorTokenId:'ally-token',characterId:'ally',targetTokenId:'target-token',round:1,initiativeIndex:0,seq:1,updatedAt:1}
  const prepared=prepareDnd5eEquipmentAttack({action,map,characters,attacksUsed:0,initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))})
  if(!prepared.ok)throw Error(prepared.reason+': '+JSON.stringify({profile:dnd5eWeaponAttackProfile(characters[0]),weapon:characters[0].equipment?.mainWeapon}))
  prepared.prepared.attackMode='advantage'
  type Resource={_sync:{revision:number};[key:string]:unknown}
  let data:Record<string,Resource>={combat:{_sync:{revision:1},active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0},characters:{_sync:{revision:2},characters},maps:{_sync:{revision:3},maps:[map]},'player-action-requests':{_sync:{revision:4},requests:[action]}}
  data['player-action-ack']={_sync:{revision:0},id:''}
  data['player-action-processed']={_sync:{revision:0},actionIds:[]}
  const writes:string[][]=[]
  const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone(data[name]??null)as T,saveResourcesAtomically:async(batch,options)=>{for(const write of batch)expect(write.expectedRevision).toBe(data[write.name]._sync.revision);for(const [name,value]of Object.entries(options?.readRevisions??{}))expect(data[name]?._sync.revision??0).toBe(value);const next=structuredClone(data);for(const write of batch)next[write.name]={...write.data as object,_sync:{revision:data[write.name]._sync.revision+1}};data=next;writes.push(batch.map(row=>row.name));return{status:'committed',transactionId:options?.transactionId??'',revisions:{}}}}
  const rawRollId=durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:'parent',occurrenceIndex:0})+':pool:2d20'
  const source={prepared:prepared.prepared,d20:1,d20Second:1,damageRolls:[] as number[],...captureBountifulOriginalRawIssuer({mapId:map.id,parentId:action.id,mode:'dm',rollId:rawRollId,cursor:1,raw:[1,1]})}
  await expect(beginBountifulEquipmentOriginal({action,source},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  const untouched=structuredClone(data.characters),sequence:string[]=[],rolls:string[]=[]
  const append=(receipt:BountifulOriginalDieReceipt,actorTokenId:string,characterId:string,memberId:string,command:object)=>{
   const rows=data['player-action-requests'].requests as object[]
   data['player-action-requests'].requests=[...rows,{id:'response-'+rows.length,roomMemberId:memberId,type:'dnd5e-bountiful-luck',status:'pending',sourceMode:'player',mapId:'map',combatId:'combat',actorTokenId,characterId,bountifulLuck:{parentId:'parent',occurrence:receipt.identity.occurrence,command}}]
  }
  // A closed or unanswered UI does not manufacture a decline or any cost.
  await expect(driveBountifulOriginalParent({mapId:'map',parentId:'parent'},gateway,{showChoice:async()=>{},requestRoll:async()=>{}})).rejects.toBeInstanceOf(BountifulOriginalParentPending)
  expect(data.characters).toEqual(untouched)
  const stage=await beginBountifulEquipmentOriginal({action,source},gateway,{
   showChoice:async receipt=>{const next=nextBountifulOriginalDieOwner(receipt);if(!next)throw Error('No real owner');sequence.push(next.ownerId+':'+receipt.request.dieIndex);const control=receipt.controllers[next.ownerId];append(receipt,next.ownerId,control.characterId,control.memberId,{phase:'reaction',...next,decision:receipt.request.dieIndex===0?'use':'decline'})},
   requestRoll:async(receipt,refresh)=>{rolls.push(receipt.identity.roller.tokenId+':'+receipt.request.dieIndex);const roller=receipt.identity.roller,id=bountifulOriginalDieRollId(receipt),value=1;append(receipt,roller.tokenId,requireCharacterRoller(roller),roller.memberId,{phase:'roll',rollRequestId:id,value});const fresh=await refresh();expect(fresh.rawReroll?.memberId).toBe('ally-member');append(fresh,roller.tokenId,requireCharacterRoller(roller),'host',{phase:'confirm',rollRequestId:id,rawValue:value,value})}
  })
  if(!stage)throw Error('Real equipment raw did not issue its private parent')
  expect(stage.originalReady).toMatchObject({rollMode:'advantage',finalizedDice:[0],values:[1,1]})

  expect(action.sourceMode).toBe('player')
  expect(source.hostOriginalRollIssuerMode).toBe('dm')
  expect(await ensureBountifulEquipmentContinuation({mapId:'map',parentId:'parent'},gateway)).toBeDefined()
 }finally{disposeExtra();dispose()}
})

function requireCharacterRoller(roller:{characterId?:string}){if(!roller.characterId)throw Error("This Character-only fixture requires its actual Character roller");return roller.characterId}
