import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict,
  dnd5eActiveEmittedLight, effectiveDnd5eActiveEffects } from './activeEffects'
import { createDnd5eEffectGrantCharges, spendDnd5eEffectGrantCharge } from './effectGrantCharges'

function crown() {
  return createDnd5eMechanicalEffect({ id: 'stars', definitionId: 'stars', label: 'Stars', targetId: 'caster',
    source: { kind: 'spell', actorId: 'caster', pluginId: 'test.stars', spellLevel: 7 },
    duration: { type: 'rounds', remainingRounds: 600, tickOn: 'source-turn-end' },
    stackingKey: 'stars', stackingPolicy: 'replace', grantedActivities: ['star-attack'],
    grantedActivityCharges: createDnd5eEffectGrantCharges({ initial: 7, endWhenEmpty: true, lightTiers: [
      { minimumRemaining: 4, brightRadiusFeet: 30, dimRadiusFeet: 30, color: '#ffffff' },
      { minimumRemaining: 1, brightRadiusFeet: 0, dimRadiusFeet: 30, color: '#ffffff' },
    ] }) })
}

it('round-trips actual active effects without restoring charges or extending their duration', () => {
  let effect = crown()
  const duration = structuredClone(effect.duration), source = structuredClone(effect.source)
  for (let count = 7; count > 0; count--) {
    expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(true)
    expect(dnd5eActiveEmittedLight([effect])).toMatchObject({ brightRadiusFeet: count >= 4 ? 30 : 0, dimRadiusFeet: 30 })
    const spent = spendDnd5eEffectGrantCharge(effect.grantedActivityCharges!)
    if (!spent.ok) throw Error('Charge unexpectedly rejected')
    effect = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([{ ...effect, grantedActivityCharges: spent.charges }])))[0]
    expect(effect.grantedActivityCharges?.current).toBe(count-1)
    expect(effect.duration).toEqual(duration); expect(effect.source).toEqual(source)
  }
  expect(dnd5eActiveEmittedLight([effect])).toBeUndefined()
  expect(effectiveDnd5eActiveEffects([effect])).toEqual([])
})

it('rejects corrupt charges and conflicting single-use grants instead of silently making them unlimited', () => {
  for (const patch of [{ grantedActivities: [] }, { grantedActivitiesSingleUse: true },
    { grantedActivityCharges: { ...crown().grantedActivityCharges, current: 8 } }]) {
    const value = [{ ...crown(), ...patch }]
    expect(validateDnd5eActiveEffectsStrict(value).ok).toBe(false)
    expect(normalizeDnd5eActiveEffects(value)).toEqual([])
  }
  const independent = { ...crown(), id: 'other', grantedActivityCharges: undefined,
    modifiers: { emittedLight: { brightRadiusFeet: 40, dimRadiusFeet: 40, color: '#ffaa00' } } }
  expect(dnd5eActiveEmittedLight([crown(), independent])?.brightRadiusFeet).toBe(40)
})

