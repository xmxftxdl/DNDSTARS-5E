import { describe, expect, it } from 'vitest'
import { normalizeCharacter, useCharacterStore } from '../../store/characters'
import { createDnd5eMechanicalEffect, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { applyDnd5eLongRestBenefits, reconcileDnd5eSourceEffectLifecycles, reconcileDnd5eCampaignRosterSourceEffects } from './campaignTimeRules'
function roster(marker:number|null|undefined=120){
 const source=normalizeCharacter({id:'source',name:'Source',charClass:'牧师',level:1,dnd5eLastLongRestWorldMinute:120})
 const effect=createDnd5eMechanicalEffect({id:'bound',definitionId:'source-binding',label:'Bound',source:{kind:'feature',actorId:'old-token',characterId:'source',lastLongRestWorldMinute:marker},targetId:'bearer',duration:{type:'permanent'},breakOn:['source-long-rest-complete','source-dies'],modifiers:{armorClassBonus:1}})
 const child=createDnd5eMechanicalEffect({id:'child',definitionId:'child',label:'Child',source:{kind:'feature',actorId:'source'},targetId:'bearer',dependsOnEffectId:'bound',modifiers:{speedBonusFeet:5}})
 const unrelated=createDnd5eMechanicalEffect({id:'other',definitionId:'other',label:'Other',source:{kind:'feature',actorId:'other'},targetId:'bearer',modifiers:{armorClassBonus:1}})
 const bearer=normalizeCharacter({id:'bearer',name:'Bearer',charClass:'战士',level:1,dnd5eCombatState:{schemaVersion:2,activeEffects:[effect,child,unrelated]},tempHp:5})
 bearer.dnd5eCombatState!.temporaryHitPointsSource={actorId:'old-token',rulesId:'bound',effectDefinitionId:'source-binding'}
 return [source,bearer]
}
const ids=(character:ReturnType<typeof normalizeCharacter>)=>character.dnd5eCombatState?.activeEffects?.map(effect=>effect.id)
describe('cross-character source lifetime reconciliation',()=>{
 it('does not confuse old source rests or the bearer rest with a new source rest',()=>{
  const characters=roster(),before=structuredClone(characters)
  expect(reconcileDnd5eSourceEffectLifecycles(characters)).toEqual(characters)
  const bearerRested=[characters[0],applyDnd5eLongRestBenefits(characters[1],2000)]
  expect(ids(reconcileDnd5eSourceEffectLifecycles(bearerRested)[1])).toContain('bound')
  const sourceRested=[applyDnd5eLongRestBenefits(characters[0],2000),characters[1]]
  const reconciled=reconcileDnd5eSourceEffectLifecycles(sourceRested)
  expect(ids(reconciled[1])).toEqual(['other'])
  expect(reconciled[1].tempHp).toBe(0)
  expect(reconciled[1].dnd5eCombatState?.temporaryHitPointsSource).toBeUndefined()
  expect(characters).toEqual(before)
  expect(reconcileDnd5eSourceEffectLifecycles(reconciled)).toEqual(reconciled)
 })
 it('expires a no-prior-rest watermark but preserves missing source evidence',()=>{
  expect(ids(reconcileDnd5eSourceEffectLifecycles(roster(null))[1])).toEqual(['other'])
  const unknown=roster();delete unknown[1].dnd5eCombatState!.activeEffects![0].source.lastLongRestWorldMinute
  expect(ids(reconcileDnd5eSourceEffectLifecycles(unknown)[1])).toContain('bound')
  expect(ids(reconcileDnd5eSourceEffectLifecycles([roster()[1]])[0])).toContain('bound')
 })
 it('clears confirmed deaths outside combat but keeps an unconscious living source',()=>{
  const characters=roster();characters[0].currentHp=0;characters[0].deathSaveFailures=2
  expect(ids(reconcileDnd5eSourceEffectLifecycles(characters)[1])).toContain('bound')
  characters[0].deathSaveFailures=3
  expect(ids(reconcileDnd5eSourceEffectLifecycles(characters)[1])).toEqual(['other'])
 })
 it('runs after the whole roster so order and previously unchanged bearer results do not conceal expiry',()=>{
  const characters=roster();characters[0]=applyDnd5eLongRestBenefits(characters[0],2000)
  for(const order of [characters,[...characters].reverse()]){
   const results=reconcileDnd5eCampaignRosterSourceEffects(order.map(character=>({character,changed:character.id==='source',dawnsApplied:0,longRestsApplied:character.id==='source'?1:0,longRestsBlocked:0})))
   expect(ids(results.find(result=>result.character.id==='bearer')!.character)).toEqual(['other'])
   expect(results.find(result=>result.character.id==='bearer')!.changed).toBe(true)
  }
 })
 it('rejects a corrupted persisted source watermark',()=>{
  const effects=structuredClone(roster()[1].dnd5eCombatState!.activeEffects!)
  effects[0].source.lastLongRestWorldMinute=-1
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(false)
 })
})

it('applies source expiry through the production character-store reconciliation entry',()=>{
 const prior=useCharacterStore.getState()
 try{
  const characters=roster();characters[0].dnd5eLastLongRestWorldMinute=2000
  useCharacterStore.setState({characters,selectedId:'source'})
  const result=useCharacterStore.getState().reconcileCampaignTime({schemaVersion:2,worldMinute:0,displayMode:'campaign-day',displayMinuteOffset:0,timers:[],advances:[],updatedAt:0})
  expect(result.changed).toBe(true)
  expect(ids(useCharacterStore.getState().characters.find(character=>character.id==='bearer')!)).toEqual(['other'])
 }finally{useCharacterStore.setState(prior)}
})
