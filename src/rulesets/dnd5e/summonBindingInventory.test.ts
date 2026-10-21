import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {applyDnd5eInventoryMutation,normalizeDnd5eInventory} from './items'

it('keeps an issued binding separate and preserves it through inventory normalization',()=>{
 const actor=normalizeCharacter({id:'owner',name:'Owner'})
 const base={type:'grant' as const,characterId:actor.id,templateId:'srd-5.1:item:component-pouch',quantity:1}
 const plain=applyDnd5eInventoryMutation([actor],base)
 expect(plain.ok).toBe(true)
 const bound=applyDnd5eInventoryMutation(plain.characters,{...base,summonBinding:{tagPrefix:'infernal-talisman',monsterId:'srd-5.1:imp'}})
 expect(bound.ok).toBe(true)
 const inventory=normalizeDnd5eInventory(JSON.parse(JSON.stringify(bound.characters[0])))
 expect(inventory.entries).toHaveLength(normalizeDnd5eInventory(plain.characters[0]).entries.length+1)
 expect(inventory.entries.filter(e=>e.item.spellcastingMaterial?.tags.includes('infernal-talisman:srd-5.1:imp'))).toHaveLength(1)
 expect(inventory.entries.find(e=>e.templateId===base.templateId)?.item.spellcastingMaterial?.tags??[]).not.toContain('infernal-talisman:srd-5.1:imp')
 for(const binding of [{tagPrefix:'invalid prefix',monsterId:'srd-5.1:imp'},{tagPrefix:'infernal-talisman',monsterId:'missing'}]){
  expect(applyDnd5eInventoryMutation([actor],{...base,summonBinding:binding}).ok).toBe(false)
 }
})
