import { describe, expect, it } from 'vitest'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'
import {
  dnd5eSpellSupportsNarrativeObjectAlternative,
  dnd5eSpellUsesNarrativeConversationResolution,
  dnd5eSpellUsesActionOnlyNarrativeResolution,
  dnd5eSpellUsesNarrativeObjectResolution,
  dnd5eSpellUsesNarrativeEnvironmentResolution,
  dnd5eSpellUsesNarrativeResolution,
} from './spellNarrativeResolution'

describe('voice narrative object spell policy', () => {
  it('routes Prestidigitation directly as an action-only narrative cantrip', () => {
    expect(dnd5eSpellUsesActionOnlyNarrativeResolution('prestidigitation')).toBe(true)
    expect(dnd5eSpellUsesNarrativeResolution('prestidigitation')).toBe(true)
    expect(dnd5eSpellUsesNarrativeObjectResolution('prestidigitation')).toBe(false)
  })

  it.each([
    'arcane-lock',
    'arcanists-magic-aura',
    'demiplane',
    'knock',
    'locate-object',
    'animate-objects',
    'identify',
    'illusory-script',
    'magic-mouth',
    'passwall',
    'sequester',
  ])('routes %s away from map and inventory object automation', (spellId) => {
    expect(dnd5eSpellUsesNarrativeObjectResolution(spellId)).toBe(true)
  })

  it('routes Identify through the voice-only policy when its Activity would mutate inventory', () => {
    const identifyActivity = {
      outcomes: [{
        operations: [{ id: 'identify-item', kind: 'identify-inventory-item', target: 'actor' }],
      }],
    } as unknown as Dnd5eActivityDefinitionV1

    expect(dnd5eSpellUsesNarrativeObjectResolution('identify', identifyActivity)).toBe(true)
  })

  it.each(['goodberry', 'create-food-and-water'])(
    'keeps %s on its audited generated-inventory Activity route',
    (spellId) => {
      const grantActivity = {
        outcomes: [{
          operations: [{
            id: 'grant-generated-provisions',
            kind: 'grant-inventory-item',
            target: 'actor',
            templateId: 'srd-5.1:item:generated-provisions',
            quantity: { kind: 'constant', value: 1 },
          }],
        }],
      } as unknown as Dnd5eActivityDefinitionV1

      expect(dnd5eSpellUsesNarrativeObjectResolution(spellId, grantActivity)).toBe(false)
    },
  )

  it.each(['magic-missile', 'shatter', 'thunderwave', 'dispel-magic'])(
    'keeps %s on its creature/effect combat route',
    (spellId) => {
      expect(dnd5eSpellUsesNarrativeObjectResolution(spellId)).toBe(false)
    },
  )

  it('keeps Nondetection on its audited Activity route so combat casting spends an action', () => {
    const nondetectionActivity = dnd5eSrdAuditedSpellActivityV1('nondetection')

    expect(nondetectionActivity).toBeDefined()
    expect(dnd5eSpellUsesNarrativeObjectResolution('nondetection', nondetectionActivity)).toBe(false)
    expect(dnd5eSpellUsesNarrativeResolution('nondetection', nondetectionActivity)).toBe(false)
  })

  it('keeps Disintegrate creature automation while exposing its explicit object alternative', () => {
    expect(dnd5eSpellUsesNarrativeObjectResolution('disintegrate')).toBe(false)
    expect(dnd5eSpellSupportsNarrativeObjectAlternative('disintegrate')).toBe(true)
    expect(dnd5eSpellSupportsNarrativeObjectAlternative('magic-missile')).toBe(false)
  })

  it.each(['control-water', 'control-weather'])(
    'routes %s through the environmental narrative policy, not object automation',
    (spellId) => {
      expect(dnd5eSpellUsesNarrativeObjectResolution(spellId)).toBe(false)
      expect(dnd5eSpellUsesNarrativeEnvironmentResolution(spellId)).toBe(true)
      expect(dnd5eSpellUsesNarrativeResolution(spellId)).toBe(true)
    },
  )

  it.each([
    'augury',
    'commune',
    'commune-with-nature',
    'divination',
    'speak-with-animals',
    'speak-with-dead',
  ])('routes %s through voice conversation without a DM approval interrupt', (spellId) => {
    expect(dnd5eSpellUsesNarrativeObjectResolution(spellId)).toBe(false)
    expect(dnd5eSpellUsesNarrativeConversationResolution(spellId)).toBe(true)
    expect(dnd5eSpellUsesNarrativeResolution(spellId)).toBe(true)
  })

  it('fail-closes an unknown plugin spell whose Activity would mutate an object', () => {
    const objectActivity = {
      outcomes: [{
        operations: [{
          id: 'legacy-lock',
          kind: 'modify-map-object-lock',
          mode: 'arcane-lock',
          targetKinds: ['door'],
        }],
      }],
    } as unknown as Dnd5eActivityDefinitionV1

    expect(dnd5eSpellUsesNarrativeObjectResolution('custom-object-spell', objectActivity)).toBe(true)
  })
})
