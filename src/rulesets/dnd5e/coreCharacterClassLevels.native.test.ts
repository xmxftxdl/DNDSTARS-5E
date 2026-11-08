import{it,expect}from'vitest'
import type{Character}from'../../types/character'
import{DND5E_SRD_CLASS_DEFINITIONS,dnd5eClassDefinition}from'./classes'
import{normalizeDnd5eClassLevels,dnd5eCharacterClassLevel}from'./classLevels'
import{coreClassIdentities,normalizeCoreCharacterClassLevels,readSupportedCoreCharacterClassLevel}from'../../../shared/core-character-class-levels.mjs'
type NativeInput=Pick<Character,'charClass'|'level'|'dnd5eClassLevels'>
const native=(value:unknown)=>value as NativeInput
it('the finite Core class identities are the actual twelve Native ids and names, with no guessed aliases',()=>{
 expect(coreClassIdentities).toEqual(DND5E_SRD_CLASS_DEFINITIONS.map(d=>[d.id,d.name]));expect(coreClassIdentities).toHaveLength(12)
 for(const[id,name]of coreClassIdentities){expect(dnd5eClassDefinition(id)?.id).toBe(id);expect(dnd5eClassDefinition(name)?.id).toBe(id);expect(readSupportedCoreCharacterClassLevel({charClass:name,level:5},id)).toBe(5);expect(readSupportedCoreCharacterClassLevel({charClass:id,level:5},id)).toBe(5)}
 expect(dnd5eClassDefinition('WARLOCK')).toBeUndefined();expect(readSupportedCoreCharacterClassLevel({charClass:'WARLOCK',level:5},'warlock')).toBeUndefined()
})
it('Core normalization and supported class reads match the real Native implementation for missing maps, mismatch repair, finite truncation and multiclass records',()=>{
 for(const[id,name]of coreClassIdentities){const other=id==='fighter'?'wizard':'fighter',maps:unknown[]=[undefined,null,{}, {[id]:1},{[id]:5.9},{[id]:-2},{[id]:0},{[id]:30},{[id]:Number.NaN},{[id]:Number.POSITIVE_INFINITY},{[id]:'8'},{[other]:3},{[name]:4},{[id]:2,[other]:3},{wizard:3,warlock:2},{[other]:Number.NaN,[id]:3},{[other]:0,[id]:3}]
  for(const primary of[id,name])for(const map of maps){const c={charClass:primary,level:5,dnd5eClassLevels:map};expect(normalizeCoreCharacterClassLevels(c)).toEqual(normalizeDnd5eClassLevels(native(c)));for(const[query]of coreClassIdentities)expect(readSupportedCoreCharacterClassLevel(c,query)).toBe(dnd5eCharacterClassLevel(native(c),query))}
 }
 const fighter={charClass:'战士',level:5,dnd5eClassLevels:{warlock:5}},legacy={charClass:'邪术师',level:5};expect(readSupportedCoreCharacterClassLevel(fighter,'warlock')).toBe(0);expect(dnd5eCharacterClassLevel(native(fighter),'warlock')).toBe(0);expect(readSupportedCoreCharacterClassLevel(legacy,'warlock')).toBe(5);expect(dnd5eCharacterClassLevel(native(legacy),'warlock')).toBe(5)
})
it('unknown keys mirror an unregistered Core-only Native registry but never confer a policy grant for unsupported Host class identities',()=>{
 const cases=[{charClass:'warlock',level:5,dnd5eClassLevels:{'unknown-class':9,fighter:1}},{charClass:'warlock',level:5,dnd5eClassLevels:{'host.custom:rune-mage':9,fighter:1}},{charClass:'mystery-primary',level:5,dnd5eClassLevels:{warlock:5}},{charClass:'host.custom:rune-mage',level:5,dnd5eClassLevels:{warlock:5}}]
 for(const c of cases){expect(normalizeCoreCharacterClassLevels(c)).toEqual(normalizeDnd5eClassLevels(native(c)));expect(readSupportedCoreCharacterClassLevel(c,'warlock')).toBeUndefined()}
 expect(readSupportedCoreCharacterClassLevel({charClass:'warlock',level:5},'host.custom:rune-mage')).toBeUndefined();expect(readSupportedCoreCharacterClassLevel({charClass:'warlock',level:5},'made-up')).toBeUndefined();expect(readSupportedCoreCharacterClassLevel({charClass:'warlock',level:5,dnd5eClassLevels:[]},'warlock')).toBeUndefined()
})
