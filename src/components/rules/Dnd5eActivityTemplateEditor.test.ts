import { describe, expect, it } from 'vitest'
import { validateDnd5eActivityDefinitionV1, type Dnd5eTriggerEventV1 } from '../../rulesets/dnd5e'
import { dnd5eActivityFromAuthoringPresetV1, type Dnd5eActivityAuthoringPresetId } from './dnd5eActivityTemplateModel'

const presets: readonly { id: Dnd5eActivityAuthoringPresetId; label: string; event?: Dnd5eTriggerEventV1 }[] = [
  { id: 'active', label: 'Active' },
  { id: 'light-follow-up', label: 'Light', event: 'attack-resolved' },
  { id: 'hit', label: 'Hit', event: 'attack-hit' },
  { id: 'spell', label: 'Spell', event: 'spell-resolved' },
  { id: 'skill', label: 'Skill', event: 'skill-used' },
  { id: 'move', label: 'Move', event: 'movement-completed' },
  { id: 'before-damage', label: 'Damage', event: 'before-damage' },
]

describe('Activity authoring presets', () => {
  it('creates valid fail-safe recipes for every common timing window', () => {
    for (const preset of presets) {
      expect(validateDnd5eActivityDefinitionV1(dnd5eActivityFromAuthoringPresetV1(preset, []))).toEqual([])
    }
  })

  it('encodes the light-weapon follow-up as one Host-verifiable template', () => {
    expect(dnd5eActivityFromAuthoringPresetV1(presets[1]!, [])).toMatchObject({
      activation: { kind: 'bonus-action' },
      invocation: { kind: 'triggered', event: 'attack-resolved', retention: 'until-turn-end' },
      requirements: [
        { kind: 'event-source', source: 'attack' },
        { kind: 'weapon-property', property: 'light', present: true },
        { kind: 'action-economy-available', economy: 'bonus-action' },
      ],
    })
  })
})
