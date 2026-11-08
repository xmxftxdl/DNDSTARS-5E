import {expect,it} from 'vitest'
import {bountifulOriginalRollIssuerMode} from './bountifulOriginalRawIssuer'

it('rejects absent or unknown Host issuer even if player payload claims a source mode',()=>{
 for(const source of [undefined,{}, {sourceMode:'dm'},{action:{sourceMode:'dm'}},{hostOriginalRollIssuerMode:'unknown',sourceMode:'dm'}]){
  expect(()=>bountifulOriginalRollIssuerMode(source)).toThrow('host-raw-issuer-mode-required')
 }
 expect(bountifulOriginalRollIssuerMode({hostOriginalRollIssuerMode:'dm',action:{sourceMode:'player'}})).toBe('dm')
 expect(bountifulOriginalRollIssuerMode({hostOriginalRollIssuerMode:'player',action:{sourceMode:'dm'}})).toBe('player')
})
