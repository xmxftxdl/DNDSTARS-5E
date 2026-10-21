import {expect,it} from 'vitest'
import {normalizeDnd5ePersistentAreaTriggerDeclaration,normalizeDnd5ePersistentAreaTriggerSnapshot,resolveDnd5ePersistentAreaTriggerSourceDc} from './persistentAreaTypes'

const declaration={id:'contact',label:'Vortex contact',timing:'on-enter',
 savingThrow:{ability:'dex',dc:'source-save-dc',onSuccess:'half',magical:true},
 conditionSavingThrow:{ability:'str',dc:'source-save-dc',onSuccess:'none',magical:true,automaticSuccessMinimumSizeRank:4},
 damage:{count:10,sides:6,type:'bludgeoning'},
 condition:{condition:'restrained',duration:{expiresAt:'permanent'},endsWithArea:true}}
it('captures both source DCs and preserves the separate condition save through persistence',()=>{
 const normalized=normalizeDnd5ePersistentAreaTriggerDeclaration(declaration)!
 expect(normalized.conditionSavingThrow?.dc).toBe('source-save-dc')
 const resolved=resolveDnd5ePersistentAreaTriggerSourceDc(normalized,17)!
 expect(resolved.savingThrow?.dc).toBe(17)
 expect(resolved.conditionSavingThrow).toMatchObject({ability:'str',dc:17,onSuccess:'none',automaticSuccessMinimumSizeRank:4})
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot(JSON.parse(JSON.stringify(resolved)))?.conditionSavingThrow).toEqual(resolved.conditionSavingThrow)
 expect(resolveDnd5ePersistentAreaTriggerSourceDc(normalized,undefined)).toBeUndefined()
})
it('rejects ungated, malformed, or damage-halving condition-save declarations',()=>{
 for(const patch of [{savingThrow:undefined},{condition:undefined},
  {conditionSavingThrow:{...declaration.conditionSavingThrow,onSuccess:'half'}},
  {conditionSavingThrow:{...declaration.conditionSavingThrow,dc:0}},
  {conditionSavingThrow:{...declaration.conditionSavingThrow,ability:'script'}},
  {conditionSavingThrow:{...declaration.conditionSavingThrow,automaticSuccessMinimumSizeRank:6}},
 ])expect(normalizeDnd5ePersistentAreaTriggerDeclaration({...declaration,...patch})).toBeUndefined()
})
