import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateDnd5eActivityDefinitionV1, type Dnd5eTriggerEventV1 } from '../../rulesets/dnd5e'
import {
  dnd5eActivitiesFromAuthoringPresetV1,
  dnd5eActivityFromAuthoringPresetV1,
  type Dnd5eActivityAuthoringPresetId,
} from './dnd5eActivityTemplateModel'

const presets: readonly { id: Dnd5eActivityAuthoringPresetId; label: string; event?: Dnd5eTriggerEventV1 }[] = [
  { id: 'active', label: 'Active' },
  { id: 'light-follow-up', label: 'Light', event: 'attack-resolved' },
  { id: 'hit', label: 'Hit', event: 'attack-hit' },
  { id: 'spell', label: 'Spell', event: 'spell-resolved' },
  { id: 'skill', label: 'Skill', event: 'skill-used' },
  { id: 'move', label: 'Move', event: 'movement-completed' },
  { id: 'before-damage', label: 'Damage', event: 'before-damage' },
  { id: 'condition-attempted', label: 'Condition', event: 'on-condition-attempted' },
  { id: 'persistent-area', label: 'Persistent area' },
  { id: 'persistent-companion', label: 'Persistent companion' },
  { id: 'assisted-dm-boundary', label: 'Assisted DM boundary' },
  { id: 'event-damage-reflection', label: 'Reflection', event: 'after-damage' },
]

describe('Activity authoring presets', () => {
  it('keeps advanced authoring schema-driven instead of exposing a JSON textarea', () => {
    const source = readFileSync(new URL('./Dnd5eActivityTemplateEditor.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('<textarea')
    expect(source).not.toContain('JSON.parse')
    expect(source).toContain('Operations')
    expect(source).toContain('Effect')
    expect(source).toContain('触发与资格检查')
    expect(source).toContain('attack-proficiency')
    expect(source).toContain('armor-proficiency')
    expect(source).toContain('spellcasting-capability')
    expect(source).toContain('重复豁免结束')
    expect(source).toContain('sourceRequiresEffectAtSourceTurnEnd')
    expect(source).toContain('此 Effect 受来源专注约束')
    expect(source).toContain('Host 机制处理器')
    expect(source).toContain('listDnd5eMechanicOperationHandlersV1')
    expect(source).toContain('权威随机表')
    expect(source).toContain('骰值区间')
    expect(source).toContain("kind: 'check-total'")
  })

  it('keeps executionMode frozen as a legacy loading adapter', () => {
    const source = readFileSync(new URL('./Dnd5eCustomPluginBuilder.tsx', import.meta.url), 'utf8')
    expect(source).toContain('function FrozenExecutionMode')
    expect(source).toContain('Legacy adapter')
    expect(source).not.toContain('onChange={(executionMode)')
  })

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

  it('encodes a reusable condition-attempt reaction without depending on condition success', () => {
    expect(dnd5eActivityFromAuthoringPresetV1(presets[7]!, [])).toMatchObject({
      activation: { kind: 'reaction' },
      invocation: { kind: 'triggered', event: 'on-condition-attempted' },
      target: { kind: 'creature', relation: 'enemy', rangeFeet: 30 },
      requirements: [
        { kind: 'event-source', source: 'combat', sourceId: 'condition:charmed' },
        { kind: 'action-economy-available', economy: 'reaction' },
      ],
    })
  })

  it('creates an editable Host-owned persistent area lifecycle recipe', () => {
    expect(dnd5eActivityFromAuthoringPresetV1(presets[8]!, [])).toMatchObject({
      target: { kind: 'area', origin: 'point', shape: 'circle', radiusFeet: 10 },
      outcomes: [{ operations: [{
        kind: 'create-persistent-area',
        movementCostMultiplier: 2,
        triggers: [{
          timing: 'turn-start',
          savingThrow: { dc: 'source-save-dc' },
          damage: { count: 1, sides: 6, type: 'fire' },
        }],
      }] }],
      automation: { level: 'full' },
    })
  })

  it('creates an editable persistent companion using the generic summon combat profile', () => {
    expect(dnd5eActivityFromAuthoringPresetV1(presets[9]!, [])).toMatchObject({
      target: { kind: 'area', origin: 'point', maximumTargets: 1 },
      outcomes: [{ operations: [{
        kind: 'summon', persistent: true, monsterId: 'srd-5.1:wolf',
        minimumMaximumHitPoints: { kind: 'multiply' },
        armorClassBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponAttackBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponDamageBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        savingThrowBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        proficientSkillCheckBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponAttacksMagical: true,
        attacksPerAction: { kind: 'constant', value: 2 },
      }] }],
      automation: { level: 'full' },
    })
  })

  it('creates a linked persistent-area control graph for workshop authors', () => {
    const linked = dnd5eActivitiesFromAuthoringPresetV1({
      id: 'persistent-area-control',
      label: 'Area control',
    }, [])
    expect(linked).toHaveLength(2)
    expect(linked.flatMap((activity) => validateDnd5eActivityDefinitionV1(activity))).toEqual([])
    expect(linked[0]).toMatchObject({
      outcomes: [{ operations: [{
        kind: 'create-persistent-area',
        grantedActivities: [{ activityId: linked[1]!.id, activateOnCreate: true }],
      }] }],
    })
    expect(linked[1]).toMatchObject({
      outcomes: [{ operations: [{
        kind: 'move', placement: 'host-automatic-maximum', mode: 'pull',
      }] }],
    })
  })

  it('creates a reusable fail-closed DM boundary instead of a bespoke feature branch', () => {
    expect(dnd5eActivityFromAuthoringPresetV1(presets[10]!, [])).toMatchObject({
      activation: { kind: 'action' },
      target: { kind: 'creature', rangeFeet: 60 },
      outcomes: [{ operations: [{ kind: 'manual-adjudication', requiresDmApproval: true }] }],
      automation: { level: 'assisted' },
    })
  })

  it('creates a registered event-damage handler without embedding executable code', () => {
    expect(dnd5eActivityFromAuthoringPresetV1(presets[11]!, [])).toMatchObject({
      activation: { kind: 'passive' },
      invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
      requirements: [{ kind: 'event-source', source: 'attack' }],
      outcomes: [{ operations: [{
        kind: 'mechanic', handlerId: 'core.event-damage-reflection',
      }] }],
    })
  })
})
