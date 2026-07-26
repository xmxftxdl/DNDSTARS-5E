import type { AbilityKey } from '../../lib/dnd'
import generatedSrdMonsterCatalog from './generated/srdMonsters.generated.json'
import reviewedMonsterTranslations from './generated/srdMonsterTranslationsZh.reviewed.generated.json'
import { getDnd5eRoomMonster } from './roomMonsterCatalog'
import type { Dnd5eDamageType } from './damageTypes'
import type { Dnd5eStandardConditionId } from './conditions'
import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'

export { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
export { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'
export type Dnd5eMonsterSize = '微型' | '小型' | '中型' | '大型' | '超大型' | '巨型'
export type Dnd5eMonsterAutomation = 'headless' | 'dm-adjudication'
export type Dnd5eMonsterTargetPriority =
  | 'nearest'
  | 'lowest-current-hp'
  | 'lowest-hp-percentage'
  | 'lowest-armor-class'
  | 'highest-threat'

export interface Dnd5eMonsterTargetingPreferenceV1 {
  schemaVersion: 1
  priority: Dnd5eMonsterTargetPriority
}

export type Dnd5eMonsterBehaviorStyle =
  | 'balanced'
  | 'aggressive'
  | 'defensive'
  | 'skirmisher'
  | 'cowardly'

export interface Dnd5eMonsterBehaviorPreferenceV1 {
  schemaVersion: 1
  style: Dnd5eMonsterBehaviorStyle
}

export interface Dnd5eMonsterMechanicTriggerV1 {
  schemaVersion: 1
  id: string
  name: string
  event: 'turn-start'
  predicates: {
    hpPercentageAtOrBelow: number
    requiresPositiveHp: boolean
  }
  effect: {
    kind: 'healing'
    dice: { count: number; sides: number; bonus: number }
  }
  limit: 'once-per-turn' | 'once-per-combat' | 'unlimited'
  automation: 'headless'
}

export type Dnd5eMonsterMechanicTriggerEventV2 =
  | 'turn-start'
  | 'turn-end'
  | 'after-hit'
  | 'after-miss'
  | 'when-hit'
  | 'after-damaged'
  | 'saving-throw-magic'
  | 'saving-throw-physical'
  | 'movement'
  | 'phase-transition'

export type Dnd5eMonsterMechanicSubjectV2 = 'self' | 'ally-within' | 'hostile-within'

export type Dnd5eMonsterMechanicEffectTargetV2 =
  | 'self'
  | 'trigger-target'
  | 'damage-source'
  | 'selected-subject'

export type Dnd5eMonsterMechanicDurationV2 =
  | { kind: 'permanent' }
  | { kind: 'until-target-turn-start' }
  | { kind: 'until-source-turn-start' }
  | { kind: 'rounds'; rounds: number }

export type Dnd5eMonsterMechanicEffectV2 =
  | {
      id: string
      kind: 'healing'
      target: 'self'
      dice: { count: number; sides: number; bonus: number }
    }
  | {
      id: string
      kind: 'temporary-hit-points'
      target: 'self'
      dice: { count: number; sides: number; bonus: number }
    }
  | {
      id: string
      kind: 'damage'
      target: Dnd5eMonsterMechanicEffectTargetV2
      dice: { count: number; sides: number; bonus: number }
      damageType: Dnd5eDamageType
    }
  | {
      id: string
      kind: 'standard-condition'
      target: Dnd5eMonsterMechanicEffectTargetV2
      condition: Dnd5eStandardConditionId
      duration: Dnd5eMonsterMechanicDurationV2
    }
  | {
      id: string
      kind: 'remove-standard-condition'
      target: Dnd5eMonsterMechanicEffectTargetV2
      condition: Dnd5eStandardConditionId
    }
  | {
      id: string
      kind: 'summon'
      monsterId: string
      count: number
      durationRounds: number
    }
  | {
      id: string
      kind: 'area-attack'
      shape: 'circle' | 'cone' | 'line'
      rangeFeet: number
      sizeFeet: number
      dice: { count: number; sides: number; bonus: number }
      damageType: Dnd5eDamageType
    }
  | {
      id: string
      kind: 'roll-modifier'
      target: Dnd5eMonsterMechanicEffectTargetV2
      roll: 'attack' | 'damage' | 'saving-throw'
      mode: 'bonus' | 'advantage' | 'disadvantage'
      bonus?: number
    }
  | {
      id: string
      kind: 'attack'
      target: Dnd5eMonsterMechanicEffectTargetV2
      toHit: number
      economy?: 'none' | 'reaction'
      damage: Dnd5eMonsterDamage
    }

export interface Dnd5eMonsterMechanicTriggerV2 {
  schemaVersion: 2
  id: string
  name: string
  trigger: {
    event: Dnd5eMonsterMechanicTriggerEventV2
    subject?: Dnd5eMonsterMechanicSubjectV2
    radiusFeet?: number
    movement?: { comparison: 'at-least' | 'at-most'; feet: number }
  }
  predicates: {
    hpPercentageAtOrBelow?: number
    hpPercentageAtOrAbove?: number
    requiresPositiveHp: boolean
  }
  effects: readonly Dnd5eMonsterMechanicEffectV2[]
  limit: 'once-per-turn' | 'once-per-combat' | 'unlimited'
  automation: 'full' | 'partial' | 'manual'
}

export type Dnd5eMonsterMechanicTrigger = Dnd5eMonsterMechanicTriggerV1 | Dnd5eMonsterMechanicTriggerV2

export interface Dnd5eMonsterDamage {
  average: number
  count: number
  sides: number
  bonus: number
  type: Dnd5eDamageType
}

export interface Dnd5eMonsterWeaponAttack {
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  toHit: number
  reachFeet?: number
  rangeFeet?: { normal: number; long: number }
  target: string
  damage: readonly Dnd5eMonsterDamage[]
  /** Natural d20 result that starts the critical range. Defaults to 20. */
  criticalThreshold?: number
  /** Extra dice added only on a critical hit, after normal damage dice are doubled. */
  criticalExtraDamage?: readonly Dnd5eMonsterDamage[]
  /** 群集在生命值不高于一半时使用的替代伤害。 */
  damageAtHalfHp?: readonly Dnd5eMonsterDamage[]
  onHit?: string
  onHitRule?: {
    kind: 'saving-throw-condition'
    ability: AbilityKey
    dc: number
    condition: Dnd5eStandardConditionId | 'disease'
  }
}

export type Dnd5eMonsterSpecialActionRule =
  | {
      kind: 'ability-check'
      ability: AbilityKey
      skillKey?: string
    }
  | {
      kind: 'saving-throw-condition'
      rangeFeet: number
      ability: AbilityKey
      dc: number
      condition: Dnd5eStandardConditionId
      preventReactions?: boolean
      repeatSaveOnDamage?: boolean
    }
  | {
      kind: 'conditioned-damage-and-healing'
      requiredCondition: Dnd5eStandardConditionId
      requireSameSource: boolean
      damage: Dnd5eMonsterDamage
    }

export interface Dnd5eMonsterTrait {
  name: string
  description: string
  automation?: Dnd5eMonsterAutomation
  rule?: {
    kind: 'undead-fortitude'
    dcBase: number
    excludedDamageTypes: readonly Dnd5eDamageType[]
    excludedOnCritical: boolean
  } | {
    kind: 'regeneration'
    amount: number
    requiresPositiveHp: boolean
    suppressedByDamageTypes: readonly Dnd5eDamageType[]
    diesAtZeroWhenSuppressed: boolean
  } | {
    kind: 'swarm'
    cannotRegainHitPoints: true
    cannotGainTemporaryHitPoints: true
  } | {
    kind: 'nimble-escape'
    bonusActionOptions: readonly ['disengage', 'hide']
  } | {
    /** A conditional skill bonus tied to one sense, with an optional combat sense. */
    kind: 'keen-sense'
    sense: 'smell' | 'hearing' | 'sight'
    skillKey: string
    checkBonus: number
    blindsightFeet?: number
  } | {
    /** Initiative advantage only when the creature actually starts combat as an ambusher. */
    kind: 'ambusher'
    initiativeAdvantageWhenSurprising: true
  } | {
    /** Conditional damage after a straight-line approach; path qualification remains authoritative. */
    kind: 'charge-damage'
    minimumStraightMovementFeet: number
    actionId: string
    extraDamage: Dnd5eMonsterDamage
  } | {
    kind: 'magic-resistance'
    savingThrowAdvantageAgainstMagic: true
  } | {
    kind: 'conditional-target-bonus'
    targetConditions: readonly Dnd5eStandardConditionId[]
    attackBonus: number
    damageBonus: number
  }
}

export interface Dnd5eMonsterActionUsage {
  kind: 'recharge'
  dieSides: number
  minimum: number
}

export interface Dnd5eMonsterActionPerDayUsage {
  kind: 'per-day'
  max: number
}

export interface Dnd5eMonsterEquipment {
  id: string
  name: string
  category: 'weapon' | 'armor' | 'shield' | 'gear' | 'consumable' | 'other'
  quantity: number
  description?: string
  armorClass?: number
  linkedActionId?: string
}

export interface Dnd5eMonsterAction {
  id: string
  name: string
  description: string
  kind: 'weapon-attack' | 'multiattack' | 'other'
  automation?: Dnd5eMonsterAutomation
  attack?: Dnd5eMonsterWeaponAttack
  sequence?: readonly string[]
  usage?: Dnd5eMonsterActionUsage | Dnd5eMonsterActionPerDayUsage
  legendaryCost?: number
  /** Structured non-weapon rule resolved entirely by the Headless engine. */
  rule?: Dnd5eMonsterSpecialActionRule
  /** 传奇动作直接调用普通武器动作时指向其 ID。 */
  referencedActionId?: string
  movement?: {
    kind: 'straight-toward-visible-hostile'
    maximumSpeedFraction: number
  }
  reactionTrigger?: {
    kind: 'after-action'
    actionId: string
  }
}

export interface Dnd5eMonsterSpellcasting {
  description: string
  casterLevel?: number
  ability?: AbilityKey
  saveDc?: number
  attackBonus?: number
  school?: string
  componentsRequired?: readonly ('V' | 'S' | 'M')[]
  slots?: Readonly<Record<string, number>>
  spells?: readonly {
    id: string
    name: string
    level: number
    usage?: { kind: 'at-will' } | { kind: 'per-day'; max: number }
  }[]
  automation: Dnd5eMonsterAutomation
}

export interface Dnd5eMonsterCapabilities {
  swarm: boolean
  shapechanger: boolean
  regeneration: boolean
  spellcaster: boolean
  legendary: boolean
  hasFlySpeed: boolean
  hasSwimSpeed: boolean
}

export interface Dnd5eMonsterStatBlock {
  id: string
  slug: string
  name: string
  englishName: string
  source: 'SRD 5.1' | 'DM 自定义'
  sourcePage?: number
  size: Dnd5eMonsterSize
  creatureType: string
  subtypes?: readonly string[]
  alignment: string
  armorClass: { value: number; note?: string }
  hitPoints: { average: number; dice: string }
  speed: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number; hover?: boolean }
  abilities: Record<AbilityKey, number>
  savingThrows?: Partial<Record<AbilityKey, number>>
  skills?: readonly { key: string; name: string; bonus: number }[]
  damageVulnerabilities?: readonly Dnd5eDamageType[]
  damageResistances?: readonly Dnd5eDamageType[]
  damageImmunities?: readonly Dnd5eDamageType[]
  conditionImmunities?: readonly string[]
  senses: readonly { name: string; distanceFeet?: number }[]
  passivePerception: number
  languages: readonly string[]
  challenge: { rating: string; xp: number }
  legendaryResistanceUses?: number
  /** Defaults to 3 for legacy legendary monsters. */
  legendaryActionPoints?: number
  /** Lair actions normally resolve on initiative count 20. */
  lairInitiative?: number
  /** Room-owned compressed images. Data URLs are validated at the schema boundary. */
  tokenPortrait?: string
  initiativePortrait?: string
  equipment?: readonly Dnd5eMonsterEquipment[]
  traits: readonly Dnd5eMonsterTrait[]
  actions: readonly Dnd5eMonsterAction[]
  bonusActions?: readonly Dnd5eMonsterAction[]
  reactions?: readonly Dnd5eMonsterAction[]
  legendaryActions?: readonly Dnd5eMonsterAction[]
  lairActions?: readonly Dnd5eMonsterAction[]
  spellcasting?: Dnd5eMonsterSpellcasting
  capabilities?: Dnd5eMonsterCapabilities
  /** 自动回合选择目标时的模板默认值；单个地图 Token 可以由 DM 覆盖。 */
  targetingPreference?: Dnd5eMonsterTargetingPreferenceV1
  /** 仅包含 Host 白名单效果的声明式怪物机制。 */
  headlessMechanics?: readonly Dnd5eMonsterMechanicTrigger[]
  description: string
}

interface GeneratedDnd5eMonsterCatalog {
  schemaVersion: 1
  count: number
  source: {
    rules: string
    rulesUrl: string
    license: string
    transcription: string
    transcriptionCommit: string
    transcriptionUrl: string
  }
  monsters: readonly Dnd5eMonsterStatBlock[]
}

interface ReviewedMonsterTextRow {
  id?: string
  key?: string
  index?: number
  name: string
  description?: string
}

interface ReviewedMonsterTranslation {
  name: string
  alignment: string
  subtypes: readonly string[]
  armorClassNote: string
  skills: readonly ReviewedMonsterTextRow[]
  languages: readonly string[]
  conditionImmunities: readonly string[]
  traits: readonly ReviewedMonsterTextRow[]
  actions: readonly ReviewedMonsterTextRow[]
  reactions: readonly ReviewedMonsterTextRow[]
  legendaryActions: readonly ReviewedMonsterTextRow[]
  lairActions: readonly ReviewedMonsterTextRow[]
  spellcastingDescription: string
  description: string
  reviewedBy: string
  reviewedAt: string
}

const REVIEWED_MONSTER_TRANSLATIONS = reviewedMonsterTranslations as Readonly<Record<string, ReviewedMonsterTranslation>>

function translatedMonsterRows(
  rows: readonly Dnd5eMonsterAction[] | undefined,
  translations: readonly ReviewedMonsterTextRow[],
): readonly Dnd5eMonsterAction[] | undefined {
  if (!rows) return undefined
  const byId = new Map(translations.map((translation) => [translation.id, translation]))
  return rows.map((row) => {
    const translation = byId.get(row.id)
    return translation ? { ...row, name: translation.name, description: translation.description ?? row.description } : row
  })
}

function applyReviewedMonsterTranslation(
  monster: Dnd5eMonsterStatBlock,
  translation: ReviewedMonsterTranslation,
): Dnd5eMonsterStatBlock {
  const skillNames = new Map(translation.skills.map((skill) => [skill.key, skill.name]))
  return {
    ...monster,
    name: translation.name,
    alignment: translation.alignment,
    ...(monster.subtypes ? { subtypes: translation.subtypes } : {}),
    armorClass: {
      ...monster.armorClass,
      ...(monster.armorClass.note ? { note: translation.armorClassNote } : {}),
    },
    ...(monster.skills ? {
      skills: monster.skills.map((skill) => ({ ...skill, name: skillNames.get(skill.key) ?? skill.name })),
    } : {}),
    languages: translation.languages,
    conditionImmunities: translation.conditionImmunities,
    traits: monster.traits.map((trait, index) => ({
      ...trait,
      name: translation.traits.find((row) => row.index === index)?.name ?? trait.name,
      description: translation.traits.find((row) => row.index === index)?.description ?? trait.description,
    })),
    actions: translatedMonsterRows(monster.actions, translation.actions) ?? monster.actions,
    reactions: translatedMonsterRows(monster.reactions, translation.reactions),
    legendaryActions: translatedMonsterRows(monster.legendaryActions, translation.legendaryActions),
    lairActions: translatedMonsterRows(monster.lairActions, translation.lairActions),
    ...(monster.spellcasting ? {
      spellcasting: {
        ...monster.spellcasting,
        description: translation.spellcastingDescription,
        spells: monster.spellcasting.spells?.map((spell) => ({
          ...spell,
          name: DND5E_SRD_SPELL_NAMES_ZH[spell.id] ?? spell.name,
        })),
      },
    } : {}),
    description: translation.description,
  }
}

/**
 * Text translation must never remove the small set of core SRD mechanics that
 * already have native Headless handlers. The pinned catalog deliberately keeps
 * prose-only abilities conservative, so these stable SRD IDs provide the
 * structured rules required by the engine without depending on English text.
 */
function applyCoreMonsterMechanicalRules(monster: Dnd5eMonsterStatBlock): Dnd5eMonsterStatBlock {
  if (monster.slug === 'aboleth') {
    const actions = monster.actions.map((action) => {
      if (action.id === 'multiattack') return { ...action, automation: 'headless' as const }
      if (action.id === 'tentacle' && action.attack) {
        return {
          ...action,
          automation: 'headless' as const,
          attack: {
            ...action.attack,
            // The delayed one-minute transformation is preserved as a durable
            // disease marker; map environment rules decide underwater effects.
            onHit: 'DC 14 Constitution save; on a failure the target contracts the aboleth tentacle disease.',
            onHitRule: {
              kind: 'saving-throw-condition' as const,
              ability: 'con' as const,
              dc: 14,
              condition: 'disease' as const,
            },
            // The SRD's later 1d12 acid damage is not part of the initial hit.
            damage: action.attack.damage.filter((component) => component.type !== 'acid'),
          },
        }
      }
      if (action.id === 'enslave') {
        return {
          ...action,
          automation: 'headless' as const,
          usage: { kind: 'per-day' as const, max: 3 },
          rule: {
            kind: 'saving-throw-condition' as const,
            rangeFeet: 30,
            ability: 'wis' as const,
            dc: 14,
            condition: 'charmed' as const,
            preventReactions: true,
            repeatSaveOnDamage: true,
          },
        }
      }
      return action
    })
    return {
      ...monster,
      actions,
      legendaryActionPoints: 3,
      legendaryActions: monster.legendaryActions?.map((action) => {
        if (action.id === 'detect') {
          return {
            ...action,
            automation: 'headless' as const,
            rule: { kind: 'ability-check' as const, ability: 'wis' as const, skillKey: 'perception' },
          }
        }
        if (action.id === 'psychic-drain-costs-2-actions') {
          return {
            ...action,
            automation: 'headless' as const,
            rule: {
              kind: 'conditioned-damage-and-healing' as const,
              requiredCondition: 'charmed' as const,
              requireSameSource: true,
              damage: { average: 10, count: 3, sides: 6, bonus: 0, type: 'psychic' as const },
            },
          }
        }
        return action
      }),
    }
  }

  if (monster.slug === 'zombie') {
    return {
      ...monster,
      traits: monster.traits.map((trait, index) => index === 0 ? {
        ...trait,
        automation: 'headless',
        rule: {
          kind: 'undead-fortitude',
          dcBase: 5,
          excludedDamageTypes: ['radiant'],
          excludedOnCritical: true,
        },
      } : trait),
    }
  }

  if (monster.slug === 'wolf' || monster.slug === 'dire-wolf') {
    const dc = monster.slug === 'wolf' ? 11 : 13
    return {
      ...monster,
      actions: monster.actions.map((action) => action.id === 'bite' && action.attack ? {
        ...action,
        automation: 'headless',
        attack: {
          ...action.attack,
          onHit: `目标进行 DC ${dc} 力量豁免，失败则倒地。`,
          onHitRule: { kind: 'saving-throw-condition', ability: 'str', dc, condition: 'prone' },
        },
      } : action),
    }
  }

  if (monster.slug === 'bat') {
    return {
      ...monster,
      actions: monster.actions.map((action) => action.id === 'bite' ? {
        ...action,
        kind: 'weapon-attack',
        automation: 'headless',
        attack: {
          mode: 'melee',
          toHit: 0,
          reachFeet: 5,
          target: '单一生物',
          damage: [{ average: 1, count: 0, sides: 4, bonus: 1, type: 'piercing' }],
        },
      } : action),
    }
  }

  if (monster.slug === 'goblin') {
    return {
      ...monster,
      traits: monster.traits.map((trait, index) => index === 0 ? {
        ...trait,
        automation: 'headless',
        rule: {
          kind: 'nimble-escape',
          bonusActionOptions: ['disengage', 'hide'],
        },
      } : trait),
    }
  }

  return monster
}

export const DND5E_SRD_MONSTER_CATALOG_METADATA = generatedSrdMonsterCatalog as unknown as GeneratedDnd5eMonsterCatalog

/**
 * Complete SRD 5.1 catalog. Context-reviewed Chinese entries override the
 * pinned English transcription by slug. Unreviewed entries intentionally keep
 * the English SRD prose instead of falling back to legacy project copy.
 */
export const DND5E_SRD_MONSTERS: readonly Dnd5eMonsterStatBlock[] =
  DND5E_SRD_MONSTER_CATALOG_METADATA.monsters.map((monster) => {
    const translation = REVIEWED_MONSTER_TRANSLATIONS[monster.slug]
    return applyCoreMonsterMechanicalRules(
      translation ? applyReviewedMonsterTranslation(monster, translation) : monster,
    )
  })

const MONSTERS_BY_ID = new Map(DND5E_SRD_MONSTERS.map((monster) => [monster.id, monster]))
const MONSTERS_BY_SLUG = new Map(DND5E_SRD_MONSTERS.map((monster) => [monster.slug, monster]))

export function getDnd5eSrdMonster(id: string): Dnd5eMonsterStatBlock | undefined {
  return getDnd5eRoomMonster(id) ?? MONSTERS_BY_ID.get(id)
}

export function getDnd5eSrdMonsterBySlug(slug: string): Dnd5eMonsterStatBlock | undefined {
  return MONSTERS_BY_SLUG.get(slug)
}

export function searchDnd5eSrdMonsters(query: string): readonly Dnd5eMonsterStatBlock[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return DND5E_SRD_MONSTERS
  return DND5E_SRD_MONSTERS.filter((monster) => [
    monster.name,
    monster.englishName,
    monster.creatureType,
    monster.alignment,
    monster.challenge.rating,
    ...monster.subtypes ?? [],
  ].some((value) => value.toLowerCase().includes(normalized)))
}

export function dnd5eMonsterProficiencyBonus(challengeRating: string): number {
  const rating = challengeRating.includes('/')
    ? Number(challengeRating.split('/')[0]) / Number(challengeRating.split('/')[1])
    : Number(challengeRating)
  if (!Number.isFinite(rating) || rating <= 4) return 2
  if (rating <= 8) return 3
  if (rating <= 12) return 4
  if (rating <= 16) return 5
  if (rating <= 20) return 6
  if (rating <= 24) return 7
  if (rating <= 28) return 8
  return 9
}

/** The map pathfinder distinguishes ground, climb, and swim terrain. */
export function dnd5eMonsterMapSpeed(monster: Dnd5eMonsterStatBlock): number {
  return Math.max(monster.speed.walk, monster.speed.fly ?? 0, monster.speed.swim ?? 0, monster.speed.climb ?? 0)
}

export function dnd5eMonsterSpeedText(monster: Dnd5eMonsterStatBlock): string {
  const values = [`${monster.speed.walk} 尺`]
  if (monster.speed.fly != null) values.push(`飞行 ${monster.speed.fly} 尺${monster.speed.hover ? '（悬浮）' : ''}`)
  if (monster.speed.swim != null) values.push(`游泳 ${monster.speed.swim} 尺`)
  if (monster.speed.climb != null) values.push(`攀爬 ${monster.speed.climb} 尺`)
  if (monster.speed.burrow != null) values.push(`掘穴 ${monster.speed.burrow} 尺`)
  return values.join('，')
}

export function dnd5eMonsterDamageDice(value: Dnd5eMonsterDamage): string {
  if (value.bonus === 0) return `${value.count}d${value.sides}`
  return `${value.count}d${value.sides}${value.bonus > 0 ? '+' : ''}${value.bonus}`
}
