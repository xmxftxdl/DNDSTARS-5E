import {it,expect} from 'vitest'
import {normalizeTempleWard} from '../../../shared/temple-ward.mjs'
import {normalizeStructureLifetimes} from '../../../shared/structure-lifetime.mjs'
const ward={hostileCreatureTypes:['fiend','undead'],saveDc:18,healingBonus:5,lighting:'dim'}
it('validates the five allowed types, positive Host values and lighting without accepting extra privileges',()=>{
 expect(normalizeTempleWard(ward)).toEqual(ward)
 for(const patch of [{hostileCreatureTypes:[]},{hostileCreatureTypes:['humanoid']},{hostileCreatureTypes:['fiend','fiend']},
  {saveDc:0},{saveDc:41},{saveDc:NaN},{healingBonus:0},{healingBonus:1.5},{lighting:'sunlight'},{ignoreSaves:true}]){
  expect(normalizeTempleWard({...ward,...patch})).toBeUndefined()
 }
})
it('retains a copied ward only on a bounded temple structure and rejects schema smuggling',()=>{
 const record={id:'temple',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:['door'],
  replacementGroup:'temple-of-the-gods',siteKey:'site',objectBoundary:{points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],bottomFeet:0,topFeet:10},templeWard:ward}
 const restored=normalizeStructureLifetimes(JSON.parse(JSON.stringify([record])))!
 expect(restored[0].templeWard).toEqual(ward)
 restored[0].templeWard!.hostileCreatureTypes.push('fey')
 expect(ward.hostileCreatureTypes).toEqual(['fiend','undead'])
 expect(normalizeStructureLifetimes([{...record,replacementGroup:'mighty-fortress'}])).toBeUndefined()
 expect(normalizeStructureLifetimes([{...record,objectBoundary:undefined}])).toBeUndefined()
})
