import {expect,it} from 'vitest'
import {bountifulNativeDiceController} from '../../../shared/bountiful-native-dice-controller.mjs'

const character={id:'pc',roomId:'room',roomMemberId:'original-player'}
it('uses the exact DiceBox simulacrum source character before the subject link',()=>{
 const actor={id:'duplicate',type:'enemy',poolId:'srd-5.1:skeleton',characterId:'subject',dnd5eSimulacrum:{sourceCharacterId:'pc'}}
 const roster=[character,{id:'subject',roomMemberId:'different-player'}]
 expect(bountifulNativeDiceController({tokens:[actor]},roster,actor.id,'room')).toEqual({token:actor,character})
})
it('does not turn an ordinary summon source, team or viewer flag into dice control',()=>{
 const actor={id:'summon',type:'enemy',poolId:'srd-5.1:skeleton',dnd5eSide:'player',viewerControlled:true,dnd5eSummon:{sourceCharacterId:'pc'}}
 expect(bountifulNativeDiceController({tokens:[actor]},[character],actor.id,'room')).toEqual({token:actor})
})
it.each([
 {roster:[{...character,roomId:'foreign'}]},
 {roster:[{...character,roomMemberId:' original-player'}]},
 {roster:[character,character]},
 {roster:[]},
])('fails closed for an unavailable or foreign canonical delegate %s',({roster})=>{
 const actor={id:'duplicate',type:'enemy',poolId:'srd-5.1:skeleton',dnd5eSimulacrum:{sourceCharacterId:'pc'}}
 expect(bountifulNativeDiceController({tokens:[actor]},roster,actor.id,'room')).toBeNull()
})
it('requires one canonical token and an actual room',()=>{
 const actor={id:'duplicate',type:'enemy',poolId:'srd-5.1:skeleton',dnd5eSimulacrum:{sourceCharacterId:'pc'}}
 expect(bountifulNativeDiceController({tokens:[actor,actor]},[character],actor.id,'room')).toBeNull()
 expect(bountifulNativeDiceController({tokens:[actor]},[character],actor.id,'')).toBeNull()
})
