import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {applyDnd5eInventoryMutation,normalizeDnd5eInventory} from './items'
import {sanitizeDnd5ePlayerInventoryMutation} from '../../lib/inventoryAuthority'

const fixture=()=>{
 const owner=normalizeCharacter({id:'owner',name:'Owner',charClass:'战士',equipment:{},dnd5eInventory:{schemaVersion:3,revision:0,entries:[]}} as any)
 const packed=applyDnd5eInventoryMutation([owner],{type:'grant',characterId:'owner',templateId:'srd-5.1:item:backpack',quantity:1})
 const granted=applyDnd5eInventoryMutation(packed.characters,{type:'grant',characterId:'owner',templateId:'srd-5.1:equipment:dnd5e-club',quantity:1})
 expect(granted.ok).toBe(true)
 const entry=granted.characters[0].dnd5eInventory!.entries.find(e=>e.templateId==='srd-5.1:equipment:dnd5e-club')!
 entry.surfaceProfile={surfaceId:'carved-stone',material:'stone',widthFeet:0.5,lengthFeet:1,heightFeet:0.5,rotationDegrees:0}
 return {characters:granted.characters,instanceId:entry.instanceId}
}
it('persists an explicit surface exposure, handles replay and hides it without altering the physical item',()=>{
 const {characters,instanceId}=fixture(),before=structuredClone(characters)
 const show={type:'set-surface-exposure' as const,characterId:'owner',instanceId,exposed:true}
 const shown=applyDnd5eInventoryMutation(characters,show)
 expect(shown.ok).toBe(true)
 const entry=normalizeDnd5eInventory(JSON.parse(JSON.stringify(shown.characters[0]))).entries.find(e=>e.instanceId===instanceId)!
 expect(entry.surfaceExposed).toBe(true)
 expect(entry.surfaceProfile?.surfaceId).toBe('carved-stone')
 const replay=applyDnd5eInventoryMutation(shown.characters,show)
 expect(replay.characters).toEqual(shown.characters)
 const hidden=applyDnd5eInventoryMutation(shown.characters,{...show,exposed:false})
 expect(hidden.ok).toBe(true)
 expect(hidden.characters[0].dnd5eInventory!.entries.find(e=>e.instanceId===instanceId)?.surfaceExposed).toBeUndefined()
 expect(characters).toEqual(before)
})
it.each(['container','stack','destroyed','missing-surface','wrong-owner','malformed'] as const)('rejects ineligible exposed surfaces: %s',kind=>{
 const {characters,instanceId}=fixture(),entry=characters[0].dnd5eInventory!.entries.find(e=>e.instanceId===instanceId)!
 if(kind==='container')entry.containerInstanceId=characters[0].dnd5eInventory!.entries.find(e=>e.templateId==='srd-5.1:item:backpack')!.instanceId
 if(kind==='stack')entry.quantity=2
 if(kind==='destroyed')entry.condition={destroyed:true} as any
 if(kind==='missing-surface')entry.surfaceProfile=undefined
 const before=structuredClone(characters)
 const result=applyDnd5eInventoryMutation(characters,{type:'set-surface-exposure',characterId:kind==='wrong-owner'?'other':'owner',instanceId,exposed:kind==='malformed'?'true':true} as any)
 expect(result.ok).toBe(false)
 expect(characters).toEqual(before)
})
it('does not carry an exposure into a container or transfer it to another owner',()=>{
 const {characters,instanceId}=fixture()
 const shown=applyDnd5eInventoryMutation(characters,{type:'set-surface-exposure',characterId:'owner',instanceId,exposed:true})
 const granted=applyDnd5eInventoryMutation(shown.characters,{type:'grant',characterId:'owner',templateId:'srd-5.1:item:backpack',quantity:1})
 const pack=granted.characters[0].dnd5eInventory!.entries.find(e=>e.templateId==='srd-5.1:item:backpack')!
 const stored=applyDnd5eInventoryMutation(granted.characters,{type:'set-container',characterId:'owner',instanceId,containerInstanceId:pack.instanceId})
 expect(stored.ok).toBe(true)
 expect(stored.characters[0].dnd5eInventory!.entries.find(e=>e.instanceId===instanceId)?.surfaceExposed).toBeUndefined()
 const other=normalizeCharacter({id:'other',name:'Other',equipment:{}} as any)
 const moved=applyDnd5eInventoryMutation([...shown.characters,other],{type:'transfer',characterId:'owner',targetCharacterId:'other',instanceId,quantity:1})
 expect(moved.ok).toBe(true)
 const received=moved.characters[1].dnd5eInventory!.entries.find(e=>e.surfaceProfile?.surfaceId==='carved-stone')
 expect(received).toBeDefined()
 expect(received?.surfaceExposed).toBeUndefined()
})
it('takes only exposure intent from the player, never supplied surface geometry',()=>{
 expect(sanitizeDnd5ePlayerInventoryMutation({type:'set-surface-exposure',characterId:'owner',instanceId:'item',exposed:true,
  surfaceProfile:{material:'stone',widthFeet:999}} as any)).toEqual({type:'set-surface-exposure',characterId:'owner',instanceId:'item',exposed:true})
})
it('assigns and persists surface identity before a displayed item changes owners',()=>{
 const {characters,instanceId}=fixture()
 const entry=characters[0].dnd5eInventory!.entries.find(e=>e.instanceId===instanceId)!
 delete entry.surfaceProfile!.surfaceId
 const shown=applyDnd5eInventoryMutation(characters,{type:'set-surface-exposure',characterId:'owner',instanceId,exposed:true})
 expect(shown.ok).toBe(true)
 const other=normalizeCharacter({id:'other',name:'Other',equipment:{}} as any)
 const moved=applyDnd5eInventoryMutation([...shown.characters,other],{type:'transfer',characterId:'owner',targetCharacterId:'other',instanceId,quantity:1})
 expect(moved.ok).toBe(true)
 expect(moved.characters[1].dnd5eInventory!.entries.some(e=>e.surfaceProfile?.surfaceId===`inventory:${instanceId}`)).toBe(true)
})
