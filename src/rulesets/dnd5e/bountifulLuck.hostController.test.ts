import {it,expect} from 'vitest'
import {bountifulPreparedController} from './bountifulPreparedController'
import {normalizeCharacter} from '../../store/characters'
import type {BattleMap} from '../../store/maps'

function fixture(){
 const character=normalizeCharacter({id:'hero',name:'Hero',roomMemberId:'actual-player',level:4,charClass:'战士'})
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'hero-token',characterId:'hero',type:'player',label:'Hero',x:25,y:25,size:1,color:'',emoji:''}]}
 return {characters:[character],map,characterIdByCombatantId:{'hero-token':'hero'}}
}
it('keeps an actual player owner even when the issuing Host has control of the room',()=>{
 expect(bountifulPreparedController(fixture(),'hero-token','host')).toEqual({characterId:'hero',memberId:'actual-player'})
})
it('uses only the issuing Host for a real unowned Character-token pair',()=>{
 const prepared=fixture();delete prepared.characters[0].roomMemberId
 expect(bountifulPreparedController(prepared,'hero-token','host')).toEqual({characterId:'hero',memberId:'host'})
})
it.each(['wrong-token-character','missing-token','duplicate-token','missing-character','duplicate-character','empty-host','blank-owner'] as const)('rejects %s rather than turning missing ownership data into another controller',variant=>{
 const prepared=fixture()
 if(variant==='wrong-token-character')prepared.map.tokens[0].characterId='foreign'
 if(variant==='missing-token')prepared.map.tokens=[]
 if(variant==='duplicate-token')prepared.map.tokens.push({...prepared.map.tokens[0]})
 if(variant==='missing-character')prepared.characters=[]
 if(variant==='duplicate-character')prepared.characters.push({...prepared.characters[0]})
 if(variant==='blank-owner')prepared.characters[0].roomMemberId=' '
 expect(()=>bountifulPreparedController(prepared,'hero-token',variant==='empty-host'?'':'host')).toThrow('bountiful-controller:')
})
