import { expect, it } from 'vitest'
import { normalizeDnd5eMapObjectCombatProfile, dnd5eAttackableMapObject } from './mapObjectCombatProfile'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import { migrateMapsState } from '../../store/maps'

it('retains explicit object combat data through actual map migration and JSON reload', () => {
 const combatProfile = { armorClass: 17, damageThreshold: 5, damageImmunities: ['poison','psychic'], damageResistances: ['fire'], damageVulnerabilities: ['cold'] }
 const token = { id:'object',type:'obstacle',label:'Object',x:25,y:25,size:1,hp:40,maxHp:60,emoji:'',color:'',dnd5eObjectState:{schemaVersion:1,combatProfile} }
 const map = {id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[token]}
 const migrated=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(migrated.tokens[0].dnd5eObjectState?.combatProfile).toEqual(combatProfile)
 expect(dnd5eAttackableMapObject(migrated.tokens[0])).toEqual({...combatProfile,currentHp:40,maxHp:60})
 expect(token.hp).toBe(40)
})

it('rejects corrupt profiles and refuses unknown or destroyed targets', () => {
 for(const combatProfile of [{armorClass:0},{armorClass:41},{armorClass:'17'},{armorClass:17,damageThreshold:-1},
  {armorClass:17,damageImmunities:['radiant','radiant']},{armorClass:17,damageResistances:['unknown']},{armorClass:17,run:'code'}]) {
  expect(normalizeDnd5eMapObjectCombatProfile(combatProfile)).toBeUndefined()
  expect(normalizeDnd5eMapObjectStateV1({schemaVersion:1,combatProfile})).toBeUndefined()
 }
 const base={type:'obstacle',hp:10,maxHp:10,dnd5eObjectState:{combatProfile:{armorClass:17}}}
 for(const patch of [{type:'enemy'},{hp:0},{hp:-1},{hp:11},{maxHp:undefined},{dnd5eObjectState:undefined}]) {
  expect(dnd5eAttackableMapObject({...base,...patch})).toBeUndefined()
 }
 expect(normalizeDnd5eMapObjectStateV1({schemaVersion:1})?.combatProfile).toBeUndefined()
})
