import {it,expect,vi} from 'vitest'
import {fixture} from './stormSorcery.castRoom.native.fixture'
import {prepareStormCastCollectorPrefix} from './stormCastCollectorPrefix'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it('a real Sorcerer5 Shatter has no casting-start feature and never probes a private Storm parent or prompts its owner',async()=>{
 const f=await fixture('legacy',5)
 try{
  const source={prepared:f.prepared,effectRolls:[] as number[],opportunityAttackSpell:false},wire=encodeSecondChanceParentWire(source)
  const prefix=await prepareStormCastCollectorPrefix({source,authorityUnchanged:()=>true,load:async()=>{throw Error('Ordinary spell has no private Storm parent')},gateway:{publishEvent:async()=>{throw Error('No Storm source issuance')}},choose:async()=>{throw Error('No Storm owner prompt')}})
  expect(prefix).toBeUndefined();expect(encodeSecondChanceParentWire(source)).toEqual(wire)
 }finally{f.dispose()}
})
