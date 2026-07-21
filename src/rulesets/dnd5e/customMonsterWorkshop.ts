import type { AbilityKey } from '../../lib/dnd'
import {
  DND5E_DAMAGE_TYPES,
  type Dnd5eDamageType,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterSize,
  type Dnd5eMonsterStatBlock,
} from './monsters'
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
    capabilities: {
      ...preserved?.capabilities,
      swarm: draft.traits.some((trait) => /群集|swarm/i.test(trait.name)),
      shapechanger: draft.traits.some((trait) => /变形|shapechange/i.test(trait.name)),
      regeneration: draft.traits.some((trait) => /再生|regeneration/i.test(trait.name)),
      spellcaster: draft.traits.some((trait) => /施法|spellcasting/i.test(trait.name)),
      legendary: false,
      hasFlySpeed: draft.fly > 0,
      hasSwimSpeed: draft.swim > 0,
    },
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
