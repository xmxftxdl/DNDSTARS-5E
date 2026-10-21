import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {placeDnd5eMightyFortressKeep} from './mightyFortressStructure'
import {prepareDnd5eMightyFortressFeast} from './mightyFortressServices'
import {prepareDnd5eMapInventoryPickup} from './mapInventoryPickup'
import {normalizeCharacter} from '../../store/characters'
import {normalizeDnd5eInventory} from './items'

it('reserves daily guests with generated food in the same snapshot, survives reload and prevents duplicate service',()=>{
 const actor={id:'caster-token',characterId:'caster',type:'player' as const,label:'Caster',size:1,color:'',emoji:'',x:400,y:400,hp:12}
 const map:BattleMap={id:'fortress',name:'Map',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[actor]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,
  elevationFeet:0,createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 // Fixture template exercises physical serving/pickup only; the imported fortress must supply its own meal definition.
 const input={map,geometry,structureId:'keep',actorTokenId:actor.id,worldMinute:100,expectedWorldDay:0,requestId:'meal-1',guests:60,mealTemplateId:'srd-5.1:item:conjured-food-portion'}
 const before=structuredClone(input),served=prepareDnd5eMightyFortressFeast(input)
 if(!served.ok)throw Error(served.reason)
 expect(served.remainingGuests).toBe(40)
 expect(input).toEqual(before)
 const reloaded=normalizeMapGeometry(JSON.parse(JSON.stringify(served.geometry)))!
 const next={...input,map:served.map,geometry:reloaded}
 expect(prepareDnd5eMightyFortressFeast(next)).toMatchObject({ok:false,reason:'fortress-feast-already-served'})
 expect(prepareDnd5eMightyFortressFeast({...next,requestId:'meal-2',guests:41})).toMatchObject({ok:false,reason:'fortress-feast-daily-limit'})
 const last=prepareDnd5eMightyFortressFeast({...next,requestId:'meal-2',guests:40})
 if(!last.ok)throw Error(last.reason)
 expect(last.remainingGuests).toBe(0)
 expect(prepareDnd5eMightyFortressFeast({...next,worldMinute:1440})).toMatchObject({ok:false,reason:'fortress-feast-clock-changed'})
 expect(prepareDnd5eMightyFortressFeast({...next,worldMinute:1440,expectedWorldDay:1,guests:100})).toMatchObject({ok:true,remainingGuests:0})
 expect(prepareDnd5eMightyFortressFeast({...next,worldMinute:10180,expectedWorldDay:7})).toMatchObject({ok:false,reason:'fortress-feast-unavailable'})
 expect(prepareDnd5eMightyFortressFeast({...input,map:{...map,tokens:[{...actor,characterId:'other'}]}})).toMatchObject({ok:false,reason:'fortress-feast-unauthorized'})
 const delegated={...geometry,structureLifetimes:geometry.structureLifetimes!.map(record=>({...record,fortressServices:{...record.fortressServices!,authorizedCreatureIds:['other']}}))}
 expect(prepareDnd5eMightyFortressFeast({...input,geometry:delegated,map:{...map,tokens:[{...actor,characterId:'other'}]}})).toMatchObject({ok:true,remainingGuests:40})
 const meal=served.map.tokens.at(-1)!,character=normalizeCharacter({id:'caster',name:'Caster',charClass:'法师',maxHp:12,currentHp:12,equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]}})
 const picked=prepareDnd5eMapInventoryPickup({map:served.map,geometry:served.geometry,characters:[character],actorTokenId:actor.id,objectTokenId:meal.id,
  expectedReceiptId:meal.id,expectedQuantity:60,combatActive:false})
 if(!picked.ok)throw Error(picked.reason)
 expect(normalizeDnd5eInventory(picked.characters[0]).entries[0]).toMatchObject({quantity:1,structureBinding:{mapId:map.id,structureId:'keep'}})
 expect(picked.map.tokens.find(token=>token.id===meal.id)?.dnd5eObjectState?.inventoryItem?.quantity).toBe(59)
})
