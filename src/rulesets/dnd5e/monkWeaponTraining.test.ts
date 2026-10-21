import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eContentBuildChoicesV1 } from './buildChoices'
import { DND5E_LONGSWORD, DND5E_LONGBOW, DND5E_WHIP, DND5E_LEATHER_ARMOR, DND5E_SHIELD,
  dnd5eMonkMartialArtsEligible, dnd5eMonkWeapon, dnd5eWeaponAttackProfile } from './equipment'
import type { Dnd5eAdvancementDefinitionV1 } from './activities/dnd5eAdvancementContracts'
const advancement: Dnd5eAdvancementDefinitionV1 = {schemaVersion:1,id:'weapon',kind:'select',level:3,label:'Weapon',count:1,
 options:[DND5E_LONGSWORD,DND5E_LONGBOW,DND5E_WHIP].map(w=>({id:w.id,label:w.name,grants:[
  {kind:'proficiency',category:'weapon',id:w.id},{kind:'tag',key:'monk-weapon',value:w.id}]}))}
const monk=(level=11)=>normalizeCharacter({id:'hero',charClass:'武僧',level,dnd5eClassLevels:{monk:level},
 abilities:{str:10,dex:18,con:12,int:10,wis:14,cha:10},equipment:{}})
const train=(character=monk(),weapon=DND5E_LONGSWORD.id,contentId='test:training')=>{
 const result=applyDnd5eContentBuildChoicesV1({character,contentId,advancements:[advancement],selections:{weapon:[weapon]}})
 expect(result.ok).toBe(true);if(!result.ok)throw Error('training failed');return result.character
}
it('uses selected weapon training, proficiency and martial arts after JSON reload',()=>{
 const character=normalizeCharacter(JSON.parse(JSON.stringify(train())))
 character.equipment={mainWeapon:DND5E_LONGSWORD}
 expect(dnd5eMonkMartialArtsEligible(character)).toBe(true)
 expect(dnd5eWeaponAttackProfile(character,{forceOneHanded:true})).toMatchObject({attackAbility:'dex',proficient:true,attackModifier:8,damage:{sides:8,bonus:4}})
 const magic={...DND5E_LONGSWORD,id:'test:magic-sword',baseEquipmentId:DND5E_LONGSWORD.id}
 expect(dnd5eMonkWeapon(character,magic)).toBe(true)
 expect(dnd5eMonkWeapon(character,DND5E_LONGBOW)).toBe(false)
})
it.each([[3,4],[5,6],[11,8],[17,10]])('uses monk level %s for the selected whip die', (level,sides)=>{
 const character=train(monk(level),DND5E_WHIP.id);character.equipment={mainWeapon:DND5E_WHIP}
 expect(dnd5eWeaponAttackProfile(character)?.damage.sides).toBe(sides)
})
it('keeps longbow dexterity and prohibits armor, shields and other held non-monk weapons',()=>{
 const character=train(monk(),DND5E_LONGBOW.id);character.abilities.str=20;character.equipment={mainWeapon:DND5E_LONGBOW}
 expect(dnd5eMonkMartialArtsEligible(character)).toBe(true)
 expect(dnd5eWeaponAttackProfile(character)?.attackAbility).toBe('dex')
 for(const patch of [{armor:DND5E_LEATHER_ARMOR},{offHand:DND5E_SHIELD},{offHand:DND5E_LONGSWORD}])
  expect(dnd5eMonkMartialArtsEligible({...character,equipment:{...character.equipment,...patch}})).toBe(false)
 const fighter={...character,charClass:'战士',dnd5eClassLevels:{fighter:11}}
 expect(dnd5eMonkMartialArtsEligible(fighter)).toBe(false)
})
it('does not train an absent option or spend a new choice on previously selected weapon types',()=>{
 const character=train()
 const attempt=(contentId:string,weapon:string)=>applyDnd5eContentBuildChoicesV1({character,contentId,advancements:[advancement],selections:{weapon:[weapon]}})
 expect(attempt('test:training','dnd5e-greatsword').ok).toBe(false)
 expect(attempt('test:later',DND5E_LONGSWORD.id).ok).toBe(false)
 expect(attempt('test:training',DND5E_LONGSWORD.id).ok).toBe(true)
 expect(attempt('test:later',DND5E_LONGBOW.id).ok).toBe(true)
})
