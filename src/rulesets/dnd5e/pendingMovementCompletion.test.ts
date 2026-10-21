import {expect,it} from 'vitest'
import {normalizeDnd5ePendingMovementCompletions,removeDnd5ePendingMovementCompletion} from './pendingMovementCompletion'
it('retains stable pending identities across JSON reload and rejects malformed duplicates',()=>{
 const entries=normalizeDnd5ePendingMovementCompletions(JSON.parse(JSON.stringify([{id:'save1',actorTokenId:'hero'},{id:'save2',actorTokenId:'other'},
  {id:'duplicate',actorTokenId:'hero'},{id:3,actorTokenId:'bad'},null,{id:'',actorTokenId:'empty'}])))
 expect(entries).toEqual([{id:'save1',actorTokenId:'hero'},{id:'save2',actorTokenId:'other'}])
 expect(removeDnd5ePendingMovementCompletion(entries,'save1')).toEqual([{id:'save2',actorTokenId:'other'}])
 expect(removeDnd5ePendingMovementCompletion(entries,'old-save')).toEqual(entries)
 expect(entries).toHaveLength(2)
})
it('preserves recorded saving dice and settled-save-only recovery across JSON normalization',()=>{
 const receipt={id:'stable',actorTokenId:'hero',settled:true,rolls:[{effectId:'effect',d20:12,d20Second:17,bardicInspirationRoll:4,
  postD20Adjustment:{sourceId:'ally',featureId:'help',direction:'add',roll:2}}],effectRollDice:{'recipe:1':[3]}}
 expect(normalizeDnd5ePendingMovementCompletions(JSON.parse(JSON.stringify([receipt])))).toEqual([receipt])
 const malformed={...receipt,rolls:[{effectId:'effect',d20:0}],effectRollDice:{bad:[Infinity]}}
 const restored=normalizeDnd5ePendingMovementCompletions([malformed])[0]
 expect(restored.rolls).toBeUndefined();expect(restored.effectRollDice).toBeUndefined()
})
