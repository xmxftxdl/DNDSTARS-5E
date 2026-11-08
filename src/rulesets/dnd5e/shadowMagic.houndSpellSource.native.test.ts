import {expect,it} from'vitest'
import {nativeSummonedHound} from'./shadowMagic.summonedHound.native.fixture'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from'./spellAction'
import {dnd5eSelectedSpellIdsForClass} from'./spells'

for(const near of[true,false])it(`actual archived/lawful Sorcerer6 Hound then real Poison Spray native producer: chosen target save ${near?'disadvantage':'normal outside5ft'}`,async()=>{
 const f=await nativeSummonedHound();try{
  const map=structuredClone(f.map),characters=structuredClone(f.characters),caster=characters.find(c=>c.id==='soul')!,hound=map.tokens.find(t=>t.id===f.houndId)!
  expect(caster.dnd5ePluginFeatureIds??[]).toEqual([]);expect(dnd5eSelectedSpellIdsForClass(caster,'sorcerer')).toContain('poison-spray')
  if(!near)hound.x=225
  const order=map.tokens.map((token,i)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''})),action:any={id:'actual-caster-poison-spray-'+near,mapId:map.id,combatId:'actual-hound-spell-source',sourceMode:'player',status:'pending',actorTokenId:'soul-token',characterId:'soul',targetTokenId:'foe-token',type:'dnd5e-spell-cast',round:1,initiativeIndex:1,seq:2,updatedAt:2,dnd5eSpellCast:{spellId:'poison-spray',slotLevel:0,castingClassId:'sorcerer',targetTokenId:'foe-token'}}
  const input={map,characters,action,initiativeOrder:order},original=structuredClone(input),prepared=prepareDnd5eSpellCast(input);expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  const p=prepared.prepared;expect(p.savingThrow?.mode).toBe(near?'disadvantage':'normal');expect(p.spell.id).toBe('poison-spray');expect(p.actorToken.id).toBe('soul-token')
  const beforePoints=p.state.combatants['soul-token'].classResources['dnd5e-sorcery-points'].current
  if(near){const missing=resolvePreparedDnd5eSpellCast({prepared:p,savingThrowD20:18,effectRolls:[1,1]});expect(missing.result.ok).toBe(false)}
  const resolved=resolvePreparedDnd5eSpellCast({prepared:p,savingThrowD20:18,...(near?{savingThrowD20Second:2}:{}),effectRolls:near?[1,1]:[]});expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true)
  expect(resolved.result.state.combatants['foe-token'].currentHp).toBe(near?8:10);expect(resolved.result.state.combatants['soul-token'].classResources['dnd5e-sorcery-points'].current).toBe(beforePoints);expect(resolved.result.state.combatants['soul-token'].turn.actionAvailable).toBe(false);expect(input).toEqual(original)
 }finally{f.dispose()}
})
