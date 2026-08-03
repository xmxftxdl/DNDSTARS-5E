import { tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import { mapGeometryCanSeeToken, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterMechanicEffectV2,
  type Dnd5eMonsterMechanicTrigger,
  type Dnd5eMonsterMechanicTriggerEventV2,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterBehaviorPreferenceV1,
  type Dnd5eMonsterBehaviorStyle,
  type Dnd5eMonsterTargetingPreferenceV1,
  type Dnd5eMonsterTargetPriority,
} from './monsters'
import { dnd5eMonsterBerserkRule } from './monsterGenericAbilities'

export const DND5E_MONSTER_TARGET_PRIORITY_OPTIONS: readonly {
  value: Dnd5eMonsterTargetPriority
  label: string
  description: string
}[] = [
  { value: 'nearest', label: '距离最近', description: '优先选择占位边缘距离最近的敌对生物。' },
  { value: 'lowest-current-hp', label: '当前生命值最低', description: '优先攻击当前生命值数值最低的目标。' },
  { value: 'lowest-hp-percentage', label: '生命值百分比最低', description: '优先攻击剩余生命值比例最低的目标。' },
  { value: 'lowest-armor-class', label: 'AC 最低', description: '优先攻击当前护甲等级最低的目标。' },
  { value: 'highest-threat', label: '仇恨最高', description: '优先攻击对该怪物造成有效伤害最多的目标；DM 可以修改仇恨值。' },
]

const TARGET_PRIORITIES = new Set(DND5E_MONSTER_TARGET_PRIORITY_OPTIONS.map((entry) => entry.value))

export const DND5E_MONSTER_BEHAVIOR_STYLE_OPTIONS: readonly {
  value: Dnd5eMonsterBehaviorStyle
  label: string
  description: string
}[] = [
  { value: 'balanced', label: '均衡', description: '兼顾伤害、距离、掩护与借机攻击风险。' },
  { value: 'aggressive', label: '强攻', description: '更重视造成伤害、击倒目标与快速接敌，较少顾虑掩护。' },
  { value: 'defensive', label: '守势', description: '优先选择有掩护的合法落点，并更愿意闪避和规避借机攻击。' },
  { value: 'skirmisher', label: '游击', description: '保持武器有效距离，利用撤离和掩护进行移动后攻击。' },
  { value: 'cowardly', label: '惜命', description: '生命值降低时优先拉开距离、寻找掩护或闪避。' },
]

const BEHAVIOR_STYLES = new Set(DND5E_MONSTER_BEHAVIOR_STYLE_OPTIONS.map((entry) => entry.value))

export function normalizeDnd5eMonsterTargetingPreference(
  raw: unknown,
): Dnd5eMonsterTargetingPreferenceV1 | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<Dnd5eMonsterTargetingPreferenceV1>
  if (value.schemaVersion !== 1 || !TARGET_PRIORITIES.has(value.priority as Dnd5eMonsterTargetPriority)) return undefined
  return { schemaVersion: 1, priority: value.priority as Dnd5eMonsterTargetPriority }
}

export function normalizeDnd5eMonsterBehaviorPreference(
  raw: unknown,
): Dnd5eMonsterBehaviorPreferenceV1 | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<Dnd5eMonsterBehaviorPreferenceV1>
  if (value.schemaVersion !== 1 || !BEHAVIOR_STYLES.has(value.style as Dnd5eMonsterBehaviorStyle)) return undefined
  return { schemaVersion: 1, style: value.style as Dnd5eMonsterBehaviorStyle }
}

export function dnd5eMonsterEffectiveBehaviorStyle(
  enemy: Token,
  inferredRole: 'melee' | 'ranged' | 'skirmisher',
): Dnd5eMonsterBehaviorStyle {
  return normalizeDnd5eMonsterBehaviorPreference(enemy.dnd5eBehaviorPreference)?.style ??
    (inferredRole === 'melee' ? 'aggressive' : inferredRole === 'ranged' ? 'defensive' : 'skirmisher')
}

function targetHitPoints(token: Token, charactersById: ReadonlyMap<string, Character>): { current: number; maximum: number } {
  const character = token.characterId ? charactersById.get(token.characterId) : undefined
  const maximum = Math.max(1, Math.floor(character?.maxHp ?? token.maxHp ?? 1))
  return { current: Math.max(0, Math.min(maximum, Math.floor(character?.currentHp ?? token.hp ?? maximum))), maximum }
}

function targetArmorClass(token: Token, charactersById: ReadonlyMap<string, Character>): number {
  const character = token.characterId ? charactersById.get(token.characterId) : undefined
  if (character) return Math.max(0, character.ac)
  const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  return monster?.armorClass.value ?? 10
}

export function dnd5eMonsterEffectiveTargetPriority(
  monster: Dnd5eMonsterStatBlock,
  enemy: Token,
): Dnd5eMonsterTargetPriority {
  return normalizeDnd5eMonsterTargetingPreference(enemy.dnd5eTargetingPreference)?.priority ??
    monster.targetingPreference?.priority ?? 'nearest'
}

export function selectDnd5eMonsterPreferredTarget(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  characters?: readonly Character[]
}): Token | undefined {
  const { map, enemy, monster } = input
  const charactersById = new Map((input.characters ?? []).map((character) => [character.id, character]))
  const berserk = enemy.dnd5eCombatState?.monsterBerserk === true &&
    dnd5eMonsterBerserkRule(monster)?.target === 'nearest-visible-creature'
  const geometry = mapGeometryRuntimeForMap(map.id)
  const candidates = map.tokens.filter((token) =>
    token.id !== enemy.id && token.type !== 'obstacle' &&
    (berserk
      ? mapGeometryCanSeeToken({ geometry, map, viewer: enemy, target: token })
      : areOpposedCombatTokens(enemy, token)) &&
    targetHitPoints(token, charactersById).current > 0,
  )
  const priority = berserk ? 'nearest' : dnd5eMonsterEffectiveTargetPriority(monster, enemy)
  const threat = enemy.dnd5eCombatState?.monsterThreatByTargetId ?? {}
  const distance = (target: Token) => tokenFootprintDistanceCells(enemy, target, map)
  const primary = (target: Token): number => {
    const hp = targetHitPoints(target, charactersById)
    if (priority === 'lowest-current-hp') return hp.current
    if (priority === 'lowest-hp-percentage') return hp.current / hp.maximum
    if (priority === 'lowest-armor-class') return targetArmorClass(target, charactersById)
    if (priority === 'highest-threat') return -(threat[target.id] ?? 0)
    return distance(target)
  }
  return [...candidates].sort((left, right) =>
    primary(left) - primary(right) || distance(left) - distance(right) || left.id.localeCompare(right.id),
  )[0]
}

export interface Dnd5eMonsterMechanicRuntimeContext {
  combatId: string
  round: number
  actorId: string
  currentHp: number
  maxHp: number
  usedKeys?: Readonly<Record<string, string>>
  movementDistanceFeet?: number
}

export interface Dnd5eMonsterMechanicCompatibility {
  requested: 'full' | 'partial' | 'manual'
  effective: 'full' | 'partial' | 'manual'
  reasons: readonly string[]
}

export interface Dnd5eMonsterMechanicDiceRequirement {
  effectId: string
  effectName: string
  count: number
  sides: number
  bonus: number
}

export function dnd5eMonsterMechanicEvent(
  mechanic: Dnd5eMonsterMechanicTrigger,
): Dnd5eMonsterMechanicTriggerEventV2 {
  return mechanic.schemaVersion === 1 ? mechanic.event : mechanic.trigger.event
}

export function dnd5eMonsterMechanicEffects(
  mechanic: Dnd5eMonsterMechanicTrigger,
): readonly Dnd5eMonsterMechanicEffectV2[] {
  return mechanic.schemaVersion === 1
    ? [{ id: 'effect-0', kind: 'healing', target: 'self', dice: mechanic.effect.dice }]
    : mechanic.effects
}

export function dnd5eMonsterMechanicCompatibility(
  mechanic: Dnd5eMonsterMechanicTrigger,
): Dnd5eMonsterMechanicCompatibility {
  if (mechanic.schemaVersion === 1) return { requested: 'full', effective: 'full', reasons: [] }
  if (mechanic.automation === 'manual') {
    return { requested: 'manual', effective: 'manual', reasons: ['内容作者将该机制标记为 DM 裁定。'] }
  }
  const reasons: string[] = []
  const event = mechanic.trigger.event
  if (event === 'phase-transition') reasons.push('阶段切换需要即时阈值穿越检测和原子场景变更。')
  for (const effect of mechanic.effects) {
    if (effect.kind === 'summon') reasons.push('召唤效果需要 DM 或触发来源提供合法地图落点。')
    if (effect.kind === 'area-attack') reasons.push('范围攻击需要 DM 确认范围方向、覆盖格与目标集合。')
    if (
      (effect.kind === 'damage' || effect.kind === 'standard-condition' || effect.kind === 'remove-standard-condition' || effect.kind === 'roll-modifier' || effect.kind === 'attack') &&
      effect.target === 'damage-source' && event !== 'after-damaged'
    ) reasons.push('“伤害来源”只在受到伤害后的事件中存在。')
    if (
      (effect.kind === 'damage' || effect.kind === 'standard-condition' || effect.kind === 'remove-standard-condition' || effect.kind === 'roll-modifier' || effect.kind === 'attack') &&
      effect.target === 'trigger-target' &&
      !['after-hit', 'after-miss', 'when-hit', 'after-dealt-damage'].includes(event)
    ) reasons.push('该触发时机没有可绑定的攻击目标。')
    if (
      effect.kind === 'damage' && effect.damageType === 'inherit-trigger' &&
      event !== 'after-dealt-damage' && event !== 'after-damaged'
    ) reasons.push('继承伤害类型只能用于“造成伤害后”或“受到伤害后”。')
  }
  const requested = mechanic.automation
  const effective = requested === 'partial' || reasons.length > 0 ? 'partial' : 'full'
  return { requested, effective, reasons: [...new Set(reasons)] }
}

export function dnd5eMonsterMechanicLedgerKey(mechanicId: string): string {
  return `monster-mechanic:${mechanicId}`
}

export function dnd5eMonsterMechanicUsageValue(
  mechanic: Dnd5eMonsterMechanicTrigger,
  context: Pick<Dnd5eMonsterMechanicRuntimeContext, 'combatId' | 'round' | 'actorId'>,
): string {
  return mechanic.limit === 'once-per-combat'
    ? context.combatId
    : `${context.combatId}:${context.round}:${context.actorId}`
}

export function dnd5eEligibleMonsterMechanics(
  monster: Dnd5eMonsterStatBlock | undefined,
  event: Dnd5eMonsterMechanicTriggerEventV2,
  context: Dnd5eMonsterMechanicRuntimeContext,
): readonly Dnd5eMonsterMechanicTrigger[] {
  if (!monster || context.maxHp <= 0) return []
  const hpPercentage = context.currentHp / context.maxHp * 100
  return (monster.headlessMechanics ?? []).filter((mechanic) => {
    if (dnd5eMonsterMechanicEvent(mechanic) !== event) return false
    if (dnd5eMonsterMechanicCompatibility(mechanic).effective !== 'full') return false
    if (mechanic.schemaVersion === 2 && mechanic.trigger.event === 'movement') {
      const movement = mechanic.trigger.movement
      if (!movement || context.movementDistanceFeet == null) return false
      if (movement.comparison === 'at-least' && context.movementDistanceFeet < movement.feet) return false
      if (movement.comparison === 'at-most' && context.movementDistanceFeet > movement.feet) return false
    }
    const predicates = mechanic.predicates
    if (predicates.requiresPositiveHp && context.currentHp <= 0) return false
    if (predicates.hpPercentageAtOrBelow != null && hpPercentage > predicates.hpPercentageAtOrBelow) return false
    if (
      mechanic.schemaVersion === 2 && mechanic.predicates.hpPercentageAtOrAbove != null &&
      hpPercentage < mechanic.predicates.hpPercentageAtOrAbove
    ) return false
    if (mechanic.schemaVersion === 2) {
      const v2Predicates = mechanic.predicates
      if (v2Predicates.hpBelow != null && context.currentHp >= v2Predicates.hpBelow) return false
      if (v2Predicates.hpAtOrBelow != null && context.currentHp > v2Predicates.hpAtOrBelow) return false
      if (v2Predicates.hpAbove != null && context.currentHp <= v2Predicates.hpAbove) return false
      if (v2Predicates.hpAtOrAbove != null && context.currentHp < v2Predicates.hpAtOrAbove) return false
    }
    const previous = context.usedKeys?.[dnd5eMonsterMechanicLedgerKey(mechanic.id)]
    if (mechanic.limit === 'once-per-combat') return previous !== context.combatId
    if (mechanic.limit === 'once-per-turn') return previous !== dnd5eMonsterMechanicUsageValue(mechanic, context)
    return true
  })
}

export function dnd5eMonsterMechanicDiceRequirements(
  mechanic: Dnd5eMonsterMechanicTrigger,
): readonly Dnd5eMonsterMechanicDiceRequirement[] {
  return dnd5eMonsterMechanicEffects(mechanic).flatMap((effect) => {
    if (effect.kind !== 'healing' && effect.kind !== 'temporary-hit-points' && effect.kind !== 'damage' && effect.kind !== 'area-attack') return []
    return [{
      effectId: effect.id,
      effectName: effect.kind === 'healing' ? '治疗'
        : effect.kind === 'temporary-hit-points' ? '临时生命'
          : effect.kind === 'damage' ? '额外伤害' : '范围伤害',
      ...effect.dice,
    }]
  })
}

export function dnd5eEligibleMonsterTurnStartMechanics(
  monster: Dnd5eMonsterStatBlock | undefined,
  context: Dnd5eMonsterMechanicRuntimeContext,
): readonly Dnd5eMonsterMechanicTrigger[] {
  return dnd5eEligibleMonsterMechanics(monster, 'turn-start', context)
}
