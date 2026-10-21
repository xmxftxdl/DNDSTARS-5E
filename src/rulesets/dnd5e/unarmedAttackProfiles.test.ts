import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {dnd5eUnarmedAttackProfiles,DND5E_UNARMED_ATTACK_ID,DND5E_SHORTSWORD} from './equipment'
it('offers a normal unarmed attack without removing a held weapon or inventing damage dice',()=>{
 const character=normalizeCharacter({id:'fighter',charClass:'战士',level:3,abilities:{str:16,dex:12,con:10,int:10,wis:10,cha:10},equipment:{mainWeapon:DND5E_SHORTSWORD}})
 const before=JSON.stringify(character)
 const profile=dnd5eUnarmedAttackProfiles(character).find(p=>p.weaponId===DND5E_UNARMED_ATTACK_ID)!
 expect(profile).toMatchObject({attackAbility:'str',attackModifier:5,damage:{count:0,bonus:4,type:'bludgeoning'},magical:false})
 expect(JSON.stringify(character)).toBe(before)
})
it.each([3,6])('uses Martial Arts and ki-empowered strike at monk level %s',level=>{
 const character=normalizeCharacter({id:'monk',charClass:'武僧',level,dnd5eClassLevels:{monk:level},abilities:{str:10,dex:18,con:10,int:10,wis:14,cha:10},equipment:{mainWeapon:DND5E_SHORTSWORD}})
 const profile=dnd5eUnarmedAttackProfiles(character).find(p=>p.weaponId===DND5E_UNARMED_ATTACK_ID)!
 expect(profile).toMatchObject({attackAbility:'dex',damage:{count:1,sides:level===3?4:6,bonus:4,type:'bludgeoning'},magical:level>=6})
})
