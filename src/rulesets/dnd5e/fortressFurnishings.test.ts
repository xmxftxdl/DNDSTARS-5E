import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {normalizeCharacter} from '../../store/characters'
import {placeDnd5eMightyFortressKeep} from './mightyFortressStructure'
import {placeDnd5eFortressFurnishings} from './fortressFurnishings'
import {prepareDnd5eMapInventoryPickup} from './mapInventoryPickup'
import {prepareDnd5eStructureExpiry} from './structureExpiry'
import {expireDnd5eStructureMapObjects} from './structureObjectExpiry'
import {expireDnd5eStructureInventoryItems} from './items'
import {validDnd5eFortressFurnishingCatalog} from './fortressFurnishingDefinition'

it('creates physical furnishings with source binding, preserves it through pickup and removes both scene and carried items on expiry',()=>{
 const actor={id:'actor',characterId:'caster',type:'player' as const,label:'Caster',size:1,color:'',emoji:'',x:650,y:600,hp:12}
 const map={id:'map',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[actor]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry('map',1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,
  towerThicknessInches:6,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 // Existing mundane item tests the mechanism; the imported module supplies its furniture definitions.
 const input={map,geometry,structureId:'keep',catalog:[{templateId:'srd-5.1:item:bedroll',size:0.5}],
  placements:[{id:'bed',templateId:'srd-5.1:item:bedroll',level:1 as const,x:60,y:50},{id:'upstairs',templateId:'srd-5.1:item:bedroll',level:2 as const,x:60,y:60}]}
 const furnished=placeDnd5eFortressFurnishings(input)
 expect(furnished.tokenIds).toHaveLength(2)
 const token=furnished.map.tokens.find(token=>token.id==='keep:furniture:bed')!
 expect(token.dnd5eObjectState).toMatchObject({weightPounds:7,structureBinding:{mapId:'map',structureId:'keep'}})
 expect(furnished.map.tokens.at(-1)?.elevationFeet).toBe(10.5)
 const character=normalizeCharacter({id:'caster',name:'Caster',charClass:'法师',maxHp:12,currentHp:12,equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]}})
 const picked=prepareDnd5eMapInventoryPickup({map:furnished.map,geometry,characters:[character],actorTokenId:actor.id,objectTokenId:token.id,
  expectedReceiptId:token.id,expectedQuantity:1,combatActive:false})
 if(!picked.ok)throw Error(picked.reason)
 expect(picked.characters[0].dnd5eInventory?.entries[0].structureBinding).toMatchObject({mapId:'map',structureId:'keep'})
 expect(expireDnd5eStructureInventoryItems(picked.characters[0],[{mapId:'map',structureId:'keep'}]).dnd5eInventory?.entries).toHaveLength(0)
 const expired=prepareDnd5eStructureExpiry(picked.map,geometry,10180)
 expect(expireDnd5eStructureMapObjects(expired.map,expired.expiredIds.map(structureId=>({schemaVersion:1 as const,mapId:'map',structureId}))).tokens.some(token=>token.id.startsWith('keep:furniture:'))).toBe(false)
 expect(()=>placeDnd5eFortressFurnishings({...input,catalog:[]})).toThrow('fortress-furnishings-template-unavailable')
 expect(()=>placeDnd5eFortressFurnishings({...input,placements:[{...input.placements[0],x:10}]})).toThrow('fortress-furnishings-outside-keep')
 expect(()=>placeDnd5eFortressFurnishings({...input,placements:[input.placements[0],{...input.placements[0],id:'overlap'}]})).toThrow('fortress-furnishings-placement-blocked')
 expect(()=>placeDnd5eFortressFurnishings({...input,map:furnished.map})).toThrow('fortress-furnishings-id-conflict')
 expect(validDnd5eFortressFurnishingCatalog([{templateId:'bad id',size:1}])).toBe(false)
 expect(validDnd5eFortressFurnishingCatalog([{templateId:'valid:item',size:Infinity}])).toBe(false)
 expect(map.tokens).toHaveLength(1)
})
