import {expect,it} from 'vitest'
import {authorDnd5eMapInventoryItem} from './mapInventoryItemAuthoring'
import {normalizeDnd5eMapObjectStateV1} from './mapObjectState'
import type {Token} from '../../store/maps'
const original:Token={id:'water',label:'Water',type:'obstacle',size:1,x:25,y:25,color:'',emoji:'',
 dnd5eObjectState:{schemaVersion:1,consumable:{kind:'drink',contaminants:['poison']}}}
it('authors exact registered identity and quantity without clearing independent state or changing the token',()=>{
 const before=structuredClone(original),patch=authorDnd5eMapInventoryItem(original,'srd-5.1:item:gold-dust-25gp',3)!
 expect(original).toEqual(before)
 expect(patch.dnd5eObjectState?.inventoryItem).toMatchObject({templateId:'srd-5.1:item:gold-dust-25gp',quantity:3})
 expect(normalizeDnd5eMapObjectStateV1(patch.dnd5eObjectState)).toMatchObject(patch.dnd5eObjectState!)
 const token={...original,...patch},receipt=patch.dnd5eObjectState!.inventoryItem!.receiptId
 expect(authorDnd5eMapInventoryItem(token,'srd-5.1:item:gold-dust-25gp',2)?.dnd5eObjectState?.inventoryItem?.receiptId).toBe(receipt)
 expect(authorDnd5eMapInventoryItem(token,'srd-5.1:item:holy-water-flask',1)?.dnd5eObjectState?.inventoryItem?.receiptId).not.toBe(receipt)
 expect(authorDnd5eMapInventoryItem(token,'')?.dnd5eObjectState).toMatchObject({consumable:{contaminants:['poison']}})
 expect(authorDnd5eMapInventoryItem(token,'')?.dnd5eObjectState?.inventoryItem).toBeUndefined()
})
it.each([0,1.5,NaN,1001])('rejects invalid quantity %s without a patch',quantity=>expect(authorDnd5eMapInventoryItem(original,'srd-5.1:item:holy-water-flask',quantity)).toBeUndefined())
it('refuses unknown templates, creature tokens and generated spell objects',()=>{
 expect(authorDnd5eMapInventoryItem(original,'missing:water')).toBeUndefined()
 expect(authorDnd5eMapInventoryItem({...original,type:'player'},'srd-5.1:item:holy-water-flask')).toBeUndefined()
 expect(authorDnd5eMapInventoryItem({...original,dnd5eSpellEffect:{spellId:'light'} as Token['dnd5eSpellEffect']},'srd-5.1:item:holy-water-flask')).toBeUndefined()
})
