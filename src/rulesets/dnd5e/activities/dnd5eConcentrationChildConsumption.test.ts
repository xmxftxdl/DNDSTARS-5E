import { expect, it } from 'vitest'
import { dnd5eConcentrationChildConsumptionIssues } from './dnd5eConcentrationChildConsumption'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
const cast = { id: 'cast', effects: [{id:'ticket',duration:{kind:'concentration',maximumRounds:10},sourceLink:{sourceRequiresEffect:'main'}}],outcomes:[] } as unknown as Dnd5eActivityDefinitionV1
const use = {id:'use',effects:[{id:'enhancement',sourceLink:{sourceRequiresEffect:'main'}}],outcomes:[{operations:[
 {kind:'remove-effect',target:'actor',source:'self',effectId:'ticket'},
 {kind:'apply-effect',target:'actor',effectId:'enhancement'},
]}]} as unknown as Dnd5eActivityDefinitionV1
it('rejects consuming a concentration child while applying a replacement dependent on its parent',()=>{
 expect(dnd5eConcentrationChildConsumptionIssues([cast,use])).toHaveLength(1)
})
it('accepts a non-concentration authorization linked to the parent and an intentional spell dismissal',()=>{
 const safe=structuredClone(cast);safe.effects![0].duration={kind:'rounds',rounds:10,expiresAt:'target-turn-end'}
 expect(dnd5eConcentrationChildConsumptionIssues([safe,use])).toEqual([])
 const dismiss=structuredClone(use);dismiss.outcomes[0].operations=dismiss.outcomes[0].operations.slice(0,1)
 expect(dnd5eConcentrationChildConsumptionIssues([cast,dismiss])).toEqual([])
})
