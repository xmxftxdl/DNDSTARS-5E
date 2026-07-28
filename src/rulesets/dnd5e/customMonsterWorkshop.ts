import type { AbilityKey } from '../../lib/dnd'
import {
  DND5E_DAMAGE_TYPES,
  type Dnd5eDamageType,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterMechanicEffectV2,
  type Dnd5eMonsterMechanicEffectTargetV2,
  type Dnd5eMonsterMechanicSubjectV2,
  type Dnd5eMonsterMechanicTrigger,
  type Dnd5eMonsterMechanicTriggerEventV2,
  type Dnd5eMonsterMechanicTriggerV2,
  type Dnd5eMonsterEquipment,
  type Dnd5eMonsterSize,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterTargetPriority,
} from './monsters'
import { DND5E_STANDARD_CONDITIONS, type Dnd5eStandardConditionId } from './conditions'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export interface Dnd5eCustomMonsterTraitDraft {
  name: string
  description: string
  automation: 'headless' | 'dm-adjudication'
  ruleKind:
    | 'none'
    | 'undead-fortitude'
    | 'regeneration'
    | 'swarm'
    | 'nimble-escape'
    | 'keen-sense'
    | 'ambusher'
    | 'charge-damage'
    | 'magic-resistance'
    | 'limited-magic-immunity'
    | 'magic-weapons'
    | 'pack-tactics'
    | 'conditional-target-bonus'
  amount: number
  dcBase: number
  damageTypes: Dnd5eDamageType[]
  requiresPositiveHp: boolean
  excludedOnCritical: boolean
  diesAtZeroWhenSuppressed: boolean
  keenSense: 'smell' | 'hearing' | 'sight'
  keenSenseSkillKey: string
  keenSenseCheckBonus: number
  keenSenseBlindsightFeet: number
  chargeMinimumFeet: number
  chargeActionId: string
  chargeDamageDice: string
  chargeDamageType: Dnd5eDamageType
  limitedMagicImmunityMaximumSpellLevel: number
  limitedMagicImmunityAdvantageAboveMaximum: boolean
  limitedMagicImmunityAllowsWilling: boolean
  targetBonusConditions: Dnd5eStandardConditionId[]
  targetAttackBonus: number
  targetDamageBonus: number
}

export interface Dnd5eCustomMonsterActionDraft {
  id: string
  name: string
  description: string
  kind: 'weapon-attack' | 'movement' | 'other'
  automation: 'headless' | 'dm-adjudication'
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  toHit: number
  reachFeet: number
  rangeNormal: number
  rangeLong: number
  damageDice: string
  damageType: Dnd5eDamageType
  additionalDamage: Array<{ id: string; dice: string; damageType: Dnd5eDamageType }>
  criticalThreshold: number
  criticalExtraDamage: Array<{ id: string; dice: string; damageType: Dnd5eDamageType }>
  onHitSaveEnabled: boolean
  onHitSaveAbility: AbilityKey
  onHitSaveDc: number
  onHitCondition: Dnd5eStandardConditionId | 'disease'
  attacksPerAction: number
  category: 'action' | 'bonus-action' | 'reaction' | 'legendary' | 'lair'
  usageKind: 'at-will' | 'per-day' | 'recharge'
  usageMax: number
  rechargeMinimum: number
  rechargeDieSides: number
  legendaryCost: number
  referencedActionId: string
  movementSpeedFraction: number
  reactionTriggerActionId: string
}

export interface Dnd5eCustomMonsterEquipmentDraft {
  id: string
  name: string
  category: Dnd5eMonsterEquipment['category']
  quantity: number
  description: string
  armorClass?: number
  linkedActionId: string
}

export interface Dnd5eCustomMonsterSkillDraft {
  id: string
  key: string
  name: string
  bonus: number
}

export interface Dnd5eCustomMonsterSenseDraft {
  id: string
  name: string
  distanceFeet?: number
}

export interface Dnd5eCustomMonsterSpellDraft {
  id: string
  name: string
  level: number
  usageKind: 'slots' | 'at-will' | 'per-day'
  usageMax: number
}

export interface Dnd5eCustomMonsterMechanicDraft {
  id: string
  name: string
  trigger: Dnd5eMonsterMechanicTriggerEventV2
  triggerSubject: Dnd5eMonsterMechanicSubjectV2
  triggerRadiusFeet: number
  movementComparison: 'at-least' | 'at-most'
  movementFeet: number
  hpPercentageAtOrBelow?: number
  hpPercentageAtOrAbove?: number
  hpBelow?: number
  hpAtOrBelow?: number
  hpAbove?: number
  hpAtOrAbove?: number
  requiresPositiveHp: boolean
  effectKind:
    | 'healing'
    | 'temporary-hit-points'
    | 'damage'
    | 'standard-condition'
    | 'remove-standard-condition'
    | 'summon'
    | 'area-attack'
    | 'roll-modifier'
    | 'attack'
  effectTarget: Dnd5eMonsterMechanicEffectTargetV2
  healingDice: string
  damageType: Dnd5eDamageType | 'inherit-trigger'
  condition: Dnd5eStandardConditionId
  durationKind: 'permanent' | 'until-target-turn-start' | 'until-source-turn-start' | 'rounds'
  durationRounds: number
  summonMonsterId: string
  summonCount: number
  summonDurationRounds: number
  areaShape: 'circle' | 'cone' | 'line'
  areaRangeFeet: number
  areaSizeFeet: number
  modifierRoll: 'attack' | 'damage' | 'saving-throw'
  modifierMode: 'bonus' | 'advantage' | 'disadvantage'
  modifierBonus: number
  attackToHit: number
  attackEconomy: 'none' | 'reaction'
  attackDamageMode: 'dice' | 'fixed'
  attackFixedDamage: number
  limit: Dnd5eMonsterMechanicTrigger['limit']
  automation: 'full' | 'partial' | 'manual'
  /** 表单编辑首个效果；高级 JSON 中的其余效果必须无损保留。 */
  preservedEffects?: readonly Dnd5eMonsterMechanicEffectV2[]
}

export interface Dnd5eCustomMonsterDraft {
  /** 原始结构化数据；表单未覆盖的高级字段会在保存时原样透传。 */
  preservedStatBlock?: Dnd5eMonsterStatBlock
  id?: string
  slug?: string
  name: string
  englishName: string
  size: Dnd5eMonsterSize
  creatureType: string
  alignment: string
  armorClass: number
  armorClassNote: string
  hitPointsAverage: number
  hitPointsDice: string
  walk: number
  fly: number
  swim: number
  climb: number
  burrow: number
  hover: boolean
  abilities: Record<AbilityKey, number>
  savingThrows: Partial<Record<AbilityKey, number>>
  skills: Dnd5eCustomMonsterSkillDraft[]
  senses: Dnd5eCustomMonsterSenseDraft[]
  damageVulnerabilities: Dnd5eDamageType[]
  damageResistances: Dnd5eDamageType[]
  damageImmunities: Dnd5eDamageType[]
  /**
   * Advanced, source-aware defenses imported from a stat block.
   * The basic workshop does not infer or edit these rules from prose.
   */
  damageDefenseRules?: NonNullable<Dnd5eMonsterStatBlock['damageDefenseRules']>
  /** Canonical defense clauses that still require DM adjudication. */
  unparsedDamageDefenses?: NonNullable<Dnd5eMonsterStatBlock['unparsedDamageDefenses']>
  conditionImmunities: Dnd5eStandardConditionId[]
  passivePerception: number
  languages: string
  challengeRating: string
  xp: number
  description: string
  tokenPortrait?: string
  initiativePortrait?: string
  equipment: Dnd5eCustomMonsterEquipmentDraft[]
  legendaryResistanceUses: number
  legendaryActionPoints: number
  lairInitiative: number
  spellcastingEnabled: boolean
  spellcastingDescription: string
  spellcastingCasterLevel: number
  spellcastingAbility: AbilityKey
  spellcastingSaveDc: number
  spellcastingAttackBonus: number
  spellSlots: Record<string, number>
  spells: Dnd5eCustomMonsterSpellDraft[]
  spellcastingAutomation: 'headless' | 'dm-adjudication'
  targetingPriority: Dnd5eMonsterTargetPriority
  headlessMechanics: Dnd5eCustomMonsterMechanicDraft[]
  traits: Dnd5eCustomMonsterTraitDraft[]
  actions: Dnd5eCustomMonsterActionDraft[]
}

function uid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '').slice(0, 16)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function createDnd5eCustomMonsterTraitDraft(): Dnd5eCustomMonsterTraitDraft {
  return {
    name: '',
    description: '',
    automation: 'dm-adjudication',
    ruleKind: 'none',
    amount: 10,
    dcBase: 5,
    damageTypes: [],
    requiresPositiveHp: true,
    excludedOnCritical: true,
    diesAtZeroWhenSuppressed: true,
    keenSense: 'smell',
    keenSenseSkillKey: 'perception',
    keenSenseCheckBonus: 4,
    keenSenseBlindsightFeet: 10,
    chargeMinimumFeet: 20,
    chargeActionId: '',
    chargeDamageDice: '2d10',
    chargeDamageType: 'piercing',
    limitedMagicImmunityMaximumSpellLevel: 6,
    limitedMagicImmunityAdvantageAboveMaximum: true,
    limitedMagicImmunityAllowsWilling: true,
    targetBonusConditions: ['frightened', 'stunned'],
    targetAttackBonus: 2,
    targetDamageBonus: 2,
  }
}

export function createDnd5eCustomMonsterActionDraft(): Dnd5eCustomMonsterActionDraft {
  return {
    id: `attack-${uid().slice(0, 8)}`,
    name: '爪击',
    description: '',
    kind: 'weapon-attack',
    automation: 'headless',
    mode: 'melee',
    toHit: 3,
    reachFeet: 5,
    rangeNormal: 30,
    rangeLong: 120,
    damageDice: '1d6+1',
    damageType: 'slashing',
    additionalDamage: [],
    criticalThreshold: 20,
    criticalExtraDamage: [],
    onHitSaveEnabled: false,
    onHitSaveAbility: 'str',
    onHitSaveDc: 12,
    onHitCondition: 'prone',
    attacksPerAction: 1,
    category: 'action',
    usageKind: 'at-will',
    usageMax: 1,
    rechargeMinimum: 5,
    rechargeDieSides: 6,
    legendaryCost: 1,
    referencedActionId: '',
    movementSpeedFraction: 0.5,
    reactionTriggerActionId: '',
  }
}

export function createDnd5eCustomMonsterMechanicDraft(): Dnd5eCustomMonsterMechanicDraft {
  return {
    id: `mechanic-${uid().slice(0, 8)}`,
    name: '低生命恢复',
    trigger: 'turn-start',
    triggerSubject: 'self',
    triggerRadiusFeet: 30,
    movementComparison: 'at-least',
    movementFeet: 20,
    hpPercentageAtOrBelow: 50,
    hpPercentageAtOrAbove: undefined,
    hpBelow: undefined,
    hpAtOrBelow: undefined,
    hpAbove: undefined,
    hpAtOrAbove: undefined,
    requiresPositiveHp: true,
    effectKind: 'healing',
    effectTarget: 'self',
    healingDice: '2d6',
    damageType: 'necrotic',
    condition: 'frightened',
    durationKind: 'rounds',
    durationRounds: 1,
    summonMonsterId: 'srd-5.1:wolf',
    summonCount: 1,
    summonDurationRounds: 10,
    areaShape: 'circle',
    areaRangeFeet: 60,
    areaSizeFeet: 15,
    modifierRoll: 'attack',
    modifierMode: 'bonus',
    modifierBonus: 2,
    attackToHit: 5,
    attackEconomy: 'reaction',
    attackDamageMode: 'dice',
    attackFixedDamage: 8,
    limit: 'once-per-combat',
    automation: 'full',
  }
}

export function createDnd5eCustomMonsterDraft(): Dnd5eCustomMonsterDraft {
  return {
    name: '自定义怪物',
    englishName: 'Custom Monster',
    size: '中型',
    creatureType: '怪兽',
    alignment: '无阵营',
    armorClass: 12,
    armorClassNote: '',
    hitPointsAverage: 11,
    hitPointsDice: '2d8+2',
    walk: 30,
    fly: 0,
    swim: 0,
    climb: 0,
    burrow: 0,
    hover: false,
    abilities: { str: 12, dex: 12, con: 12, int: 8, wis: 10, cha: 8 },
    savingThrows: {},
    skills: [],
    senses: [],
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    passivePerception: 10,
    languages: '',
    challengeRating: '1/4',
    xp: 50,
    description: '由 DM 创建的房间怪物。',
    tokenPortrait: undefined,
    initiativePortrait: undefined,
    equipment: [],
    legendaryResistanceUses: 0,
    legendaryActionPoints: 3,
    lairInitiative: 20,
    spellcastingEnabled: false,
    spellcastingDescription: '',
    spellcastingCasterLevel: 1,
    spellcastingAbility: 'int',
    spellcastingSaveDc: 11,
    spellcastingAttackBonus: 3,
    spellSlots: {},
    spells: [],
    spellcastingAutomation: 'dm-adjudication',
    targetingPriority: 'nearest',
    headlessMechanics: [],
    traits: [],
    actions: [createDnd5eCustomMonsterActionDraft()],
  }
}

function parseDice(value: string): { count: number; sides: number; bonus: number } {
  const match = value.replace(/\s+/g, '').match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/i)
  if (!match) throw new Error(`伤害骰格式无效：${value}`)
  const count = Number(match[1])
  const sides = Number(match[2])
  const bonus = match[3] ? Number(`${match[3]}${match[4]}`) : 0
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(sides) || sides < 2) throw new Error(`伤害骰格式无效：${value}`)
  return { count, sides, bonus }
}

function actionDescription(action: Dnd5eCustomMonsterActionDraft, dice: ReturnType<typeof parseDice>): string {
  if (action.description.trim()) return action.description.trim()
  const mode = action.mode === 'melee' ? '近战' : action.mode === 'ranged' ? '远程' : '近战或远程'
  const range = action.mode === 'melee'
    ? `触及 ${action.reachFeet} 尺`
    : action.mode === 'ranged'
      ? `射程 ${action.rangeNormal}/${action.rangeLong} 尺`
      : `触及 ${action.reachFeet} 尺或射程 ${action.rangeNormal}/${action.rangeLong} 尺`
  const bonus = dice.bonus === 0 ? '' : ` ${dice.bonus > 0 ? '+' : '−'} ${Math.abs(dice.bonus)}`
  return `${mode}武器攻击：命中 ${action.toHit >= 0 ? '+' : ''}${action.toHit}，${range}，单一目标。命中：${Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)}（${dice.count}d${dice.sides}${bonus}）点伤害。`
}

function normalizedAction(action: Dnd5eCustomMonsterActionDraft): Dnd5eMonsterAction {
  if (!action.name.trim()) throw new Error('动作名称不能为空')
  const usage = action.usageKind === 'per-day'
    ? { kind: 'per-day' as const, max: Math.max(1, Math.min(99, Math.trunc(action.usageMax))) }
    : action.usageKind === 'recharge'
      ? {
          kind: 'recharge' as const,
          dieSides: Math.max(2, Math.min(100, Math.trunc(action.rechargeDieSides))),
          minimum: Math.max(1, Math.min(Math.trunc(action.rechargeMinimum), Math.max(2, Math.trunc(action.rechargeDieSides)))),
        }
      : undefined
  const metadata = {
    ...(usage ? { usage } : {}),
    ...(action.category === 'legendary' ? { legendaryCost: Math.max(1, Math.min(10, Math.trunc(action.legendaryCost))) } : {}),
    ...(action.referencedActionId.trim() ? { referencedActionId: action.referencedActionId.trim() } : {}),
    ...(action.category === 'reaction' && action.reactionTriggerActionId.trim()
      ? { reactionTrigger: { kind: 'after-action' as const, actionId: action.reactionTriggerActionId.trim() } }
      : {}),
  }
  if (action.kind === 'movement') {
    return {
      id: action.id,
      name: action.name.trim(),
      description: action.description.trim() ||
        `该生物向一名可见敌人直线移动至多等于其速度 ${Math.round(action.movementSpeedFraction * 100)}% 的距离。`,
      kind: 'other',
      automation: 'dm-adjudication',
      movement: {
        kind: 'straight-toward-visible-hostile',
        maximumSpeedFraction: Math.max(0.05, Math.min(1, action.movementSpeedFraction)),
      },
      ...metadata,
    }
  }
  if (action.kind === 'other') {
    if (!action.description.trim()) throw new Error(`动作“${action.name}”需要填写规则描述`)
    return {
      id: action.id,
      name: action.name.trim(),
      description: action.description.trim(),
      kind: 'other',
      automation: 'dm-adjudication',
      ...metadata,
    }
  }
  const parsed = parseDice(action.damageDice)
  const additionalDamage = action.additionalDamage.map((component) => {
    const dice = parseDice(component.dice)
    return {
      average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)),
      ...dice,
      type: component.damageType,
    }
  })
  const criticalExtraDamage = action.criticalExtraDamage.map((component) => {
    const dice = parseDice(component.dice)
    return {
      average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)),
      ...dice,
      type: component.damageType,
    }
  })
  const attack = {
    mode: action.mode,
    toHit: Math.trunc(action.toHit),
    ...(action.mode !== 'ranged' ? { reachFeet: Math.max(0, Math.trunc(action.reachFeet)) } : {}),
    ...(action.mode !== 'melee' ? {
      rangeFeet: {
        normal: Math.max(0, Math.trunc(action.rangeNormal)),
        long: Math.max(Math.trunc(action.rangeNormal), Math.trunc(action.rangeLong)),
      },
    } : {}),
    target: '单一目标',
    damage: [{
      average: Math.max(0, Math.floor(parsed.count * (parsed.sides + 1) / 2 + parsed.bonus)),
      ...parsed,
      type: action.damageType,
    }, ...additionalDamage],
    ...(action.criticalThreshold < 20 ? {
      criticalThreshold: Math.max(2, Math.min(20, Math.trunc(action.criticalThreshold))),
    } : {}),
    ...(criticalExtraDamage.length > 0 ? { criticalExtraDamage } : {}),
    ...(action.onHitSaveEnabled ? {
      onHitRule: {
        kind: 'saving-throw-condition' as const,
        ability: action.onHitSaveAbility,
        dc: Math.max(1, Math.min(100, Math.trunc(action.onHitSaveDc))),
        condition: action.onHitCondition,
      },
    } : {}),
  } as const
  return {
    id: action.id,
    name: action.name.trim(),
    description: actionDescription(action, parsed),
    kind: 'weapon-attack',
    automation: action.category === 'action' || action.category === 'legendary'
      ? action.automation
      : 'dm-adjudication',
    attack,
    ...metadata,
  }
}

export function buildDnd5eCustomMonster(draft: Dnd5eCustomMonsterDraft): Dnd5eMonsterStatBlock {
  const slug = draft.slug ?? `custom-${uid()}`
  const preserved = draft.preservedStatBlock
  const normalizedDraftActions = draft.actions.map((draftAction) => {
    const normalized = normalizedAction(draftAction)
    const previous = [
      ...(preserved?.actions ?? []),
      ...(preserved?.bonusActions ?? []),
      ...(preserved?.reactions ?? []),
      ...(preserved?.legendaryActions ?? []),
      ...(preserved?.lairActions ?? []),
    ].find((action) => action.id === normalized.id && action.kind === normalized.kind)
    if (!previous) return normalized
    if (normalized.kind !== 'weapon-attack' || !normalized.attack || !previous.attack) {
      return { ...previous, ...normalized }
    }
    return {
      ...previous,
      ...normalized,
      attack: {
        ...previous.attack,
        ...normalized.attack,
        damage: normalized.attack.damage,
      },
    }
  })
  const actionById = new Map(normalizedDraftActions.map((action) => [action.id, action]))
  const actionsForCategory = (category: Dnd5eCustomMonsterActionDraft['category']) =>
    draft.actions.flatMap((action) => action.category === category ? [actionById.get(action.id)!] : [])
  const baseActions = actionsForCategory('action')
  const repeated = draft.actions.filter((action) =>
    action.category === 'action' && action.kind === 'weapon-attack' && action.attacksPerAction > 1)
  const actions: Dnd5eMonsterAction[] = [...baseActions]
  const preservedMultiattacks = preserved?.actions.filter((action) =>
    action.kind === 'multiattack' && action.sequence?.every((id) => baseActions.some((candidate) => candidate.id === id)),
  ) ?? []
  if (preservedMultiattacks.length > 0) {
    actions.unshift(...preservedMultiattacks.map((action) => structuredClone(action)))
  } else if (repeated.length > 0) {
    const sequence = repeated.flatMap((action) => Array.from({ length: Math.min(10, Math.max(2, Math.trunc(action.attacksPerAction))) }, () => action.id))
    const childrenHeadless = repeated.every((action) => action.automation === 'headless')
    actions.unshift({
      id: 'multiattack',
      name: '多重攻击',
      description: `该怪物进行 ${sequence.length} 次攻击。`,
      kind: 'multiattack',
      sequence,
      automation: childrenHeadless ? 'headless' : 'dm-adjudication',
    })
  }
  const traits = draft.traits.filter((trait) => trait.name.trim() || trait.description.trim()).map((trait) => {
    const rule = trait.ruleKind === 'undead-fortitude'
      ? {
          kind: 'undead-fortitude' as const,
          dcBase: Math.max(1, Math.min(100, Math.trunc(trait.dcBase))),
          excludedDamageTypes: [...new Set(trait.damageTypes)],
          excludedOnCritical: trait.excludedOnCritical,
        }
      : trait.ruleKind === 'regeneration'
        ? {
            kind: 'regeneration' as const,
            amount: Math.max(1, Math.trunc(trait.amount)),
            requiresPositiveHp: trait.requiresPositiveHp,
            suppressedByDamageTypes: [...new Set(trait.damageTypes)],
            diesAtZeroWhenSuppressed: trait.diesAtZeroWhenSuppressed,
          }
        : trait.ruleKind === 'swarm'
          ? { kind: 'swarm' as const, cannotRegainHitPoints: true as const, cannotGainTemporaryHitPoints: true as const }
          : trait.ruleKind === 'nimble-escape'
            ? { kind: 'nimble-escape' as const, bonusActionOptions: ['disengage', 'hide'] as const }
            : trait.ruleKind === 'keen-sense'
              ? {
                  kind: 'keen-sense' as const,
                  sense: trait.keenSense,
                  skillKey: trait.keenSenseSkillKey.trim() || 'perception',
                  checkBonus: Math.max(-100, Math.min(100, Math.trunc(trait.keenSenseCheckBonus))),
                  ...(trait.keenSenseBlindsightFeet > 0
                    ? { blindsightFeet: Math.trunc(trait.keenSenseBlindsightFeet) }
                    : {}),
                }
              : trait.ruleKind === 'ambusher'
                ? { kind: 'ambusher' as const, initiativeAdvantageWhenSurprising: true as const }
                : trait.ruleKind === 'charge-damage'
                  ? (() => {
                      const dice = parseDice(trait.chargeDamageDice)
                      if (!trait.chargeActionId.trim()) {
                        throw new Error(`特性“${trait.name}”必须选择触发追加伤害的攻击动作`)
                      }
                      return {
                        kind: 'charge-damage' as const,
                        minimumStraightMovementFeet: Math.max(5, Math.trunc(trait.chargeMinimumFeet)),
                        actionId: trait.chargeActionId.trim(),
                        extraDamage: {
                          average: Math.max(0, Math.floor(dice.count * (dice.sides + 1) / 2 + dice.bonus)),
                          ...dice,
                          type: trait.chargeDamageType,
                        },
                      }
                    })()
                  : trait.ruleKind === 'magic-resistance'
                    ? { kind: 'magic-resistance' as const, savingThrowAdvantageAgainstMagic: true as const }
                    : trait.ruleKind === 'limited-magic-immunity'
                      ? {
                          kind: 'limited-magic-immunity' as const,
                          maximumSpellLevel: Math.max(
                            0,
                            Math.min(9, Math.trunc(trait.limitedMagicImmunityMaximumSpellLevel)),
                          ),
                          advantageAboveMaximum: trait.limitedMagicImmunityAdvantageAboveMaximum,
                          allowsWilling: trait.limitedMagicImmunityAllowsWilling,
                        }
                      : trait.ruleKind === 'magic-weapons'
                        ? { kind: 'magic-weapons' as const, weaponAttacksMagical: true as const }
                    : trait.ruleKind === 'pack-tactics'
                      ? {
                          kind: 'pack-tactics' as const,
                          allyDistanceFeet: 5,
                          requiresAllyNotIncapacitated: true as const,
                        }
                    : trait.ruleKind === 'conditional-target-bonus'
                      ? {
                          kind: 'conditional-target-bonus' as const,
                          targetConditions: [...new Set(trait.targetBonusConditions)],
                          attackBonus: Math.max(-100, Math.min(100, Math.trunc(trait.targetAttackBonus))),
                          damageBonus: Math.max(-1_000_000, Math.min(1_000_000, Math.trunc(trait.targetDamageBonus))),
                        }
                      : undefined
    const headlessRule = rule?.kind === 'undead-fortitude' ||
      rule?.kind === 'regeneration' ||
      rule?.kind === 'swarm' ||
      rule?.kind === 'nimble-escape' ||
      rule?.kind === 'magic-resistance' ||
      rule?.kind === 'limited-magic-immunity' ||
      rule?.kind === 'magic-weapons' ||
      rule?.kind === 'conditional-target-bonus'
    return {
      name: trait.name.trim(),
      description: trait.description.trim(),
      automation: headlessRule ? ('headless' as const) : ('dm-adjudication' as const),
      ...(rule ? { rule } : {}),
    }
  })
  const traitNameIncludes = (pattern: RegExp) => traits.some((trait) => pattern.test(trait.name))
  const capabilities = {
    swarm: traitNameIncludes(/群集|swarm/i),
    shapechanger: traitNameIncludes(/变形|shapechange/i),
    regeneration: traitNameIncludes(/再生|regeneration/i),
    spellcaster: draft.spellcastingEnabled || traitNameIncludes(/施法|spellcasting/i),
    legendary: preserved?.capabilities?.legendary === true ||
      draft.legendaryResistanceUses > 0 ||
      draft.actions.some((action) => action.category === 'legendary'),
    hasFlySpeed: draft.fly > 0,
    hasSwimSpeed: draft.swim > 0,
  }
  const headlessMechanics: Dnd5eMonsterMechanicTriggerV2[] = (draft.headlessMechanics ?? []).map((mechanic) => {
    const fixedDamageType: Dnd5eDamageType = mechanic.damageType === 'inherit-trigger'
      ? 'force'
      : mechanic.damageType
    if (!mechanic.name.trim()) throw new Error('怪物机制名称不能为空')
    const dice = (
      ['healing', 'temporary-hit-points', 'damage', 'area-attack'].includes(mechanic.effectKind) ||
      (mechanic.effectKind === 'attack' && mechanic.attackDamageMode === 'dice')
    )
      ? parseDice(mechanic.healingDice)
      : undefined
    const effect: Dnd5eMonsterMechanicEffectV2 = mechanic.effectKind === 'healing' || mechanic.effectKind === 'temporary-hit-points'
      ? { id: 'effect-0', kind: mechanic.effectKind, target: 'self' as const, dice: dice! }
      : mechanic.effectKind === 'damage'
        ? { id: 'effect-0', kind: 'damage' as const, target: mechanic.effectTarget, dice: dice!, damageType: mechanic.damageType }
        : mechanic.effectKind === 'standard-condition'
          ? {
              id: 'effect-0', kind: 'standard-condition' as const, target: mechanic.effectTarget,
              condition: mechanic.condition,
              duration: mechanic.durationKind === 'rounds'
                ? { kind: 'rounds' as const, rounds: Math.max(1, Math.trunc(mechanic.durationRounds)) }
                : { kind: mechanic.durationKind },
            }
          : mechanic.effectKind === 'remove-standard-condition'
            ? {
                id: 'effect-0', kind: 'remove-standard-condition' as const,
                target: mechanic.effectTarget, condition: mechanic.condition,
              }
          : mechanic.effectKind === 'summon'
            ? {
                id: 'effect-0', kind: 'summon' as const, monsterId: mechanic.summonMonsterId,
                count: Math.max(1, Math.trunc(mechanic.summonCount)),
                durationRounds: Math.max(1, Math.trunc(mechanic.summonDurationRounds)),
              }
            : mechanic.effectKind === 'roll-modifier'
              ? {
                  id: 'effect-0', kind: 'roll-modifier' as const, target: mechanic.effectTarget,
                  roll: mechanic.modifierRoll, mode: mechanic.modifierMode,
                  ...(mechanic.modifierMode === 'bonus'
                    ? { bonus: Math.trunc(mechanic.modifierBonus) }
                    : {}),
                }
              : mechanic.effectKind === 'attack'
                ? {
                    id: 'effect-0', kind: 'attack' as const, target: mechanic.effectTarget,
                    toHit: Math.trunc(mechanic.attackToHit),
                    economy: mechanic.attackEconomy,
                    damage: mechanic.attackDamageMode === 'fixed'
                      ? {
                          average: Math.max(0, Math.trunc(mechanic.attackFixedDamage)),
                          count: 0, sides: 2,
                          bonus: Math.max(0, Math.trunc(mechanic.attackFixedDamage)),
                          type: fixedDamageType,
                        }
                      : {
                          average: Math.max(0, Math.floor(dice!.count * (dice!.sides + 1) / 2 + dice!.bonus)),
                          ...dice!,
                          type: fixedDamageType,
                        },
                  }
                : {
                id: 'effect-0', kind: 'area-attack' as const, shape: mechanic.areaShape,
                rangeFeet: Math.max(0, Math.trunc(mechanic.areaRangeFeet)),
                sizeFeet: Math.max(5, Math.trunc(mechanic.areaSizeFeet)),
                dice: dice!, damageType: fixedDamageType,
              }
    return {
      schemaVersion: 2,
      id: mechanic.id,
      name: mechanic.name.trim(),
      trigger: {
        event: mechanic.trigger,
        ...(mechanic.triggerSubject !== 'self' ? { subject: mechanic.triggerSubject } : {}),
        ...(mechanic.triggerSubject !== 'self'
          ? { radiusFeet: Math.max(5, Math.trunc(mechanic.triggerRadiusFeet)) }
          : {}),
        ...(mechanic.trigger === 'movement'
          ? {
              movement: {
                comparison: mechanic.movementComparison,
                feet: Math.max(0, Math.trunc(mechanic.movementFeet)),
              },
            }
          : {}),
      },
      predicates: {
        ...(Number.isFinite(mechanic.hpPercentageAtOrBelow)
          ? { hpPercentageAtOrBelow: Math.max(0, Math.min(100, Number(mechanic.hpPercentageAtOrBelow))) }
          : {}),
        ...(Number.isFinite(mechanic.hpPercentageAtOrAbove)
          ? { hpPercentageAtOrAbove: Math.max(0, Math.min(100, Number(mechanic.hpPercentageAtOrAbove))) }
          : {}),
        ...(Number.isFinite(mechanic.hpBelow)
          ? { hpBelow: Math.max(0, Math.trunc(Number(mechanic.hpBelow))) }
          : {}),
        ...(Number.isFinite(mechanic.hpAtOrBelow)
          ? { hpAtOrBelow: Math.max(0, Math.trunc(Number(mechanic.hpAtOrBelow))) }
          : {}),
        ...(Number.isFinite(mechanic.hpAbove)
          ? { hpAbove: Math.max(0, Math.trunc(Number(mechanic.hpAbove))) }
          : {}),
        ...(Number.isFinite(mechanic.hpAtOrAbove)
          ? { hpAtOrAbove: Math.max(0, Math.trunc(Number(mechanic.hpAtOrAbove))) }
          : {}),
        requiresPositiveHp: mechanic.requiresPositiveHp,
      },
      effects: [effect, ...(mechanic.preservedEffects?.slice(1).map((entry) => structuredClone(entry)) ?? [])],
      limit: mechanic.limit,
      automation: mechanic.automation,
    }
  })
  const monster: Dnd5eMonsterStatBlock = {
    ...preserved,
    id: draft.id ?? `room-monster:${slug}`,
    slug,
    name: draft.name.trim(),
    englishName: draft.englishName.trim() || draft.name.trim(),
    source: 'DM 自定义',
    size: draft.size,
    creatureType: draft.creatureType.trim(),
    alignment: draft.alignment.trim(),
    armorClass: {
      value: Math.trunc(draft.armorClass),
      ...(draft.armorClassNote.trim() ? { note: draft.armorClassNote.trim() } : {}),
    },
    hitPoints: { average: Math.trunc(draft.hitPointsAverage), dice: draft.hitPointsDice.replace(/\s+/g, '') },
    speed: {
      walk: Math.trunc(draft.walk),
      ...(draft.fly > 0 ? { fly: Math.trunc(draft.fly), hover: draft.hover } : {}),
      ...(draft.swim > 0 ? { swim: Math.trunc(draft.swim) } : {}),
      ...(draft.climb > 0 ? { climb: Math.trunc(draft.climb) } : {}),
      ...(draft.burrow > 0 ? { burrow: Math.trunc(draft.burrow) } : {}),
    },
    abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, Math.trunc(draft.abilities[key])])) as Record<AbilityKey, number>,
    savingThrows: Object.fromEntries(Object.entries(draft.savingThrows)
      .filter(([, value]) => Number.isFinite(value))
      .map(([key, value]) => [key, Math.trunc(value!)])),
    skills: draft.skills.filter((skill) => skill.key.trim() && skill.name.trim()).map((skill) => ({
      key: skill.key.trim(),
      name: skill.name.trim(),
      bonus: Math.trunc(skill.bonus),
    })),
    senses: [
      ...draft.senses.filter((sense) => sense.name.trim()).map((sense) => ({
        name: sense.name.trim(),
        ...(Number.isFinite(sense.distanceFeet) ? { distanceFeet: Math.max(0, Math.trunc(sense.distanceFeet!)) } : {}),
      })),
      ...traits.flatMap((trait) =>
        trait.rule?.kind === 'keen-sense' && (trait.rule.blindsightFeet ?? 0) > 0
          ? [{ name: '盲视', distanceFeet: trait.rule.blindsightFeet }]
          : []),
    ].filter((sense, index, senses) =>
      senses.findIndex((candidate) =>
        candidate.name === sense.name && candidate.distanceFeet === sense.distanceFeet) === index),
    damageVulnerabilities: [...new Set(draft.damageVulnerabilities)],
    damageResistances: [...new Set(draft.damageResistances)],
    damageImmunities: [...new Set(draft.damageImmunities)],
    ...(draft.damageDefenseRules !== undefined
      ? {
          damageDefenseRules: draft.damageDefenseRules.map((rule) =>
            structuredClone(rule)),
        }
      : {}),
    ...(draft.unparsedDamageDefenses !== undefined
      ? {
          unparsedDamageDefenses: draft.unparsedDamageDefenses.map((defense) =>
            structuredClone(defense)),
        }
      : {}),
    conditionImmunities: [...new Set(draft.conditionImmunities)],
    passivePerception: Math.trunc(draft.passivePerception),
    languages: draft.languages.split(/[,，、]/).map((entry) => entry.trim()).filter(Boolean),
    challenge: { rating: draft.challengeRating.trim(), xp: Math.trunc(draft.xp) },
    legendaryResistanceUses: Math.max(0, Math.min(99, Math.trunc(draft.legendaryResistanceUses))),
    legendaryActionPoints: Math.max(0, Math.min(99, Math.trunc(draft.legendaryActionPoints))),
    lairInitiative: Math.max(0, Math.min(99, Math.trunc(draft.lairInitiative))),
    ...(draft.tokenPortrait ? { tokenPortrait: draft.tokenPortrait } : {}),
    ...(draft.initiativePortrait ? { initiativePortrait: draft.initiativePortrait } : {}),
    equipment: draft.equipment.filter((item) => item.name.trim()).map((item) => ({
      id: item.id,
      name: item.name.trim(),
      category: item.category,
      quantity: Math.max(1, Math.min(999, Math.trunc(item.quantity))),
      ...(item.description.trim() ? { description: item.description.trim() } : {}),
      ...(Number.isFinite(item.armorClass) ? { armorClass: Math.max(0, Math.trunc(item.armorClass!)) } : {}),
      ...(item.linkedActionId.trim() ? { linkedActionId: item.linkedActionId.trim() } : {}),
    })),
    traits,
    actions,
    bonusActions: actionsForCategory('bonus-action'),
    reactions: actionsForCategory('reaction'),
    legendaryActions: actionsForCategory('legendary'),
    lairActions: actionsForCategory('lair'),
    spellcasting: draft.spellcastingEnabled ? {
      description: draft.spellcastingDescription.trim() || '该生物拥有施法能力。',
      casterLevel: Math.max(1, Math.min(30, Math.trunc(draft.spellcastingCasterLevel))),
      ability: draft.spellcastingAbility,
      saveDc: Math.max(1, Math.min(100, Math.trunc(draft.spellcastingSaveDc))),
      attackBonus: Math.max(-100, Math.min(100, Math.trunc(draft.spellcastingAttackBonus))),
      slots: Object.fromEntries(Object.entries(draft.spellSlots)
        .filter(([level, count]) => /^[1-9]$/.test(level) && Number.isFinite(count) && count > 0)
        .map(([level, count]) => [level, Math.max(0, Math.min(99, Math.trunc(count)))])),
      spells: draft.spells.filter((spell) => spell.id.trim() && spell.name.trim()).map((spell) => ({
        id: spell.id.trim(),
        name: spell.name.trim(),
        level: Math.max(0, Math.min(9, Math.trunc(spell.level))),
        ...(spell.usageKind === 'at-will'
          ? { usage: { kind: 'at-will' as const } }
          : spell.usageKind === 'per-day'
            ? { usage: { kind: 'per-day' as const, max: Math.max(1, Math.min(99, Math.trunc(spell.usageMax))) } }
            : {}),
      })),
      automation: draft.spellcastingAutomation,
    } : undefined,
    capabilities,
    targetingPreference: { schemaVersion: 1, priority: draft.targetingPriority ?? 'nearest' },
    headlessMechanics,
    description: draft.description.trim(),
  }
  const parsed = parseDnd5eMonsterStatBlock(monster)
  if (!parsed.ok) throw new Error(parsed.issues.map((entry) => entry.message).join('；'))
  return parsed.value
}

export function dnd5eCustomMonsterDraftFromStatBlock(monster: Dnd5eMonsterStatBlock): Dnd5eCustomMonsterDraft {
  const actionGroups: readonly [
    Dnd5eCustomMonsterActionDraft['category'],
    readonly Dnd5eMonsterAction[],
  ][] = [
    ['action', monster.actions.filter((action) => action.kind !== 'multiattack')],
    ['bonus-action', monster.bonusActions ?? []],
    ['reaction', monster.reactions ?? []],
    ['legendary', monster.legendaryActions ?? []],
    ['lair', monster.lairActions ?? []],
  ]
  const draftActions: Dnd5eCustomMonsterActionDraft[] = actionGroups.flatMap(([category, entries]) =>
    entries.map((action) => {
      const damage = action.attack?.damage[0]
      const usage = action.usage
      return {
        id: action.id,
        name: action.name,
        description: action.description,
        kind: action.kind === 'weapon-attack' ? 'weapon-attack' : action.movement ? 'movement' : 'other',
        automation: action.automation ?? (action.kind === 'weapon-attack' ? 'headless' : 'dm-adjudication'),
        mode: action.attack?.mode ?? 'melee',
        toHit: action.attack?.toHit ?? 0,
        reachFeet: action.attack?.reachFeet ?? 5,
        rangeNormal: action.attack?.rangeFeet?.normal ?? 30,
        rangeLong: action.attack?.rangeFeet?.long ?? 120,
        damageDice: damage ? `${damage.count}d${damage.sides}${damage.bonus === 0 ? '' : damage.bonus > 0 ? `+${damage.bonus}` : damage.bonus}` : '1d4',
        damageType: damage?.type ?? 'bludgeoning',
        additionalDamage: (action.attack?.damage.slice(1) ?? []).map((component) => ({
          id: `damage-${uid().slice(0, 8)}`,
          dice: `${component.count}d${component.sides}${component.bonus === 0 ? '' : component.bonus > 0 ? `+${component.bonus}` : component.bonus}`,
          damageType: component.type,
        })),
        criticalThreshold: action.attack?.criticalThreshold ?? 20,
        criticalExtraDamage: (action.attack?.criticalExtraDamage ?? []).map((component) => ({
          id: `critical-damage-${uid().slice(0, 8)}`,
          dice: `${component.count}d${component.sides}${component.bonus === 0 ? '' : component.bonus > 0 ? `+${component.bonus}` : component.bonus}`,
          damageType: component.type,
        })),
        onHitSaveEnabled: action.attack?.onHitRule?.kind === 'saving-throw-condition',
        onHitSaveAbility: action.attack?.onHitRule?.ability ?? 'str',
        onHitSaveDc: action.attack?.onHitRule?.dc ?? 12,
        onHitCondition: action.attack?.onHitRule?.condition ?? 'prone',
        attacksPerAction: category === 'action'
          ? Math.max(1, monster.actions.find((candidate) => candidate.kind === 'multiattack')?.sequence?.filter((id) => id === action.id).length ?? 1)
          : 1,
        category,
        usageKind: usage?.kind ?? 'at-will',
        usageMax: usage?.kind === 'per-day' ? usage.max : 1,
        rechargeMinimum: usage?.kind === 'recharge' ? usage.minimum : 5,
        rechargeDieSides: usage?.kind === 'recharge' ? usage.dieSides : 6,
        legendaryCost: action.legendaryCost ?? 1,
        referencedActionId: action.referencedActionId ?? '',
        movementSpeedFraction: action.movement?.maximumSpeedFraction ?? 0.5,
        reactionTriggerActionId: action.reactionTrigger?.actionId ?? '',
      }
    }),
  )
  return {
    preservedStatBlock: structuredClone(monster),
    id: monster.id,
    slug: monster.slug,
    name: monster.name,
    englishName: monster.englishName,
    size: monster.size,
    creatureType: monster.creatureType,
    alignment: monster.alignment,
    armorClass: monster.armorClass.value,
    armorClassNote: monster.armorClass.note ?? '',
    hitPointsAverage: monster.hitPoints.average,
    hitPointsDice: monster.hitPoints.dice,
    walk: monster.speed.walk,
    fly: monster.speed.fly ?? 0,
    swim: monster.speed.swim ?? 0,
    climb: monster.speed.climb ?? 0,
    burrow: monster.speed.burrow ?? 0,
    hover: monster.speed.hover ?? false,
    abilities: { ...monster.abilities },
    savingThrows: { ...(monster.savingThrows ?? {}) },
    skills: (monster.skills ?? []).map((skill) => ({ id: `skill-${uid().slice(0, 8)}`, ...skill })),
    senses: monster.senses
      .filter((sense) => !monster.traits.some((trait) =>
        trait.rule?.kind === 'keen-sense' &&
        sense.name === '盲视' &&
        sense.distanceFeet === trait.rule.blindsightFeet))
      .map((sense) => ({ id: `sense-${uid().slice(0, 8)}`, ...sense })),
    damageVulnerabilities: [...(monster.damageVulnerabilities ?? [])],
    damageResistances: [...(monster.damageResistances ?? [])],
    damageImmunities: [...(monster.damageImmunities ?? [])],
    damageDefenseRules: monster.damageDefenseRules?.map((rule) =>
      structuredClone(rule)),
    unparsedDamageDefenses: monster.unparsedDamageDefenses?.map((defense) =>
      structuredClone(defense)),
    conditionImmunities: (monster.conditionImmunities ?? [])
      .filter((condition): condition is Dnd5eStandardConditionId =>
        Object.values(DND5E_STANDARD_CONDITIONS).some((definition) => definition.id === condition)),
    passivePerception: monster.passivePerception,
    languages: monster.languages.join('、'),
    challengeRating: monster.challenge.rating,
    xp: monster.challenge.xp,
    description: monster.description,
    tokenPortrait: monster.tokenPortrait,
    initiativePortrait: monster.initiativePortrait,
    equipment: (monster.equipment ?? []).map((item) => ({
      ...item,
      description: item.description ?? '',
      linkedActionId: item.linkedActionId ?? '',
    })),
    legendaryResistanceUses: monster.legendaryResistanceUses ?? 0,
    legendaryActionPoints: monster.legendaryActionPoints ?? 3,
    lairInitiative: monster.lairInitiative ?? 20,
    spellcastingEnabled: !!monster.spellcasting,
    spellcastingDescription: monster.spellcasting?.description ?? '',
    spellcastingCasterLevel: monster.spellcasting?.casterLevel ?? 1,
    spellcastingAbility: monster.spellcasting?.ability ?? 'int',
    spellcastingSaveDc: monster.spellcasting?.saveDc ?? 11,
    spellcastingAttackBonus: monster.spellcasting?.attackBonus ?? 3,
    spellSlots: { ...(monster.spellcasting?.slots ?? {}) },
    spells: (monster.spellcasting?.spells ?? []).map((spell) => ({
      id: spell.id,
      name: spell.name,
      level: spell.level,
      usageKind: spell.usage?.kind ?? 'slots',
      usageMax: spell.usage?.kind === 'per-day' ? spell.usage.max : 1,
    })),
    spellcastingAutomation: monster.spellcasting?.automation ?? 'dm-adjudication',
    targetingPriority: monster.targetingPreference?.priority ?? 'nearest',
    headlessMechanics: (monster.headlessMechanics ?? []).map((mechanic) => {
      const effect = mechanic.schemaVersion === 1
        ? { id: 'effect-0', kind: 'healing' as const, target: 'self' as const, dice: mechanic.effect.dice }
        : mechanic.effects[0]
      const dice = effect?.kind === 'attack'
        ? effect.damage
        : effect && 'dice' in effect
          ? effect.dice
          : { count: 2, sides: 6, bonus: 0 }
      const duration = effect?.kind === 'standard-condition' ? effect.duration : { kind: 'rounds' as const, rounds: 1 }
      return {
        id: mechanic.id,
        name: mechanic.name,
        trigger: mechanic.schemaVersion === 1 ? mechanic.event : mechanic.trigger.event,
        triggerSubject: mechanic.schemaVersion === 2 ? mechanic.trigger.subject ?? 'self' : 'self',
        triggerRadiusFeet: mechanic.schemaVersion === 2 ? mechanic.trigger.radiusFeet ?? 30 : 30,
        movementComparison: mechanic.schemaVersion === 2
          ? mechanic.trigger.movement?.comparison ?? 'at-least'
          : 'at-least',
        movementFeet: mechanic.schemaVersion === 2 ? mechanic.trigger.movement?.feet ?? 20 : 20,
        hpPercentageAtOrBelow: mechanic.predicates.hpPercentageAtOrBelow,
        hpPercentageAtOrAbove: mechanic.schemaVersion === 2 ? mechanic.predicates.hpPercentageAtOrAbove : undefined,
        hpBelow: mechanic.schemaVersion === 2 ? mechanic.predicates.hpBelow : undefined,
        hpAtOrBelow: mechanic.schemaVersion === 2 ? mechanic.predicates.hpAtOrBelow : undefined,
        hpAbove: mechanic.schemaVersion === 2 ? mechanic.predicates.hpAbove : undefined,
        hpAtOrAbove: mechanic.schemaVersion === 2 ? mechanic.predicates.hpAtOrAbove : undefined,
        requiresPositiveHp: mechanic.predicates.requiresPositiveHp,
        effectKind: effect?.kind ?? 'healing',
        effectTarget: effect && 'target' in effect ? effect.target : 'self',
        healingDice: `${dice.count}d${dice.sides}${dice.bonus === 0 ? '' : dice.bonus > 0 ? `+${dice.bonus}` : dice.bonus}`,
        damageType: effect?.kind === 'attack'
          ? effect.damage.type
          : effect && 'damageType' in effect
            ? effect.damageType
            : 'necrotic',
        condition: effect?.kind === 'standard-condition' || effect?.kind === 'remove-standard-condition'
          ? effect.condition
          : 'frightened',
        durationKind: duration.kind,
        durationRounds: duration.kind === 'rounds' ? duration.rounds : 1,
        summonMonsterId: effect?.kind === 'summon' ? effect.monsterId : 'srd-5.1:wolf',
        summonCount: effect?.kind === 'summon' ? effect.count : 1,
        summonDurationRounds: effect?.kind === 'summon' ? effect.durationRounds : 10,
        areaShape: effect?.kind === 'area-attack' ? effect.shape : 'circle',
        areaRangeFeet: effect?.kind === 'area-attack' ? effect.rangeFeet : 60,
        areaSizeFeet: effect?.kind === 'area-attack' ? effect.sizeFeet : 15,
        modifierRoll: effect?.kind === 'roll-modifier' ? effect.roll : 'attack',
        modifierMode: effect?.kind === 'roll-modifier' ? effect.mode : 'bonus',
        modifierBonus: effect?.kind === 'roll-modifier' ? effect.bonus ?? 0 : 2,
        attackToHit: effect?.kind === 'attack' ? effect.toHit : 5,
        attackEconomy: effect?.kind === 'attack' ? effect.economy ?? 'none' : 'reaction',
        attackDamageMode: effect?.kind === 'attack' && effect.damage.count === 0 ? 'fixed' : 'dice',
        attackFixedDamage: effect?.kind === 'attack' ? effect.damage.average : 8,
        limit: mechanic.limit,
        automation: mechanic.schemaVersion === 1 ? 'full' : mechanic.automation,
        preservedEffects: mechanic.schemaVersion === 1
          ? undefined
          : mechanic.effects.map((entry) => structuredClone(entry)),
      }
    }),
    traits: monster.traits.map((trait) => ({
      ...createDnd5eCustomMonsterTraitDraft(),
      name: trait.name,
      description: trait.description,
      automation: trait.automation ?? 'dm-adjudication',
      ruleKind: trait.rule?.kind === 'mucous-cloud' ? 'none' : trait.rule?.kind ?? 'none',
      amount: trait.rule?.kind === 'regeneration' ? trait.rule.amount : 10,
      dcBase: trait.rule?.kind === 'undead-fortitude' ? trait.rule.dcBase : 5,
      damageTypes: trait.rule?.kind === 'regeneration'
        ? [...trait.rule.suppressedByDamageTypes]
        : trait.rule?.kind === 'undead-fortitude'
          ? [...trait.rule.excludedDamageTypes]
          : [],
      requiresPositiveHp: trait.rule?.kind === 'regeneration' ? trait.rule.requiresPositiveHp : true,
      excludedOnCritical: trait.rule?.kind === 'undead-fortitude' ? trait.rule.excludedOnCritical : true,
      diesAtZeroWhenSuppressed: trait.rule?.kind === 'regeneration' ? trait.rule.diesAtZeroWhenSuppressed : true,
      keenSense: trait.rule?.kind === 'keen-sense' ? trait.rule.sense : 'smell',
      keenSenseSkillKey: trait.rule?.kind === 'keen-sense' ? trait.rule.skillKey : 'perception',
      keenSenseCheckBonus: trait.rule?.kind === 'keen-sense' ? trait.rule.checkBonus : 4,
      keenSenseBlindsightFeet: trait.rule?.kind === 'keen-sense' ? trait.rule.blindsightFeet ?? 0 : 10,
      chargeMinimumFeet: trait.rule?.kind === 'charge-damage'
        ? trait.rule.minimumStraightMovementFeet
        : 20,
      chargeActionId: trait.rule?.kind === 'charge-damage' ? trait.rule.actionId : '',
      chargeDamageDice: trait.rule?.kind === 'charge-damage'
        ? `${trait.rule.extraDamage.count}d${trait.rule.extraDamage.sides}${
            trait.rule.extraDamage.bonus === 0
              ? ''
              : trait.rule.extraDamage.bonus > 0
                ? `+${trait.rule.extraDamage.bonus}`
                : trait.rule.extraDamage.bonus
          }`
        : '2d10',
      chargeDamageType: trait.rule?.kind === 'charge-damage'
        ? trait.rule.extraDamage.type
        : 'piercing',
      limitedMagicImmunityMaximumSpellLevel: trait.rule?.kind === 'limited-magic-immunity'
        ? trait.rule.maximumSpellLevel
        : 6,
      limitedMagicImmunityAdvantageAboveMaximum: trait.rule?.kind === 'limited-magic-immunity'
        ? trait.rule.advantageAboveMaximum
        : true,
      limitedMagicImmunityAllowsWilling: trait.rule?.kind === 'limited-magic-immunity'
        ? trait.rule.allowsWilling
        : true,
      targetBonusConditions: trait.rule?.kind === 'conditional-target-bonus'
        ? [...trait.rule.targetConditions]
        : ['frightened', 'stunned'],
      targetAttackBonus: trait.rule?.kind === 'conditional-target-bonus' ? trait.rule.attackBonus : 2,
      targetDamageBonus: trait.rule?.kind === 'conditional-target-bonus' ? trait.rule.damageBonus : 2,
    })),
    actions: draftActions,
  }
}

export { DND5E_DAMAGE_TYPES }
