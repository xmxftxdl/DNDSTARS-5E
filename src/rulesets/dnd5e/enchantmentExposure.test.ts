import {expect,it} from 'vitest'
import {projectCharactersForRoomMember,mergePlayerCharactersStateForAuthority} from '../../../scripts/shared-server-core.mjs'
import {normalizeCharacter} from '../../store/characters'
import {applyDnd5eInventoryMutation} from './items'
import {dnd5eActivityInventorySelectionOptions} from './activities/dnd5eActivityInventorySelection'
import {DND5E_NATIVE_SUBCLASS_REST_EXAMPLE} from './activities/dnd5eNativeSubclassAuthoringExample'
import {sanitizeDnd5ePlayerInventoryMutation} from '../../lib/inventoryAuthority'

it('publishes only owner-offered selection identities, preserves private inventory and retracts hints',()=>{
 const owner=normalizeCharacter({id:'owner',name:'Owner',roomMemberId:'other',equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]}} as any)
 const granted=applyDnd5eInventoryMutation([owner],{type:'grant',characterId:'owner',templateId:'srd-5.1:equipment:dnd5e-chain-mail',quantity:1})
 expect(granted.ok).toBe(true)
 const instanceId=granted.characters[0].dnd5eInventory!.entries[0].instanceId
 const show={type:'set-enchantment-exposure' as const,characterId:'owner',instanceId,exposed:true}
 const shown=applyDnd5eInventoryMutation(granted.characters,show);expect(shown.ok).toBe(true)
 expect(applyDnd5eInventoryMutation(shown.characters,show).characters).toEqual(shown.characters)
 const project=(characters:any[])=>projectCharactersForRoomMember({characters},{memberId:'viewer'} as any).characters[0]
 expect(project(granted.characters).dnd5eExposedEnchantmentItems).toEqual([])
 const projected=normalizeCharacter(project(shown.characters)),hint=projected.dnd5eExposedEnchantmentItems![0]
 expect(Object.keys(hint).sort()).toEqual(['equipped','instanceId','kind','revision'])
 expect(projected.dnd5eInventory?.entries).toEqual([])
 expect(JSON.stringify(projected.dnd5eExposedEnchantmentItems)).not.toContain('chain-mail')
 const normalized=normalizeCharacter(JSON.parse(JSON.stringify(projected)))
 const activity=structuredClone(DND5E_NATIVE_SUBCLASS_REST_EXAMPLE)
 const operation=activity.outcomes[0].operations[0]
 if(operation.kind!=='apply-effect')throw Error('expected effect operation')
 operation.target='target'
 const options=dnd5eActivityInventorySelectionOptions(activity,undefined,normalizeCharacter({id:'viewer',name:'Viewer'}),[normalized])
 expect(options).toHaveLength(1);expect(options[0]).toMatchObject({ownerId:'owner',instanceId,revision:hint.revision})
 const hidden=applyDnd5eInventoryMutation(shown.characters,{...show,exposed:false});expect(hidden.ok).toBe(true)
 expect(project(hidden.characters).dnd5eExposedEnchantmentItems).toEqual([])
 expect(hidden.characters[0].dnd5eInventory!.revision).toBeGreaterThan(hint.revision)
 expect(sanitizeDnd5ePlayerInventoryMutation({...show,item:{secret:'forged'}} as any)).toEqual(show)
 const forged={id:'owner',roomMemberId:'viewer',dnd5eExposedEnchantmentItems:[hint]}
 expect(mergePlayerCharactersStateForAuthority({characters:[]},{characters:[forged]},'viewer').characters[0].dnd5eExposedEnchantmentItems).toBeUndefined()
 expect(mergePlayerCharactersStateForAuthority({characters:[{id:'owner',roomMemberId:'viewer'}]},{characters:[forged]},'viewer').characters[0].dnd5eExposedEnchantmentItems).toBeUndefined()
})
