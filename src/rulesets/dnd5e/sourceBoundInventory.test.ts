import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryGrantBundle, applyDnd5eInventoryMutation, expireDnd5eSourceBoundInventory } from './items'
import { compileDnd5eActivityPatternV1 } from './activities/dnd5eActivityPatterns'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './activities/dnd5eActivityExecutor'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { createDnd5eMechanicalEffect } from './activeEffects'
import type { BattleMap } from '../../store/maps'
import { reconcileDnd5eCharacterCampaignTime, reconcileDnd5eCampaignRosterSourceEffects } from './campaignTimeRules'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'

const templateId = 'srd-5.1:equipment:dnd5e-longsword'
const firstTag = 'item-lease:11111111-1111-1111-1111-111111111111'
const secondTag = 'item-lease:22222222-2222-2222-2222-222222222222'
const empty = (id: string) => normalizeCharacter({id,name:id,equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}})

describe('source-owned generated inventory', () => {
  it('places a granted weapon into a free hand without replacing gear and rejects a full-hand batch atomically', () => {
    const actor=empty('caster')
    const grant={templateId,quantity:1,equipToFreeHand:true as const}
    const first=applyDnd5eInventoryGrantBundle([actor],{characterId:actor.id,receiptId:'hand-1',grants:[grant]})
    expect(first.ok).toBe(true)
    expect(first.characters[0].dnd5eInventory?.entries[0].equippedSlot).toBe('mainWeapon')
    const offHandGrant={...grant,templateId:'srd-5.1:equipment:dnd5e-dagger-offhand'}
    const second=applyDnd5eInventoryGrantBundle(first.characters,{characterId:actor.id,receiptId:'hand-2',grants:[offHandGrant]})
    expect(second.ok).toBe(true)
    expect(second.characters[0].dnd5eInventory?.entries.map(entry=>entry.equippedSlot)).toEqual(['mainWeapon','offHand'])
    const before=structuredClone(second.characters)
    const third=applyDnd5eInventoryGrantBundle(second.characters,{characterId:actor.id,receiptId:'hand-3',grants:[grant]})
    expect(third.ok).toBe(false)
    expect(third.characters).toEqual(before)
    expect(second.characters).toEqual(before)
    const batch=applyDnd5eInventoryGrantBundle([actor],{characterId:actor.id,receiptId:'three-hands',grants:[grant,offHandGrant,grant]})
    expect(batch.ok).toBe(false)
    expect(batch.characters).toEqual([actor])
    const replay=applyDnd5eInventoryGrantBundle(first.characters,{characterId:actor.id,receiptId:'hand-1',grants:[grant]})
    expect(replay.ok).toBe(true);expect(replay.deduplicated).toBe(true)
    expect(replay.characters[0].dnd5eInventory?.entries).toHaveLength(1)
  })
  it.each([false, true])('cleans split transferred stacks after campaign expiry independently of roster order, reversed=%s', reversed => {
    const parent = createDnd5eMechanicalEffect({ id: 'timer', definitionId: 'timer', label: 'Timer', targetId: 'caster',
      source: { kind: 'spell', actorId: 'caster' }, duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' }, modifiers: {} })
    parent.tags = [firstTag]
    const other = createDnd5eMechanicalEffect({ id: 'other', definitionId: 'other', label: 'Other', targetId: 'caster',
      source: { kind: 'spell', actorId: 'caster' }, duration: { type: 'permanent' }, modifiers: {} })
    other.tags = [secondTag]
    const caster = { ...empty('caster'), dnd5eWorldTimeAppliedMinute: 0, dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [parent, other] } }
    const arrows = 'srd-5.1:item:arrows'
    let characters = applyDnd5eInventoryGrantBundle([caster, empty('holder'), empty('third')], { characterId: 'caster', receiptId: 'stacks',
      grants: [{ templateId: arrows, quantity: 3, sourceEffectTag: firstTag }, { templateId: arrows, quantity: 2, sourceEffectTag: secondTag }, { templateId: arrows, quantity: 4 }] }).characters
    const id = characters[0].dnd5eInventory!.entries.find(entry => entry.sourceEffectTag === firstTag)!.instanceId
    characters = applyDnd5eInventoryMutation(characters, { type: 'transfer', characterId: 'caster', targetCharacterId: 'holder', instanceId: id, quantity: 2 }).characters
    const held = characters[1].dnd5eInventory!.entries.find(entry => entry.sourceEffectTag === firstTag)!
    characters = applyDnd5eInventoryMutation(characters, { type: 'transfer', characterId: 'holder', targetCharacterId: 'third', instanceId: held.instanceId, quantity: 1 }).characters
    characters = characters.map(character => normalizeCharacter(JSON.parse(JSON.stringify(character))))
    const clock: SharedCampaignTimeState = { schemaVersion: 2, worldMinute: 1, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1 }
    const reconciled = characters.map(character => reconcileDnd5eCharacterCampaignTime(character, clock))
    const partial = reconcileDnd5eCampaignRosterSourceEffects(reconciled.filter(result => result.character.id !== 'caster'))
    expect(partial.flatMap(result => result.character.dnd5eInventory?.entries ?? []).filter(entry => entry.sourceEffectTag === firstTag)).toHaveLength(2)
    const result = reconcileDnd5eCampaignRosterSourceEffects(reversed ? reconciled.toReversed() : reconciled)
    expect(result.flatMap(row => row.character.dnd5eInventory?.entries ?? []).filter(entry => entry.sourceEffectTag === firstTag)).toHaveLength(0)
    const saved = result.find(row => row.character.id === 'caster')!.character
    expect(saved.dnd5eInventory?.entries.find(entry => entry.sourceEffectTag === secondTag)?.quantity).toBe(2)
    expect(saved.dnd5eInventory?.entries.find(entry => !entry.sourceEffectTag)?.quantity).toBe(4)
    for (const id of ['holder', 'third']) expect(result.find(row => row.character.id === id)?.changed).toBe(true)
    expect(reconcileDnd5eCampaignRosterSourceEffects(result)).toEqual(result)
  })
  it('removes transferred items when the authoritative map result ends the source, despite a stale token mirror', () => {
    const parent = createDnd5eMechanicalEffect({id:'source',definitionId:'source',label:'Source',targetId:'caster',duration:{type:'permanent'},source:{kind:'spell',actorId:'caster',rulesId:'source'},modifiers:{}})
    parent.tags = [firstTag]
    const caster = {...empty('caster'),dnd5eCombatState:{schemaVersion:2 as const,activeEffects:[parent]}}
    const generated = applyDnd5eInventoryGrantBundle([caster,empty('holder')],{characterId:'caster',receiptId:'map',grants:[{templateId,quantity:1,sourceEffectTag:firstTag}]})
    const transferred = applyDnd5eInventoryMutation(generated.characters,{type:'transfer',characterId:'caster',targetCharacterId:'holder',instanceId:generated.characters[0].dnd5eInventory!.entries[0].instanceId,quantity:1})
    const map: BattleMap = {id:'map',name:'Map',width:100,height:100,gridSize:10,gridOffsetX:0,gridOffsetY:0,showGrid:true,feetPerCell:5,tokens:[{id:'caster-token',characterId:'caster',label:'Caster',x:0,y:0,color:'',emoji:'',size:1,type:'player',dnd5eCombatState:caster.dnd5eCombatState}]}
    const snapshot = createDnd5eMapCombatSnapshot({combatId:'combat',map,characters:transferred.characters,initiativeOrder:[{tokenId:'caster-token',label:'Caster',emoji:'',color:'',roll:10}]})
    snapshot.state.combatants['caster-token'].classState.activeEffects=[]
    const projected=planDnd5eMapResultApplication({map,characters:transferred.characters,state:snapshot.state,characterIdByCombatantId:snapshot.characterIdByCombatantId})
    expect(projected.characters[1].dnd5eInventory!.entries).toHaveLength(0)
    expect(projected.characterPatches!.holder.dnd5eInventory!.entries).toHaveLength(0)
  })
  it('preserves the generation through transfer and persistence, then removes it including equipped projection', () => {
    let characters = applyDnd5eInventoryGrantBundle([empty('caster'),empty('holder')],{characterId:'caster',receiptId:'create',grants:[{templateId,quantity:1,sourceEffectTag:firstTag},{templateId,quantity:1}]}).characters
    const id=characters[0].dnd5eInventory!.entries.find(entry=>entry.sourceEffectTag)!.instanceId
    const moved=applyDnd5eInventoryMutation(characters,{type:'transfer',characterId:'caster',targetCharacterId:'holder',instanceId:id,quantity:1})
    expect(moved.ok).toBe(true)
    const held=moved.characters[1].dnd5eInventory!.entries[0]
    expect(held).toMatchObject({sourceEffectTag:firstTag,sourceEffectOwnerId:'caster'})
    const equipped=applyDnd5eInventoryMutation(moved.characters,{type:'equip',characterId:'holder',instanceId:held.instanceId,slot:'mainWeapon'})
    expect(equipped.ok).toBe(true)
    const persisted=normalizeCharacter(JSON.parse(JSON.stringify(equipped.characters[1])))
    expect(expireDnd5eSourceBoundInventory(persisted,new Set([firstTag]))).toBe(persisted)
    // Incomplete authority snapshots must not delete another caster's items.
    expect(expireDnd5eSourceBoundInventory(persisted,new Set(),new Set(['holder']))).toBe(persisted)
    const ended=expireDnd5eSourceBoundInventory(persisted,new Set())
    expect(ended.dnd5eInventory?.entries).toHaveLength(0)
    expect(ended.equipment?.mainWeapon).toBeUndefined()
    expect(expireDnd5eSourceBoundInventory(equipped.characters[0],new Set()).dnd5eInventory?.entries).toHaveLength(1)
  })
  it('keeps a new casting distinct and honors grant replay receipts', () => {
    const first=applyDnd5eInventoryGrantBundle([empty('caster')],{characterId:'caster',receiptId:'first',grants:[{templateId,quantity:1,sourceEffectTag:firstTag}]})
    const second=applyDnd5eInventoryGrantBundle(first.characters,{characterId:'caster',receiptId:'second',grants:[{templateId,quantity:1,sourceEffectTag:secondTag}]})
    const current=expireDnd5eSourceBoundInventory(second.characters[0],new Set([secondTag]))
    expect(current.dnd5eInventory?.entries).toHaveLength(1)
    expect(current.dnd5eInventory?.entries[0].sourceEffectTag).toBe(secondTag)
    const replay=applyDnd5eInventoryGrantBundle([current],{characterId:'caster',receiptId:'second',grants:[{templateId,quantity:1,sourceEffectTag:firstTag}]})
    expect(replay.deduplicated).toBe(true)
    expect(replay.characters[0].dnd5eInventory?.entries).toHaveLength(1)
  })
  it('binds only to an actor effect actually produced by the same execution', () => {
    const activity=compileDnd5eActivityPatternV1({schemaVersion:1,id:'create-weapon',source:{kind:'spell',id:'create-weapon'},name:'Create weapon',target:{kind:'self'},pattern:'timed-effect',recipient:'actor',effect:{schemaVersion:1,id:'lease',name:'Lease',duration:{kind:'concentration',maximumRounds:10},concentration:true,stacking:'unique-by-source'}})
    activity.outcomes=[...activity.outcomes,{id:'grant',when:{kind:'always'},operations:[{id:'weapon',kind:'grant-inventory-item',target:'actor',templateId,quantity:{kind:'constant',value:1},sourceEffectId:'lease'}]}]
    const actor:Dnd5eActivityActorSnapshot={id:'caster',controller:'players',level:5,proficiencyBonus:3,abilities:{str:10,dex:16,con:12,int:18,wis:10,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20}
    const resolve=()=>resolveDnd5eActivity({activity,actor,targets:[actor],rolls:{}})
    const result=resolve()
    expect(result.ok,JSON.stringify(result)).toBe(true)
    if(!result.ok) throw new Error(JSON.stringify(result))
    const grant=result.proposals.find(proposal=>proposal.kind==='grant-inventory-item')
    expect(grant?.kind).toBe('grant-inventory-item')
    if(grant?.kind!=='grant-inventory-item')throw new Error('missing grant')
    expect(grant.sourceEffectTag).toMatch(/^item-lease:/)
    expect(result.proposals.find(proposal=>proposal.kind==='apply-effect')).toMatchObject({tags:[grant.sourceEffectTag]})
    activity.outcomes=activity.outcomes.slice(1)
    expect(resolve().ok).toBe(false)
  })
})
