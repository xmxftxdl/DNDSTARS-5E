import { describe, expect, it } from 'vitest'
import type { Character, ClassFeatureKey, Trait } from '../types/character'
import {
  buildFeaturePresentation,
  featureActivationContract,
  headlessFeatureActivationResolver,
  registerFeatureActivationContract,
  registerHeadlessFeatureActivationResolver,
} from './featureActivationRegistry'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    charClass: '影舞者',
    level: 40,
    currentHp: 10,
    maxHp: 10,
    actionPoints: 2,
    currentAP: 2,
    traits: [],
    combatSkills: [],
    conditions: [],
    qi: 2,
    ...patch,
  } as Character
}

function trait(featureKey: ClassFeatureKey, patch: Partial<Trait> = {}): Trait {
  return {
    id: `trait-${featureKey}`,
    name: String(featureKey),
    level: 1,
    uses: 0,
    maxUses: 0,
    description: '',
    featureKey,
    ...patch,
  }
}

describe('feature activation registry', () => {
  it('keeps unlimited active features enabled when AP and class resources are available', () => {
    const view = buildFeaturePresentation(character(), trait('flexibleBody'))
    expect(view.activation?.disabled).toBe(false)
    expect(view.activation?.label).toContain('1 AP')
    expect(view.activation?.label).toContain('1 气')
  })

  it('exposes all existing active feature entries through presentation contracts', () => {
    for (const key of [
      'doubleArrow',
      'eagleEye',
      'preciseStrike',
      'wildernessGuide',
      'stillWater',
      'finale',
      'illusionDance',
      'shadowVeil',
      'trackingArrow',
      'flexibleBody',
      'showtime',
      'windBlade',
    ] as const) {
      expect(featureActivationContract(key), key).toBeDefined()
    }
  })

  it('allows a new class module to register presentation and headless resolution', () => {
    const key = 'testFeature' as ClassFeatureKey
    const contract = {
      key,
      apCost: 0,
      requiresUse: false,
      buildPresentation: () => ({ statuses: [{ text: '测试状态', tone: 'sky' as const }] }),
    }
    const resolver = () => ({ ok: false, reason: 'unsupported-action' as const, state: {} as never, events: [] })
    const disposeContract = registerFeatureActivationContract(contract)
    const disposeResolver = registerHeadlessFeatureActivationResolver(key, resolver)
    try {
      expect(buildFeaturePresentation(character(), trait(key)).statuses[0]?.text).toBe('测试状态')
      expect(headlessFeatureActivationResolver(key)).toBe(resolver)
    } finally {
      disposeResolver()
      disposeContract()
    }
  })
})
