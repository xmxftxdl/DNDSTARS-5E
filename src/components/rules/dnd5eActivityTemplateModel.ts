import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1, Dnd5eTriggerEventV1 } from '../../rulesets/dnd5e'

export type Dnd5eActivityAuthoringPresetId =
  | 'active'
  | 'light-follow-up'
  | 'hit'
  | 'spell'
  | 'skill'
  | 'move'
  | 'before-damage'
  | 'event-damage-reflection'
  | 'condition-attempted'
  | 'persistent-area'
  | 'persistent-area-control'
  | 'persistent-companion'
  | 'assisted-dm-boundary'

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
  { id: 'event-damage-reflection', label: '受伤后按事件伤害反射', event: 'after-damage' },
  { id: 'condition-attempted', label: '状态施加尝试后', event: 'on-condition-attempted' },
  { id: 'persistent-area', label: '持续区域（回合开始触发）' },
  { id: 'persistent-area-control', label: '持续区域 + 后续控制动作' },
  { id: 'persistent-companion', label: '持久战斗伙伴' },
  { id: 'assisted-dm-boundary', label: '安全子集 + DM 边界确认' },
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
  const isReaction = preset.id === 'before-damage' || preset.id === 'condition-attempted'
  if (preset.id === 'assisted-dm-boundary') {
    return {
      schemaVersion: 1,
      id,
      name: preset.label,
      description: 'Host 自动验证目标与行动经济；DM 批准边界说明后再原子提交。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60, includeSelf: false },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
      outcomes: [{
        id: 'dm-approved-boundary',
        when: { kind: 'always' },
        operations: [{
          id: 'dm-boundary',
          kind: 'manual-adjudication',
          prompt: '请确认规则中不能由白名单效果表达的叙事、幻象、地图或临场边界。',
          reason: '批准只解锁当前事务；目标、骰据、资源和已配置的白名单效果仍由 Host 校验。',
          requiresDmApproval: true,
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('partial', ['存在一个显式 DM 裁定边界。']),
      legacySource: { kind: 'feature', id: 'replace-with-owner-id' },
    }
  }
  if (preset.id === 'event-damage-reflection') {
    return {
      schemaVersion: 1,
      id,
      name: preset.label,
      description: '读取 Host 已提交的受伤事件，并按配置倍率向伤害来源提交新的伤害提案。',
      activation: { kind: 'passive' },
      invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic', retention: 'single-event' },
      target: { kind: 'creature', relation: 'enemy', count: 1, includeSelf: false },
      requirements: [{ kind: 'event-source', source: 'attack' }],
      outcomes: [{
        id: 'reflect-event-damage', when: { kind: 'always' }, operations: [{
          id: 'reflect-event-damage',
          kind: 'mechanic',
          handlerId: 'core.event-damage-reflection',
          target: 'target',
          parameters: {
            multiplier: 1,
            'maximum-damage': 0,
            'damage-type': 'force',
            magical: true,
          },
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('manual'),
      legacySource: { kind: 'feature', id: 'replace-with-owner-id' },
    }
  }
  if (preset.id === 'persistent-area') {
    return {
      schemaVersion: 1,
      id,
      name: preset.label,
      description: '由 Host 保存范围，并在区域内生物回合开始时自动进行豁免与伤害结算。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: {
        kind: 'area', relation: 'enemy', origin: 'point', shape: 'circle',
        placeRangeFeet: 60, radiusFeet: 10, maximumTargets: 32, includeSelf: false,
      },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
      outcomes: [{
        id: 'create-area', when: { kind: 'always' }, operations: [{
          id: 'persistent-area', kind: 'create-persistent-area', label: '持续区域',
          durationRounds: 10, concentration: true, color: '#8b5cf6',
          movementCostMultiplier: 2,
          triggers: [{
            id: 'area-turn-start', label: '区域回合开始效果', timing: 'turn-start',
            oncePerTurn: true,
            savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'half', magical: true },
            damage: { count: 1, sides: 6, type: 'fire' },
          }],
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'feature', id: 'replace-with-owner-id' },
    }
  }
  if (preset.id === 'persistent-companion') {
    return {
      schemaVersion: 1,
      id,
      name: preset.label,
      description: '由 Host 创建并保存伙伴实体；怪物 ID 与成长公式可在 JSON 中继续调整。',
      activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' },
      target: {
        kind: 'area', relation: 'ally', origin: 'point', shape: 'circle',
        placeRangeFeet: 30, radiusFeet: 5, maximumTargets: 1, includeSelf: false,
      },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
      outcomes: [{
        id: 'create-companion', when: { kind: 'always' }, operations: [{
          id: 'persistent-companion', kind: 'summon', monsterId: 'srd-5.1:wolf',
          count: { kind: 'constant', value: 1 }, timing: 'immediate',
          durationRounds: 10_000, concentration: false, side: 'ally', persistent: true,
          minimumMaximumHitPoints: { kind: 'multiply', values: [
            { kind: 'reference', reference: { kind: 'actor-class-level', classId: 'ranger' } },
            { kind: 'constant', value: 4 },
          ] },
          armorClassBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
          weaponAttackBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
          weaponDamageBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
          savingThrowBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
          proficientSkillCheckBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
          weaponAttacksMagical: true,
          attacksPerAction: { kind: 'constant', value: 2 },
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
      legacySource: { kind: 'feature', id: 'replace-with-owner-id' },
    }
  }
  return {
    schemaVersion: 1,
    id,
    name: preset.label,
    description: '由 DM 使用统一 Activity 模板创建。',
    activation: { kind: preset.id === 'light-follow-up' ? 'bonus-action' : isReaction ? 'reaction' : 'action', cost: 1 },
    invocation: triggered
      ? { kind: 'triggered', event: preset.event!, confirmation: 'actor-choice', retention: preset.id === 'light-follow-up' ? 'until-turn-end' : 'single-event' }
      : { kind: 'active', confirmation: 'actor-choice' },
    target: {
      kind: 'creature',
      relation: 'enemy',
      count: 1,
      rangeFeet: preset.id === 'condition-attempted' ? 30 : 5,
      includeSelf: false,
    },
    requirements: preset.id === 'light-follow-up' ? [
      { kind: 'event-source', source: 'attack' },
      { kind: 'weapon-property', property: 'light', present: true },
      { kind: 'action-economy-available', economy: 'bonus-action' },
    ] : preset.id === 'spell' ? [{ kind: 'event-source', source: 'spell' }]
      : preset.id === 'skill' ? [{ kind: 'event-source', source: 'skill' }]
        : preset.id === 'move' ? [{ kind: 'event-source', source: 'movement' }]
          : preset.id === 'condition-attempted' ? [
            { kind: 'event-source', source: 'combat', sourceId: 'condition:charmed' },
            { kind: 'action-economy-available', economy: 'reaction' },
          ]
          : undefined,
    consumption: [{
      kind: 'action-economy',
      economy: preset.id === 'light-follow-up' ? 'bonus-action' : isReaction ? 'reaction' : 'action',
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

/** Some authoring presets intentionally create a linked Activity graph. */
export function dnd5eActivitiesFromAuthoringPresetV1(
  preset: (typeof DND5E_ACTIVITY_AUTHORING_PRESETS)[number],
  activities: readonly Dnd5eActivityDefinitionV1[],
): readonly Dnd5eActivityDefinitionV1[] {
  if (preset.id !== 'persistent-area-control') {
    return [dnd5eActivityFromAuthoringPresetV1(preset, activities)]
  }
  const creatorId = nextId(activities)
  let controlId = `${creatorId}-control`
  let suffix = 2
  while (activities.some((activity) => activity.id === controlId)) {
    controlId = `${creatorId}-control-${suffix}`
    suffix += 1
  }
  const creator: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1,
    id: creatorId,
    name: '创建并操控持续区域',
    description: '创建 Host 持久化区域，并由该地图实体授予后续控制 Activity。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    target: {
      kind: 'area', relation: 'any', origin: 'point', shape: 'circle',
      placeRangeFeet: 60, radiusFeet: 5, maximumTargets: 32, includeSelf: true,
    },
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{
      id: 'create-area', when: { kind: 'always' }, operations: [{
        id: 'persistent-area', kind: 'create-persistent-area', label: '可操控持续区域',
        durationRounds: 10, concentration: true, color: '#8b5cf6',
        grantedActivities: [{ activityId: controlId, activateOnCreate: true }],
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'feature', id: 'replace-with-owner-id' },
  }
  const control: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1,
    id: controlId,
    name: '操控持续区域',
    description: '从区域锚点选择目标，进行 Host 豁免并自动计算合法推拉路径。',
    activation: { kind: 'bonus-action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    target: {
      kind: 'creature', relation: 'enemy', rangeFeet: 30, count: 1,
      includeSelf: false, requiresLineOfSight: true, requiresLineOfEffect: true,
    },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
    checks: [{
      id: 'control-save', kind: 'saving-throw', rollId: 'control-save', ability: 'dex',
      dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } },
      rollMode: 'host-derived', scope: 'per-target',
    }],
    outcomes: [{
      id: 'failed-save',
      when: { kind: 'check', checkId: 'control-save', result: 'failure' },
      operations: [{
        id: 'forced-movement', kind: 'move', target: 'target', mode: 'pull',
        distanceFeet: { kind: 'constant', value: 20 },
        placement: 'host-automatic-maximum', ignoresOpportunityAttacks: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'feature', id: 'replace-with-owner-id' },
  }
  return [creator, control]
}
