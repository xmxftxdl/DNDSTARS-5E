import type { AbilityKey } from '../../lib/dnd'
import {
  DND5E_DAMAGE_TYPES,
  type Dnd5eDamageType,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterMechanicEffectV2,
  type Dnd5eMonsterMechanicEffectTargetV2,
  type Dnd5eMonsterMechanicTrigger,
  type Dnd5eMonsterMechanicTriggerEventV2,
  type Dnd5eMonsterMechanicTriggerV2,
  type Dnd5eMonsterSize,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterTargetPriority,
} from './monsters'
import type { Dnd5eStandardConditionId } from './conditions'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export interface Dnd5eCustomMonsterTraitDraft {
  name: string
  description: string
}

export interface Dnd5eCustomMonsterActionDraft {
  id: string
  name: string
  description: string
  kind: 'weapon-attack' | 'other'
  automation: 'headless' | 'dm-adjudication'
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  toHit: number
  reachFeet: number
  rangeNormal: number
  rangeLong: number
  damageDice: string
  damageType: Dnd5eDamageType
  attacksPerAction: number
}

export interface Dnd5eCustomMonsterMechanicDraft {
  id: string
  name: string
  trigger: Dnd5eMonsterMechanicTriggerEventV2
  hpPercentageAtOrBelow?: number
  hpPercentageAtOrAbove?: number
  requiresPositiveHp: boolean
  effectKind: 'healing' | 'temporary-hit-points' | 'damage' | 'standard-condition' | 'summon' | 'area-attack'
  effectTarget: Dnd5eMonsterMechanicEffectTargetV2
  healingDice: string
  damageType: Dnd5eDamageType
  condition: Dnd5eStandardConditionId
  durationKind: 'permanent' | 'until-target-turn-start' | 'until-source-turn-start' | 'rounds'
  durationRounds: number
  summonMonsterId: string
  summonCount: number
  summonDurationRounds: number
  areaShape: 'circle' | 'cone' | 'line'
  areaRangeFeet: number
  areaSizeFeet: number
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
  hitPointsAverage: number
  hitPointsDice: string
  walk: number
  fly: number
  swim: number
  climb: number
  burrow: number
  hover: boolean
  abilities: Record<AbilityKey, number>
  passivePerception: number
  languages: string
  challengeRating: string
  xp: number
  description: string
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
    attacksPerAction: 1,
  }
}

export function createDnd5eCustomMonsterMechanicDraft(): Dnd5eCustomMonsterMechanicDraft {
  return {
    id: `mechanic-${uid().slice(0, 8)}`,
    name: '低生命恢复',
    trigger: 'turn-start',
    hpPercentageAtOrBelow: 50,
    hpPercentageAtOrAbove: undefined,
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
    hitPointsAverage: 11,
    hitPointsDice: '2d8+2',
    walk: 30,
    fly: 0,
    swim: 0,
    climb: 0,
    burrow: 0,
    hover: false,
    abilities: { str: 12, dex: 12, con: 12, int: 8, wis: 10, cha: 8 },
    passivePerception: 10,
    languages: '',
    challengeRating: '1/4',
    xp: 50,
    description: '由 DM 创建的房间怪物。',
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
  if (action.kind === 'other') {
    if (!action.description.trim()) throw new Error(`动作“${action.name}”需要填写规则描述`)
    return {
      id: action.id,
      name: action.name.trim(),
      description: action.description.trim(),
      kind: 'other',
      automation: 'dm-adjudication',
    }
  }
  const parsed = parseDice(action.damageDice)
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
    }],
  } as const
  return {
    id: action.id,
    name: action.name.trim(),
    description: actionDescription(action, parsed),
    kind: 'weapon-attack',
    automation: action.automation,
    attack,
  }
}

export function buildDnd5eCustomMonster(draft: Dnd5eCustomMonsterDraft): Dnd5eMonsterStatBlock {
  const slug = draft.slug ?? `custom-${uid()}`
  const preserved = draft.preservedStatBlock
  const baseActions = draft.actions.map((draftAction) => {
    const normalized = normalizedAction(draftAction)
    const previous = preserved?.actions.find((action) => action.id === normalized.id && action.kind === normalized.kind)
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
        damage: [normalized.attack.damage[0], ...previous.attack.damage.slice(1)],
      },
    }
  })
  const repeated = draft.actions.filter((action) => action.kind === 'weapon-attack' && action.attacksPerAction > 1)
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
    const previous = preserved?.traits.find((candidate) => candidate.name === trait.name.trim())
    return {
      ...previous,
      name: trait.name.trim(),
      description: trait.description.trim(),
      automation: previous?.automation ?? ('dm-adjudication' as const),
    }
  })
  const traitNameIncludes = (pattern: RegExp) => traits.some((trait) => pattern.test(trait.name))
  const capabilities = {
    swarm: traitNameIncludes(/群集|swarm/i),
    shapechanger: traitNameIncludes(/变形|shapechange/i),
    regeneration: traitNameIncludes(/再生|regeneration/i),
    spellcaster: preserved?.spellcasting != null || traitNameIncludes(/施法|spellcasting/i),
    legendary: preserved?.capabilities?.legendary === true ||
      (preserved?.legendaryResistanceUses ?? 0) > 0 ||
      (preserved?.legendaryActions?.length ?? 0) > 0,
    hasFlySpeed: draft.fly > 0,
    hasSwimSpeed: draft.swim > 0,
  }
  const headlessMechanics: Dnd5eMonsterMechanicTriggerV2[] = (draft.headlessMechanics ?? []).map((mechanic) => {
    if (!mechanic.name.trim()) throw new Error('怪物机制名称不能为空')
    const dice = ['healing', 'temporary-hit-points', 'damage', 'area-attack'].includes(mechanic.effectKind)
      ? parseDice(mechanic.healingDice)
      : undefined
    const effect = mechanic.effectKind === 'healing' || mechanic.effectKind === 'temporary-hit-points'
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
          : mechanic.effectKind === 'summon'
            ? {
                id: 'effect-0', kind: 'summon' as const, monsterId: mechanic.summonMonsterId,
                count: Math.max(1, Math.trunc(mechanic.summonCount)),
                durationRounds: Math.max(1, Math.trunc(mechanic.summonDurationRounds)),
              }
            : {
                id: 'effect-0', kind: 'area-attack' as const, shape: mechanic.areaShape,
                rangeFeet: Math.max(0, Math.trunc(mechanic.areaRangeFeet)),
                sizeFeet: Math.max(5, Math.trunc(mechanic.areaSizeFeet)),
                dice: dice!, damageType: mechanic.damageType,
              }
    return {
      schemaVersion: 2,
      id: mechanic.id,
      name: mechanic.name.trim(),
      trigger: { event: mechanic.trigger },
      predicates: {
        ...(Number.isFinite(mechanic.hpPercentageAtOrBelow)
          ? { hpPercentageAtOrBelow: Math.max(0, Math.min(100, Number(mechanic.hpPercentageAtOrBelow))) }
          : {}),
        ...(Number.isFinite(mechanic.hpPercentageAtOrAbove)
          ? { hpPercentageAtOrAbove: Math.max(0, Math.min(100, Number(mechanic.hpPercentageAtOrAbove))) }
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
    armorClass: { ...preserved?.armorClass, value: Math.trunc(draft.armorClass) },
    hitPoints: { average: Math.trunc(draft.hitPointsAverage), dice: draft.hitPointsDice.replace(/\s+/g, '') },
    speed: {
      walk: Math.trunc(draft.walk),
      ...(draft.fly > 0 ? { fly: Math.trunc(draft.fly), hover: draft.hover } : {}),
      ...(draft.swim > 0 ? { swim: Math.trunc(draft.swim) } : {}),
      ...(draft.climb > 0 ? { climb: Math.trunc(draft.climb) } : {}),
      ...(draft.burrow > 0 ? { burrow: Math.trunc(draft.burrow) } : {}),
    },
    abilities: Object.fromEntries(ABILITY_KEYS.map((key) => [key, Math.trunc(draft.abilities[key])])) as Record<AbilityKey, number>,
    senses: preserved?.senses ? structuredClone(preserved.senses) : [],
    passivePerception: Math.trunc(draft.passivePerception),
    languages: draft.languages.split(/[,，、]/).map((entry) => entry.trim()).filter(Boolean),
    challenge: { rating: draft.challengeRating.trim(), xp: Math.trunc(draft.xp) },
    traits,
    actions,
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
    hitPointsAverage: monster.hitPoints.average,
    hitPointsDice: monster.hitPoints.dice,
    walk: monster.speed.walk,
    fly: monster.speed.fly ?? 0,
    swim: monster.speed.swim ?? 0,
    climb: monster.speed.climb ?? 0,
    burrow: monster.speed.burrow ?? 0,
    hover: monster.speed.hover ?? false,
    abilities: { ...monster.abilities },
    passivePerception: monster.passivePerception,
    languages: monster.languages.join('、'),
    challengeRating: monster.challenge.rating,
    xp: monster.challenge.xp,
    description: monster.description,
    targetingPriority: monster.targetingPreference?.priority ?? 'nearest',
    headlessMechanics: (monster.headlessMechanics ?? []).map((mechanic) => {
      const effect = mechanic.schemaVersion === 1
        ? { id: 'effect-0', kind: 'healing' as const, target: 'self' as const, dice: mechanic.effect.dice }
        : mechanic.effects[0]
      const dice = effect && 'dice' in effect ? effect.dice : { count: 2, sides: 6, bonus: 0 }
      const duration = effect?.kind === 'standard-condition' ? effect.duration : { kind: 'rounds' as const, rounds: 1 }
      return {
        id: mechanic.id,
        name: mechanic.name,
        trigger: mechanic.schemaVersion === 1 ? mechanic.event : mechanic.trigger.event,
        hpPercentageAtOrBelow: mechanic.predicates.hpPercentageAtOrBelow,
        hpPercentageAtOrAbove: mechanic.schemaVersion === 2 ? mechanic.predicates.hpPercentageAtOrAbove : undefined,
        requiresPositiveHp: mechanic.predicates.requiresPositiveHp,
        effectKind: effect?.kind ?? 'healing',
        effectTarget: effect && 'target' in effect ? effect.target : 'self',
        healingDice: `${dice.count}d${dice.sides}${dice.bonus === 0 ? '' : dice.bonus > 0 ? `+${dice.bonus}` : dice.bonus}`,
        damageType: effect && 'damageType' in effect ? effect.damageType : 'necrotic',
        condition: effect?.kind === 'standard-condition' ? effect.condition : 'frightened',
        durationKind: duration.kind,
        durationRounds: duration.kind === 'rounds' ? duration.rounds : 1,
        summonMonsterId: effect?.kind === 'summon' ? effect.monsterId : 'srd-5.1:wolf',
        summonCount: effect?.kind === 'summon' ? effect.count : 1,
        summonDurationRounds: effect?.kind === 'summon' ? effect.durationRounds : 10,
        areaShape: effect?.kind === 'area-attack' ? effect.shape : 'circle',
        areaRangeFeet: effect?.kind === 'area-attack' ? effect.rangeFeet : 60,
        areaSizeFeet: effect?.kind === 'area-attack' ? effect.sizeFeet : 15,
        limit: mechanic.limit,
        automation: mechanic.schemaVersion === 1 ? 'full' : mechanic.automation,
        preservedEffects: mechanic.schemaVersion === 1
          ? undefined
          : mechanic.effects.map((entry) => structuredClone(entry)),
      }
    }),
    traits: monster.traits.map((trait) => ({ name: trait.name, description: trait.description })),
    actions: monster.actions.filter((action) => action.kind !== 'multiattack').map((action) => {
      const damage = action.attack?.damage[0]
      return {
        id: action.id,
        name: action.name,
        description: action.description,
        kind: action.kind === 'weapon-attack' ? 'weapon-attack' : 'other',
        automation: action.automation ?? (action.kind === 'weapon-attack' ? 'headless' : 'dm-adjudication'),
        mode: action.attack?.mode ?? 'melee',
        toHit: action.attack?.toHit ?? 0,
        reachFeet: action.attack?.reachFeet ?? 5,
        rangeNormal: action.attack?.rangeFeet?.normal ?? 30,
        rangeLong: action.attack?.rangeFeet?.long ?? 120,
        damageDice: damage ? `${damage.count}d${damage.sides}${damage.bonus === 0 ? '' : damage.bonus > 0 ? `+${damage.bonus}` : damage.bonus}` : '1d4',
        damageType: damage?.type ?? 'bludgeoning',
        attacksPerAction: Math.max(1, monster.actions.find((candidate) => candidate.kind === 'multiattack')?.sequence?.filter((id) => id === action.id).length ?? 1),
      }
    }),
  }
}

export { DND5E_DAMAGE_TYPES }
