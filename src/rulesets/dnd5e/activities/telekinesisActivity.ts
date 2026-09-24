import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

/** Creature control is deterministic; object manipulation remains a table ruling. */
export function telekinesisCreatureActivity(base: Dnd5eActivityDefinitionV1, continuing = false): Dnd5eActivityDefinitionV1 {
  return {
    ...base,
    id: continuing ? 'spell:telekinesis:control' : base.id,
    name: continuing ? '心灵遥控·继续控制' : '心灵遥控',
    description: '选择60尺内可见的巨型或更小生物，以施法属性检定对抗其力量检定。获胜后目标被束缚并悬浮，持续至你的下回合结束。获胜后可向任意方向移动至多30尺，但不能移出施法者60尺范围。持续期间可用动作重新对抗、移动或更换目标。',
    activation: { kind: 'action', cost: 1 },
    invocation: { kind: 'active', confirmation: 'actor-choice' },
    consumption: continuing
      ? [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'confirm' }]
      : base.consumption,
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60,
      includeSelf: false, requiresLineOfSight: true, requiresLineOfEffect: true },
    requirements: [
      { kind: 'size-rank', subject: 'target', maximum: 4 },
      ...(continuing ? [{ kind: 'active-effect' as const, subject: 'actor' as const,
        effectId: 'telekinesis-controller', present: true, source: 'self' as const }] : []),
    ],
    choices: [{ id: 'movement', label: '对抗成功后的移动', defaultOptionId: 'horizontal', options: [
      { id: 'horizontal', label: '选择落点（最多30尺）' },
      { id: 'hold', label: '原地控制' },
      ...[5, 10, 15, 20, 25, 30].flatMap(feet => [
        { id: `up-${feet}`, label: `上升${feet}尺` },
        { id: `down-${feet}`, label: `下降${feet}尺` },
      ]),
    ] }],
    checks: [{
      id: 'telekinesis-contest', kind: 'opposed-ability-check',
      rollId: 'telekinesis-caster-d20', opposedRollId: 'telekinesis-target-d20',
      sourceAbility: 'spellcasting',
      sourceModifier: { kind: 'reference', reference: { kind: 'actor-spellcasting-ability-modifier' } },
      sourceRollMode: 'host-derived', targetRollMode: 'host-derived',
      targetOptions: [{ ability: 'str' }], scope: 'per-target',
    }],
    effects: [{
      schemaVersion: 1, id: 'telekinesis-controller', name: '心灵遥控·持续控制',
      duration: { kind: 'concentration', maximumRounds: 100 }, concentration: true,
      grants: ['spell:telekinesis:control'], stacking: 'replace',
    }, {
      schemaVersion: 1, id: 'telekinesis-restrained', name: '心灵遥控·束缚',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-end' },
      conditions: ['restrained'], modifiers: [{ kind: 'magically-held-aloft' }],
      sourceLink: { sourceRequiresEffect: 'telekinesis-controller' },
      tags: ['telekinesis-controlled'], stacking: 'replace',
    }],
    outcomes: [{
      id: 'begin-control', when: { kind: 'always' }, operations: [
        ...(!continuing ? [{ id: 'start-telekinesis', kind: 'apply-effect' as const,
          target: 'actor' as const, effectId: 'telekinesis-controller' }] : []),
        { id: 'release-previous-telekinesis', kind: 'remove-effects-by-tag', target: 'all-combatants',
          tags: ['telekinesis-controlled'], match: 'any', source: 'self' },
      ],
    }, {
      id: 'win-control', when: { kind: 'check', checkId: 'telekinesis-contest', result: 'success' },
      operations: [{ id: 'restrain-telekinesis-target', kind: 'apply-effect', target: 'target', effectId: 'telekinesis-restrained' }],
    }, ...[
      { id: 'horizontal', mode: 'forced' as const, feet: 30 },
      ...[5, 10, 15, 20, 25, 30].flatMap(feet => [
        { id: `up-${feet}`, mode: 'ascend' as const, feet },
        { id: `down-${feet}`, mode: 'descend' as const, feet },
      ]),
    ].map(move => ({
      id: `telekinesis-${move.id}`,
      when: { kind: 'all' as const, conditions: [
        { kind: 'check' as const, checkId: 'telekinesis-contest', result: 'success' as const },
        { kind: 'choice' as const, choiceId: 'movement', optionId: move.id },
      ] },
      operations: [{ id: `telekinesis-move-${move.id}`, kind: 'move' as const, target: 'target' as const,
        mode: move.mode, distanceFeet: { kind: 'constant' as const, value: move.feet },
        maximumDistanceFromActorFeet: 60, ignoresOpportunityAttacks: true }],
    }))],
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'spell', id: 'telekinesis' },
  }
}
