import type { AbilityKey } from './dnd'
import type { CharacterEquipment } from '../types/equipment'
import {
  dnd5eMonsterDamageDice,
  dnd5eMonsterSpeedText,
  getDnd5eSrdMonster,
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterStatBlock,
} from '../rulesets/dnd5e/monsters'
import { dnd5eMonsterActionAutomation } from '../rulesets/dnd5e/monsterSchema'

export interface MonsterTrait {
  name: string
  description: string
  automation?: 'headless' | 'dm-adjudication'
  automationReason?: string
}

export interface MonsterAction {
  id?: string
  name: string
  description: string
  toHit?: number
  damageDice?: string
  damageType?: string
  range?: number
  kind?: 'melee' | 'ranged' | 'aoe' | 'multiattack' | 'targeted-condition' | 'targeted-special' | 'self-special'
  save?: { ability: AbilityKey; dc: number }
  actorLanding?: boolean
  usage?:
    | { kind: 'recharge'; dieSides: number; minimum: number }
    | { kind: 'per-day'; max: number }
  sharedUsageActionId?: string
  automation?: 'headless' | 'dm-adjudication' | 'invalid'
  automationReason?: string
  legendaryCost?: number
  requiredActiveEffectDefinitionId?: string
  forbiddenActiveEffectDefinitionId?: string
}

export interface MonsterSkillNote {
  name: string
  bonus: string
}

/** 展示层适配器；所有字段只从 SRD 5.1 或通过房间校验的自定义怪物投影。 */
export interface EnemyStatBlock {
  cr: string
  ac: number
  maxHp: number
  speed: string
  abilities: Record<AbilityKey, number>
  equipment?: CharacterEquipment
  skills?: MonsterSkillNote[]
  senses?: string
  languages?: string
  traits: MonsterTrait[]
  actions: MonsterAction[]
  bonusActions?: MonsterAction[]
  reactions?: MonsterAction[]
  legendaryActions?: MonsterAction[]
  legendaryActionPoints?: number
  lairActions?: MonsterAction[]
  spellcasting?: string
  source?: string
  sourcePage?: number
  alignment?: string
  hitDice?: string
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]
}

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  acid: '强酸',
  bludgeoning: '钝击',
  cold: '寒冷',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '黯蚀',
  piercing: '穿刺',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  slashing: '挥砍',
  thunder: '雷鸣',
}

function srdMonsterToEnemyStatBlock(monster: Dnd5eMonsterStatBlock): EnemyStatBlock {
  const convertAction = (action: Dnd5eMonsterStatBlock['actions'][number]): MonsterAction => {
    const attack = action.attack
    const primaryDamage = attack?.damage[0]
    const hasAreaRule = action.rule?.kind === 'area-saving-throw'
    const areaRule = action.rule?.kind === 'area-saving-throw' && !action.rule.variants
      ? action.rule
      : undefined
    return {
      id: action.id,
      name: action.name,
      description: action.description,
      toHit: attack?.toHit,
      damageDice: primaryDamage ? dnd5eMonsterDamageDice(primaryDamage) : undefined,
      damageType: primaryDamage?.type,
      range: attack?.rangeFeet?.normal ?? attack?.reachFeet,
      kind: action.kind === 'multiattack'
        ? 'multiattack'
        : hasAreaRule
          ? 'aoe'
        : action.rule?.kind === 'saving-throw-condition'
          ? 'targeted-condition'
        : action.rule?.kind === 'saving-throw-damage-and-max-hp-reduction'
          ? 'targeted-special'
        : action.rule?.kind === 'toggle-planar-phase' || action.rule?.kind === 'teleport'
          ? 'self-special'
        : attack
          ? (attack.mode === 'ranged' ? 'ranged' : 'melee')
          : undefined,
      save: areaRule ? { ability: areaRule.ability, dc: areaRule.dc } : undefined,
      actorLanding: areaRule?.actorLanding != null || undefined,
      usage: action.usage?.kind === 'recharge'
        ? {
            kind: 'recharge',
            dieSides: action.usage.dieSides,
            minimum: action.usage.minimum,
          }
        : action.usage?.kind === 'per-day'
          ? { kind: 'per-day', max: action.usage.max }
          : undefined,
      sharedUsageActionId: action.sharedUsageActionId,
      automation: dnd5eMonsterActionAutomation(action),
      automationReason: action.automationReason,
      legendaryCost: action.legendaryCost,
      requiredActiveEffectDefinitionId: action.requiredActiveEffectDefinitionId,
      forbiddenActiveEffectDefinitionId: action.forbiddenActiveEffectDefinitionId,
    }
  }
  return {
    cr: monster.challenge.rating,
    ac: monster.armorClass.value,
    maxHp: monster.hitPoints.average,
    speed: dnd5eMonsterSpeedText(monster),
    abilities: { ...monster.abilities },
    skills: monster.skills?.map((skill) => ({ name: skill.name, bonus: skill.bonus >= 0 ? `+${skill.bonus}` : String(skill.bonus) })),
    senses: [
      ...monster.senses.map((sense) => `${sense.name}${sense.distanceFeet != null ? ` ${sense.distanceFeet} 尺` : ''}`),
      `被动察觉 ${monster.passivePerception}`,
    ].join('，'),
    languages: monster.languages.length > 0 ? monster.languages.join('、') : '—',
    traits: monster.traits.map((trait) => ({ ...trait })),
    actions: monster.actions.map(convertAction),
    bonusActions: monster.bonusActions?.map(convertAction),
    reactions: monster.reactions?.map(convertAction),
    legendaryActions: monster.legendaryActions?.map(convertAction),
    legendaryActionPoints: monster.legendaryActionPoints,
    lairActions: monster.lairActions?.map(convertAction),
    spellcasting: monster.spellcasting?.description,
    source: monster.source,
    sourcePage: monster.sourcePage,
    alignment: monster.alignment,
    hitDice: monster.hitPoints.dice,
    damageVulnerabilities: monster.damageVulnerabilities?.map((type) => DAMAGE_TYPE_LABELS[type] ?? type),
    damageResistances: monster.damageResistances?.map((type) => DAMAGE_TYPE_LABELS[type] ?? type),
    damageImmunities: monster.damageImmunities?.map((type) => DAMAGE_TYPE_LABELS[type] ?? type),
    conditionImmunities: monster.conditionImmunities ? [...monster.conditionImmunities] : undefined,
  }
}

/** 旧裸 slug 只做 ID 迁移，返回值仍严格来自 SRD 5.1 目录。 */
export function getEnemyStatBlock(id: string): EnemyStatBlock | undefined {
  const monster = getDnd5eSrdMonster(id) ?? getDnd5eSrdMonsterBySlug(id)
  return monster ? srdMonsterToEnemyStatBlock(monster) : undefined
}

export function getPrimaryAttackAction(block: EnemyStatBlock): MonsterAction | undefined {
  const withDice = block.actions.filter((action) => !!action.damageDice)
  return (
    withDice.find((action) => action.kind === 'melee') ??
    withDice.find((action) => action.kind !== 'aoe') ??
    withDice[0]
  )
}
