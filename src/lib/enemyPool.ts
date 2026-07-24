import { enemyHasDerivedCombat, getEnemyMaxHp } from './enemyCombatStats'
import {
  creatureSizeToTokenSize,
  inferCreatureSizeFromTags,
  inferCreatureTypesFromTags,
  type CreatureSize,
  type CreatureType,
} from './monsterTypes'
import {
  DND5E_SRD_MONSTERS,
  getDnd5eSrdMonster,
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterStatBlock,
} from '../rulesets/dnd5e/monsters'

/** 怪物池模板（用于 DM 快速放置敌人 Token）。 */
export interface EnemyTemplate {
  id: string
  name: string
  emoji: string
  color: string
  maxHp: number
  hp?: number
  size?: number
  creatureTypes?: CreatureType[]
  creatureSize?: CreatureSize
  tags: string[]
  description?: string
  armorClass?: number
  challengeRating?: string
  experiencePoints?: number
  hitDice?: string
  source?: string
  tokenPortrait?: string
  initiativePortrait?: string
  visualVariants?: readonly EnemyVisualVariant[]
  visualVariantId?: string
  searchAliases?: string[]
}

export interface EnemyVisualVariant {
  id: string
  label: string
  tokenPortrait: string
  initiativePortrait: string
}

interface SrdMonsterPresentation {
  emoji: string
  color: string
  tokenPortrait?: string
  initiativePortrait?: string
  visualVariants?: readonly EnemyVisualVariant[]
}

export interface EnemyVisualPresentation {
  tokenPortrait: string
  initiativePortrait: string
}

const SRD_MONSTER_PRESENTATION: Record<string, SrdMonsterPresentation> = {
  bandit: { emoji: '🗡️', color: '#78716c' },
  bugbear: {
    emoji: '👹',
    color: '#92400e',
    tokenPortrait: '/assets/portraits/bugbear-forest-raider-token.png',
    initiativePortrait: '/assets/portraits/bugbear-forest-raider-initiative.png',
  },
  kobold: { emoji: '🐲', color: '#f59e0b' },
  goblin: {
    emoji: '👺',
    color: '#4ade80',
    tokenPortrait: '/assets/portraits/goblin-forest-scout-token.png',
    initiativePortrait: '/assets/portraits/goblin-forest-scout-initiative.png',
    visualVariants: [
      {
        id: 'forest-scout',
        label: '森林斥候',
        tokenPortrait: '/assets/portraits/goblin-forest-scout-token.png',
        initiativePortrait: '/assets/portraits/goblin-forest-scout-initiative.png',
      },
      {
        id: 'woodland-archer',
        label: '黄兜弓手',
        tokenPortrait: '/assets/portraits/goblin-woodland-archer-token.png',
        initiativePortrait: '/assets/portraits/goblin-woodland-archer-initiative.png',
      },
      {
        id: 'ruin-raider',
        label: '遗迹掠夺者',
        tokenPortrait: '/assets/portraits/goblin-ruin-raider-token.png',
        initiativePortrait: '/assets/portraits/goblin-ruin-raider-initiative.png',
      },
      {
        id: 'cave-skulk',
        label: '洞穴潜伏者',
        tokenPortrait: '/assets/portraits/goblin-cave-skulk-token.png',
        initiativePortrait: '/assets/portraits/goblin-cave-skulk-initiative.png',
      },
    ],
  },
  skeleton: { emoji: '💀', color: '#e2e8f0' },
  zombie: { emoji: '🧟', color: '#84cc16' },
  wolf: { emoji: '🐺', color: '#94a3b8' },
  orc: { emoji: '👹', color: '#ef4444' },
  'dire-wolf': { emoji: '🐺', color: '#64748b' },
  ogre: { emoji: '🧌', color: '#ea580c' },
  owlbear: { emoji: '🦉', color: '#78350f' },
}

const SRD_MONSTER_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  goblin: ['哥布林'],
}

export function getEnemyVisualVariants(id: string): readonly EnemyVisualVariant[] {
  const monster = getDnd5eSrdMonster(id) ?? getDnd5eSrdMonsterBySlug(id)
  if (!monster) return []
  if (monster.tokenPortrait && monster.initiativePortrait) return [{
    id: 'custom',
    label: '自定义形象',
    tokenPortrait: monster.tokenPortrait,
    initiativePortrait: monster.initiativePortrait,
  }]
  const presentation = SRD_MONSTER_PRESENTATION[monster.slug]
  if (presentation?.visualVariants?.length) return presentation.visualVariants
  if (!presentation?.tokenPortrait || !presentation.initiativePortrait) return []
  return [{
    id: 'default',
    label: '默认形象',
    tokenPortrait: monster.tokenPortrait ?? monster.initiativePortrait ?? presentation.tokenPortrait,
    initiativePortrait: monster.initiativePortrait ?? monster.tokenPortrait ?? presentation.initiativePortrait,
  }]
}

export function getEnemyVisualPresentation(
  id: string,
  visualVariantId?: string,
): EnemyVisualPresentation | undefined {
  const variants = getEnemyVisualVariants(id)
  const selected = visualVariantId
    ? variants.find((variant) => variant.id === visualVariantId)
    : variants[0]
  if (selected) {
    return {
      tokenPortrait: selected.tokenPortrait,
      initiativePortrait: selected.initiativePortrait,
    }
  }
  const monster = getDnd5eSrdMonster(id) ?? getDnd5eSrdMonsterBySlug(id)
  if (!monster) return undefined
  if (monster.tokenPortrait || monster.initiativePortrait) {
    return {
      tokenPortrait: monster.tokenPortrait ?? monster.initiativePortrait!,
      initiativePortrait: monster.initiativePortrait ?? monster.tokenPortrait!,
    }
  }
  const presentation = SRD_MONSTER_PRESENTATION[monster.slug]
  if (!presentation?.tokenPortrait || !presentation.initiativePortrait) return undefined
  return {
    tokenPortrait: presentation.tokenPortrait,
    initiativePortrait: presentation.initiativePortrait,
  }
}

function srdCreatureTypes(type: string): CreatureType[] {
  if (type === '野兽') return ['动物']
  if (type === '龙') return ['龙']
  if (type === '精类') return ['精类']
  if (type === '元素生物') return ['元素']
  if (type === '构装体') return ['机械']
  if (type === '植物') return ['植物']
  if (type === '类人生物' || type === '巨人') return ['人类']
  return ['魔物']
}

export function dnd5eMonsterToEnemyTemplate(monster: Dnd5eMonsterStatBlock): EnemyTemplate {
  const presentation = SRD_MONSTER_PRESENTATION[monster.slug] ?? { emoji: '👾', color: '#f87171' }
  const capabilityTags = [
    monster.capabilities?.spellcaster ? '施法者' : null,
    monster.capabilities?.legendary ? '传奇动作' : null,
    monster.capabilities?.swarm ? '群集' : null,
    monster.capabilities?.shapechanger ? '变形生物' : null,
    monster.capabilities?.regeneration ? '再生' : null,
    monster.speed.fly != null ? '飞行' : null,
    monster.speed.swim != null ? '游泳' : null,
  ].filter((value): value is string => !!value)
  return {
    id: monster.id,
    name: monster.name,
    emoji: presentation.emoji,
    color: presentation.color,
    maxHp: monster.hitPoints.average,
    creatureTypes: srdCreatureTypes(monster.creatureType),
    creatureSize: monster.size,
    tags: [...new Set([
      monster.source,
      `CR ${monster.challenge.rating}`,
      monster.creatureType,
      monster.size,
      ...(monster.subtypes ?? []),
      ...capabilityTags,
    ])],
    description: monster.name === monster.englishName
      ? monster.description
      : `${monster.englishName} · ${monster.description}`,
    armorClass: monster.armorClass.value,
    challengeRating: monster.challenge.rating,
    experiencePoints: monster.challenge.xp,
    hitDice: monster.hitPoints.dice,
    source: monster.source,
    tokenPortrait: presentation.tokenPortrait,
    initiativePortrait: presentation.initiativePortrait,
    visualVariants: getEnemyVisualVariants(monster.id),
    searchAliases: [...(SRD_MONSTER_SEARCH_ALIASES[monster.slug] ?? [])],
  }
}

/** D&D 5e 2014 地图唯一内置怪物池，只包含 SRD 5.1 目录。 */
export const DND5E_SRD_ENEMY_POOL: EnemyTemplate[] = DND5E_SRD_MONSTERS.map(dnd5eMonsterToEnemyTemplate)

/** @deprecated 使用 DND5E_SRD_ENEMY_POOL；保留导出名只为兼容旧调用方。 */
export const ENEMY_POOL: EnemyTemplate[] = DND5E_SRD_ENEMY_POOL

export function getEnemyTemplate(id: string): EnemyTemplate | undefined {
  const monster = getDnd5eSrdMonster(id) ?? getDnd5eSrdMonsterBySlug(id)
  return monster ? dnd5eMonsterToEnemyTemplate(monster) : undefined
}

export function searchEnemyPool(query: string, pool: readonly EnemyTemplate[] = DND5E_SRD_ENEMY_POOL): EnemyTemplate[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...pool]
  return pool.filter(
    (enemy) =>
      enemy.name.toLowerCase().includes(q) ||
      enemy.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      enemy.creatureTypes?.some((type) => type.toLowerCase().includes(q)) ||
      enemy.creatureSize?.toLowerCase().includes(q) ||
      enemy.searchAliases?.some((alias) => alias.toLowerCase().includes(q)) ||
      enemy.description?.toLowerCase().includes(q),
  )
}

export function enemyTemplateToTokenPatch(template: EnemyTemplate): Partial<TokenFields> {
  const maxHp = enemyHasDerivedCombat(template.id)
    ? getEnemyMaxHp(template.id)
    : template.maxHp
  const hp = template.hp ?? maxHp
  const creatureTypes = template.creatureTypes ?? inferCreatureTypesFromTags(template.tags)
  const creatureSize = template.creatureSize ?? inferCreatureSizeFromTags(template.tags)
  return {
    label: template.name,
    emoji: template.emoji,
    color: template.color,
    maxHp,
    hp,
    size: creatureSizeToTokenSize(creatureSize),
    poolId: template.id,
    visualVariantId: template.visualVariantId,
    creatureTypes,
    creatureSize,
    type: 'enemy' as const,
    showHpOnToken: true,
    showDetailOnToken: true,
  }
}

/** 写入 Token 的字段（避免循环依赖 maps.ts）。 */
export interface TokenFields {
  label: string
  emoji: string
  color: string
  maxHp?: number
  hp?: number
  size?: number
  poolId?: string
  visualVariantId?: string
  creatureTypes?: CreatureType[]
  creatureSize?: CreatureSize
  type: 'enemy'
  showHpOnToken?: boolean
  showDetailOnToken?: boolean
}
