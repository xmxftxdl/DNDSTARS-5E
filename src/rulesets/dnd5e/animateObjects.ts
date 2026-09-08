import type {
  Dnd5eAnimateObjectsDeclarationV1,
  Dnd5eAnimateObjectsResolutionV1,
} from '../../lib/sharedCombatTypes'
import type { Token } from '../../store/maps'
import type { Dnd5eMonsterStatBlock } from './monsters'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i

export type Dnd5eAnimatedObjectSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge'
export type Dnd5eAnimatedObjectMobility = 'walk' | 'fly-hover' | 'fixed'
export type Dnd5eAnimatedObjectDamageType = 'bludgeoning' | 'piercing' | 'slashing'

export interface Dnd5eAnimatedObjectProfile {
  size: Dnd5eAnimatedObjectSize
  mobility: Dnd5eAnimatedObjectMobility
  damageType: Dnd5eAnimatedObjectDamageType
  capacityCost: 1 | 2 | 4 | 8
  sizeLabel: '微型' | '小型' | '中型' | '大型' | '超大型'
  footprintSize: 1 | 2 | 3
  hitPoints: number
  armorClass: number
  attackBonus: number
  damageDice: { count: number; sides: number; bonus: number }
  strength: number
  dexterity: number
}

const PROFILES: Readonly<Record<Dnd5eAnimatedObjectSize, Omit<Dnd5eAnimatedObjectProfile, 'mobility' | 'damageType'>>> = {
  tiny: { size: 'tiny', capacityCost: 1, sizeLabel: '微型', footprintSize: 1, hitPoints: 20, armorClass: 18, attackBonus: 8, damageDice: { count: 1, sides: 4, bonus: 4 }, strength: 4, dexterity: 18 },
  small: { size: 'small', capacityCost: 1, sizeLabel: '小型', footprintSize: 1, hitPoints: 25, armorClass: 16, attackBonus: 6, damageDice: { count: 1, sides: 8, bonus: 2 }, strength: 6, dexterity: 14 },
  medium: { size: 'medium', capacityCost: 2, sizeLabel: '中型', footprintSize: 1, hitPoints: 40, armorClass: 13, attackBonus: 5, damageDice: { count: 2, sides: 6, bonus: 1 }, strength: 10, dexterity: 12 },
  large: { size: 'large', capacityCost: 4, sizeLabel: '大型', footprintSize: 2, hitPoints: 50, armorClass: 10, attackBonus: 6, damageDice: { count: 2, sides: 10, bonus: 2 }, strength: 14, dexterity: 10 },
  huge: { size: 'huge', capacityCost: 8, sizeLabel: '超大型', footprintSize: 3, hitPoints: 80, armorClass: 10, attackBonus: 8, damageDice: { count: 2, sides: 12, bonus: 4 }, strength: 18, dexterity: 6 },
}

const SIZE_FROM_TOKEN_FOOTPRINT: Readonly<Record<number, Dnd5eAnimatedObjectSize | 'gargantuan'>> = {
  1: 'medium',
  2: 'large',
  3: 'huge',
  4: 'gargantuan',
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function dnd5eAnimateObjectsCapacity(slotLevel: number): number {
  return Number.isInteger(slotLevel) && slotLevel >= 5 && slotLevel <= 9
    ? 10 + (slotLevel - 5) * 2
    : 0
}

export function dnd5eAnimateObjectsProfile(token: Token): Dnd5eAnimatedObjectProfile | undefined {
  if (token.type !== 'obstacle' || token.dnd5eSpellEffect) return undefined
  const state = normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState)
  if (state?.magical === true || state?.wornOrCarried === true) return undefined
  const configuredSize = state?.animateObjects?.size ??
    SIZE_FROM_TOKEN_FOOTPRINT[Math.max(1, Math.min(4, Math.round(token.size || 1)))] ?? 'medium'
  if (configuredSize === 'gargantuan') return undefined
  const base = PROFILES[configuredSize]
  return {
    ...base,
    mobility: state?.animateObjects?.mobility ?? 'walk',
    damageType: state?.animateObjects?.damageType ?? 'bludgeoning',
  }
}

export function dnd5eAnimateObjectsCapacityUsed(tokens: readonly Token[]): number {
  return tokens.reduce((total, token) => total + (dnd5eAnimateObjectsProfile(token)?.capacityCost ?? 0), 0)
}

export function dnd5eAnimateObjectsControlledCreature(token: Token, sourceCharacterId: string): boolean {
  const summon = token.dnd5eSummon
  return token.type === 'enemy' && (token.hp ?? token.maxHp ?? 0) > 0 &&
    summon?.featureId === 'spell:animate-objects' &&
    summon.sourceCharacterId === sourceCharacterId &&
    summon.concentrationId != null
}

export function normalizeDnd5eAnimateObjectsDeclarationV1(
  value: unknown,
): Dnd5eAnimateObjectsDeclarationV1 | undefined {
  const raw = record(value)
  if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.targets) || raw.targets.length < 1 || raw.targets.length > 18) {
    return undefined
  }
  const seen = new Set<string>()
  const targets: Dnd5eAnimateObjectsDeclarationV1['targets'] = []
  for (const entry of raw.targets) {
    const target = record(entry)
    const tokenId = typeof target?.tokenId === 'string' ? target.tokenId : ''
    const targetName = typeof target?.targetName === 'string'
      ? target.targetName.normalize('NFKC').trim().replace(/\s+/g, ' ')
      : ''
    if (!SAFE_ID.test(tokenId) || seen.has(tokenId) || !targetName || targetName.length > 160) return undefined
    seen.add(tokenId)
    targets.push({ tokenId, targetName })
  }
  return { schemaVersion: 1, targets }
}

export function normalizeDnd5eAnimateObjectsResolutionV1(
  value: unknown,
): Dnd5eAnimateObjectsResolutionV1 | undefined {
  const raw = record(value)
  if (!raw || raw.schemaVersion !== 1 || typeof raw.targetsConfirmed !== 'boolean') return undefined
  return { schemaVersion: 1, targetsConfirmed: raw.targetsConfirmed }
}

export function dnd5eAnimateObjectsMonsterId(profile: Dnd5eAnimatedObjectProfile): string {
  return `srd-5.1:animated-object:${profile.size}:${profile.mobility}:${profile.damageType}`
}

const ANIMATED_OBJECT_ID = /^srd-5\.1:animated-object:(tiny|small|medium|large|huge):(walk|fly-hover|fixed):(bludgeoning|piercing|slashing)$/

export function getDnd5eAnimateObjectsStatBlock(id: string): Dnd5eMonsterStatBlock | undefined {
  const match = ANIMATED_OBJECT_ID.exec(id)
  if (!match) return undefined
  const size = match[1] as Dnd5eAnimatedObjectSize
  const mobility = match[2] as Dnd5eAnimatedObjectMobility
  const damageType = match[3] as Dnd5eAnimatedObjectDamageType
  const profile: Dnd5eAnimatedObjectProfile = { ...PROFILES[size], mobility, damageType }
  const damageAverage = Math.floor(profile.damageDice.count * (profile.damageDice.sides + 1) / 2 + profile.damageDice.bonus)
  return {
    id,
    slug: `animated-object-${size}-${mobility}-${damageType}`,
    name: `${profile.sizeLabel}活化物件`,
    englishName: `${size} animated object`,
    source: 'SRD 5.1',
    size: profile.sizeLabel,
    creatureType: '构装体',
    alignment: '无阵营',
    armorClass: { value: profile.armorClass },
    hitPoints: { average: profile.hitPoints, dice: String(profile.hitPoints) },
    speed: mobility === 'walk'
      ? { walk: 30 }
      : mobility === 'fly-hover'
        ? { walk: 0, fly: 30, hover: true }
        : { walk: 0 },
    abilities: { str: profile.strength, dex: profile.dexterity, con: 10, int: 3, wis: 3, cha: 1 },
    senses: [{ name: '盲视', distanceFeet: 30 }],
    passivePerception: 6,
    languages: [],
    challenge: { rating: '0', xp: 0 },
    traits: [{
      name: '活化物件视觉',
      description: '该生物拥有 30 尺盲视，且无法看见该范围外的事物。',
      automation: 'headless',
    }],
    actions: [{
      id: 'slam',
      name: damageType === 'piercing' ? '刺击' : damageType === 'slashing' ? '斩击' : '猛击',
      description: `近战武器攻击：命中 +${profile.attackBonus}，触及 5 尺，单一目标。命中：${damageAverage}（${profile.damageDice.count}d${profile.damageDice.sides}${profile.damageDice.bonus ? ` + ${profile.damageDice.bonus}` : ''}）点${damageType === 'piercing' ? '穿刺' : damageType === 'slashing' ? '挥砍' : '钝击'}伤害。`,
      kind: 'weapon-attack',
      attack: {
        mode: 'melee',
        toHit: profile.attackBonus,
        target: 'one target',
        reachFeet: 5,
        damage: [{ average: damageAverage, ...profile.damageDice, type: damageType }],
      },
      automation: 'headless',
    }],
    capabilities: {
      swarm: false,
      shapechanger: false,
      regeneration: false,
      spellcaster: false,
      legendary: false,
      hasFlySpeed: mobility === 'fly-hover',
      hasSwimSpeed: false,
    },
    description: '由活化物件法术赋予生命的非魔法物件。',
  }
}
