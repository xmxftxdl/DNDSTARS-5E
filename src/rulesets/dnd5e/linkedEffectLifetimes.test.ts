import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eLinkedEffectLifetimeEnded, dnd5eHasLinkedEffectLifetime } from './linkedEffectLifetimes'

const fixture = () => ({ ...createDnd5eMechanicalEffect({ id: 'debit', definitionId: 'debit', label: 'Debit',
  source: { kind: 'feature', actorId: 'source' }, targetId: 'source', duration: { type: 'permanent' }, modifiers: {} }),
  linkedLifetime: { actorId: 'old-token', characterId: 'recipient', effectId: 'credit' } })

it('reconciles a remote exact controller without releasing a corpse merely because either creature is dead',()=>{
  const effect=createDnd5eMechanicalEffect({id:'captive',definitionId:'captive',label:'Captive',targetId:'corpse',
    source:{kind:'spell',actorId:'old-caster-token',characterId:'caster'},duration:{type:'permanent'},modifiers:{preventsRevival:true},
    removal:{sourceLink:{sourceRequiresEffect:'controller',sourceRequiresEffectSameApplication:true,sourceRequiresEffectInstanceId:'exact-controller'}}})
  const controller={...effect,id:'exact-controller'}
  const peer={actorId:'new-caster-token',characterId:'caster',dead:true,effects:[controller]}
  expect(dnd5eHasLinkedEffectLifetime(effect)).toBe(true)
  expect(dnd5eLinkedEffectLifetimeEnded(effect,true,[peer])).toBe(false)
  expect(dnd5eLinkedEffectLifetimeEnded(effect,true,[])).toBe(false)
  expect(dnd5eLinkedEffectLifetimeEnded(effect,true,[peer,{...peer,effects:[]}])).toBe(false)
  expect(dnd5eLinkedEffectLifetimeEnded(effect,true,[{...peer,characterId:'unrelated',effects:[]}])).toBe(false)
  expect(dnd5eLinkedEffectLifetimeEnded(effect,true,[{...peer,effects:[{...controller,id:'different-controller'}]}])).toBe(true)
})

it('uses stable peer identity and requires positive evidence of death or effect removal', () => {
  const effect = fixture()
  const credit = { ...effect, id: 'credit' }
  const peer = { actorId: 'new-token', characterId: 'recipient', dead: false, effects: [credit] }
  expect(dnd5eLinkedEffectLifetimeEnded(effect, false, [peer])).toBe(false)
  expect(dnd5eLinkedEffectLifetimeEnded(effect, false, [{ ...peer, effects: [] }])).toBe(true)
  expect(dnd5eLinkedEffectLifetimeEnded(effect, false, [{ ...peer, dead: true }])).toBe(true)
  expect(dnd5eLinkedEffectLifetimeEnded(effect, false, [])).toBe(false)
  expect(dnd5eLinkedEffectLifetimeEnded(effect, false, [{ ...peer, actorId: 'old-token', characterId: 'stranger', dead: true }])).toBe(false)
  expect(dnd5eLinkedEffectLifetimeEnded(effect, false, [peer, { ...peer, dead: true }])).toBe(false)
  expect(dnd5eLinkedEffectLifetimeEnded(effect, true, [])).toBe(true)
  const tokenOnly = { ...effect, linkedLifetime: { actorId: 'new-token', effectId: 'credit' } }
  expect(dnd5eLinkedEffectLifetimeEnded(tokenOnly, false, [peer])).toBe(false)
})

it('preserves links through serialization and rejects malformed persisted links', () => {
  const effect = fixture()
  expect(normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))[0].linkedLifetime).toEqual(effect.linkedLifetime)
  expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(true)
  for (const linkedLifetime of [null, {}, { actorId: '', effectId: 'credit' },
    { actorId: 'receiver', effectId: 2 }, { actorId: 'receiver', effectId: 'credit', characterId: 3 }]) {
    if (linkedLifetime === null) continue
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, linkedLifetime }]).ok).toBe(false)
  }
})
