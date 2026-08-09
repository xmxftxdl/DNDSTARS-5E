import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1, Dnd5eTriggerEventV1 } from '../../rulesets/dnd5e'

export type Dnd5eActivityAuthoringPresetId = 'active' | 'light-follow-up' | 'hit' | 'spell' | 'skill' | 'move' | 'before-damage'

export const DND5E_ACTIVITY_AUTHORING_PRESETS: readonly {
  id: Dnd5eActivityAuthoringPresetId
  label: string
  event?: Dnd5eTriggerEventV1
}[] = [
  { id: 'active', label: '主动使用' },
  { id: 'light-follow-up', label: '轻型武器攻击后', event: 'attack-resolved' },
  { id: 'hit', label: '攻击命中后', event: 'attack-hit' },
  { id: 'spell', label: '施法结算后', event: 'spell-resolved' },
  { id: 'skill', label: '使用技能后', event: 'skill-used' },
  { id: 'move', label: '移动完成后', event: 'movement-completed' },
  { id: 'before-damage', label: '受到伤害前', event: 'before-damage' },
]

function nextId(activities: readonly Dnd5eActivityDefinitionV1[]): string {
  let index = activities.length + 1
  while (activities.some((activity) => activity.id === `custom-activity-${index}`)) index += 1
  return `custom-activity-${index}`
}

export function dnd5eActivityFromAuthoringPresetV1(
  preset: (typeof DND5E_ACTIVITY_AUTHORING_PRESETS)[number],
  activities: readonly Dnd5eActivityDefinitionV1[],
): Dnd5eActivityDefinitionV1 {
  const id = nextId(activities)
  const triggered = preset.event != null
  return {
    schemaVersion: 1,
    id,
    name: preset.label,
    description: '由 DM 使用统一 Activity 模板创建。',
    activation: { kind: preset.id === 'light-follow-up' ? 'bonus-action' : preset.id === 'before-damage' ? 'reaction' : 'action', cost: 1 },
    invocation: triggered
      ? { kind: 'triggered', event: preset.event!, confirmation: 'actor-choice', retention: preset.id === 'light-follow-up' ? 'until-turn-end' : 'single-event' }
      : { kind: 'active', confirmation: 'actor-choice' },
    target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5, includeSelf: false },
    requirements: preset.id === 'light-follow-up' ? [
      { kind: 'event-source', source: 'attack' },
      { kind: 'weapon-property', property: 'light', present: true },
      { kind: 'action-economy-available', economy: 'bonus-action' },
    ] : preset.id === 'spell' ? [{ kind: 'event-source', source: 'spell' }]
      : preset.id === 'skill' ? [{ kind: 'event-source', source: 'skill' }]
        : preset.id === 'move' ? [{ kind: 'event-source', source: 'movement' }]
          : undefined,
    consumption: [{
      kind: 'action-economy',
      economy: preset.id === 'light-follow-up' ? 'bonus-action' : preset.id === 'before-damage' ? 'reaction' : 'action',
      amount: 1,
      consumeOn: 'resolve',
    }],
    outcomes: [{
      id: 'resolve',
      when: { kind: 'always' },
      operations: [{
        id: 'dm-review',
        kind: 'manual-adjudication',
        prompt: '请在保存前把此占位操作替换为伤害、治疗、状态、资源、移动、召唤或其他白名单效果。',
        reason: 'Timing template is ready; effect recipe still requires DM configuration.',
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('manual', ['效果配方尚未配置。']),
    legacySource: { kind: 'feature', id: 'replace-with-owner-id' },
  }
}
