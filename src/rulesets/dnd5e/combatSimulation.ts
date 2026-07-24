import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eAttacksPerAttackAction } from './classes'
import { dnd5eArmorClass, dnd5eWeaponAttackProfile } from './equipment'
import {
  DND5E_SRD_MONSTERS,
  getDnd5eSrdMonster,
  type Dnd5eDamageType,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterBehaviorStyle,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterTargetPriority,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import {
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  rankMonsterDecisionCandidates,
  type MonsterDecisionCandidate,
  type MonsterDecisionContext,
} from './monsterDecisionProvider'

export const DND5E_COMBAT_SIMULATION_MAX_TRIALS = 1_000

export interface Dnd5eCombatSimulationMonsterSelection {
  monsterId: string
  count: number
}

export interface Dnd5eCombatSimulationRequest {
  characters: readonly Character[]
  monsters: readonly Dnd5eCombatSimulationMonsterSelection[]
  trials?: number
  seed?: number
  initialDistanceFeet?: number
  maxRounds?: number
}

export interface Dnd5eCombatSimulationParticipantSummary {
  id: string
  name: string
  side: 'players' | 'monsters'
  appearances: number
  survivalRate: number
  averageDamage: number
  averageRemainingHp: number
}

export interface Dnd5eCombatSimulationCoverage {
  playerBasicAttackProfiles: number
  playerCount: number
  automatedMonsterActions: number
  totalMonsterActions: number
  percentage: number
  limitations: readonly string[]
}

export interface Dnd5eCombatSimulationResult {
  schemaVersion: 1
  trials: number
  seed: number
  playerWins: number
  monsterWins: number
  draws: number
  playerWinRate: number
  monsterWinRate: number
  drawRate: number
  playerWinRate95PercentInterval: { low: number; high: number }
  averageRounds: number
  averagePlayerSurvivors: number
  averageMonsterSurvivors: number
  participantSummaries: readonly Dnd5eCombatSimulationParticipantSummary[]
  coverage: Dnd5eCombatSimulationCoverage
}

interface SimulationAttackPart {
  toHit: number
  damages: readonly { count: number; sides: number; bonus: number; type: Dnd5eDamageType }[]
  damagesAtHalfHp?: readonly { count: number; sides: number; bonus: number; type: Dnd5eDamageType }[]
  criticalThreshold: number
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  reachFeet: number
  rangeFeet?: { normal: number; long: number }
}

interface SimulationAction {
  id: string
  name: string
  parts: readonly SimulationAttackPart[]
  usage?: Dnd5eMonsterAction['usage']
}

interface SimulationActor {
  id: string
  name: string
  side: 'players' | 'monsters'
  maxHp: number
  hp: number
  ac: number
  initiativeBonus: number
  speed: number
  position: number
  actions: readonly SimulationAction[]
  behaviorStyle: Dnd5eMonsterBehaviorStyle
  targetPriority: Dnd5eMonsterTargetPriority
  resistances: ReadonlySet<Dnd5eDamageType>
  vulnerabilities: ReadonlySet<Dnd5eDamageType>
  immunities: ReadonlySet<Dnd5eDamageType>
  monster?: Dnd5eMonsterStatBlock
  damageDealt: number
  damageTypesSinceTurn: Set<Dnd5eDamageType>
  perDayUses: Map<string, number>
  rechargeReady: Map<string, boolean>
}

interface SimulationDecision {
  targetId?: string
  actionId?: string
  nextPosition: number
  dodges?: boolean
  dashes?: boolean
}

interface SeededRandom {
  next(): number
  die(sides: number): number
}

function seededRandom(seed: number): SeededRandom {
  let state = (Math.floor(seed) || 1) >>> 0
  return {
    next() {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return (state >>> 0) / 0x1_0000_0000
    },
    die(sides) {
      return 1 + Math.floor(this.next() * Math.max(1, Math.floor(sides)))
    },
  }
}

function actionSequence(monster: Dnd5eMonsterStatBlock, action: Dnd5eMonsterAction): readonly Dnd5eMonsterAction[] {
  if (action.kind !== 'multiattack') return [action]
  return (action.sequence ?? []).flatMap((actionId) => {
    const child = monster.actions.find((candidate) => candidate.id === actionId)
    return child ? [child] : []
  })
}

function simulationMonsterActions(monster: Dnd5eMonsterStatBlock): SimulationAction[] {
  return monster.actions.flatMap((action) => {
    if (dnd5eMonsterActionAutomation(action) !== 'headless') return []
    const parts = actionSequence(monster, action).flatMap((child): SimulationAttackPart[] => {
      if (!child.attack) return []
      return [{
        toHit: child.attack!.toHit,
        damages: child.attack.damage.map((damage) => ({
          count: damage.count,
          sides: damage.sides,
          bonus: damage.bonus,
          type: damage.type,
        })),
        damagesAtHalfHp: child.attack.damageAtHalfHp?.map((damage) => ({
          count: damage.count,
          sides: damage.sides,
          bonus: damage.bonus,
          type: damage.type,
        })),
        criticalThreshold: 20,
        mode: child.attack!.mode,
        reachFeet: child.attack!.reachFeet ?? 5,
        rangeFeet: child.attack!.rangeFeet,
      }]
    })
    return parts.length > 0 ? [{
      id: action.id,
      name: action.name,
      parts,
      usage: action.usage,
    }] : []
  })
}

function simulationPlayerAction(character: Character): SimulationAction {
  const profile = dnd5eWeaponAttackProfile(character)
  const attacks = dnd5eAttacksPerAttackAction(character)
  if (!profile) {
    const strengthModifier = rules.abilityModifier(character.abilities.str)
    return {
      id: 'unarmed-strike',
      name: '徒手打击',
      parts: Array.from({ length: attacks }, () => ({
        toHit: strengthModifier + rules.proficiencyBonus(character.level),
        damages: [{ count: 0, sides: 4, bonus: Math.max(1, 1 + strengthModifier), type: 'bludgeoning' as const }],
        criticalThreshold: 20,
        mode: 'melee' as const,
        reachFeet: 5,
      })),
    }
  }
  return {
    id: profile.weaponId,
    name: profile.weaponName,
    parts: Array.from({ length: attacks }, () => ({
      toHit: profile.attackModifier,
      damages: [{ ...profile.damage }],
      criticalThreshold: profile.criticalThreshold,
      mode: profile.mode,
      reachFeet: profile.reachFeet ?? 5,
      rangeFeet: profile.rangeFeet,
    })),
  }
}

function inferMonsterStyle(monster: Dnd5eMonsterStatBlock): Dnd5eMonsterBehaviorStyle {
  const parts = simulationMonsterActions(monster).flatMap((action) => action.parts)
  const hasMelee = parts.some((part) => part.mode !== 'ranged')
  const hasRanged = parts.some((part) => part.mode !== 'melee' && (part.rangeFeet?.normal ?? 0) >= 20)
  if (hasMelee && hasRanged) return 'skirmisher'
  return hasRanged ? 'defensive' : 'aggressive'
}

function playerActor(character: Character): SimulationActor {
  return {
    id: `player:${character.id}`,
    name: character.name,
    side: 'players',
    maxHp: Math.max(1, Math.floor(character.maxHp)),
    hp: Math.max(1, Math.floor(character.maxHp)),
    ac: dnd5eArmorClass(character),
    initiativeBonus: rules.abilityModifier(character.abilities.dex) + character.initiativeBonus,
    speed: Math.max(0, character.speed),
    position: 0,
    actions: [simulationPlayerAction(character)],
    behaviorStyle: 'balanced',
    targetPriority: 'lowest-hp-percentage',
    resistances: new Set(),
    vulnerabilities: new Set(),
    immunities: new Set(),
    damageDealt: 0,
    damageTypesSinceTurn: new Set(),
    perDayUses: new Map(),
    rechargeReady: new Map(),
  }
}

function monsterActor(
  monster: Dnd5eMonsterStatBlock,
  index: number,
  initialDistanceFeet: number,
): SimulationActor {
  const actions = simulationMonsterActions(monster)
  return {
    id: `monster:${monster.id}:${index}`,
    name: monster.name,
    side: 'monsters',
    maxHp: Math.max(1, monster.hitPoints.average),
    hp: Math.max(1, monster.hitPoints.average),
    ac: monster.armorClass.value,
    initiativeBonus: rules.abilityModifier(monster.abilities.dex),
    speed: Math.max(monster.speed.walk, monster.speed.fly ?? 0, monster.speed.swim ?? 0),
    position: initialDistanceFeet,
    actions,
    behaviorStyle: inferMonsterStyle(monster),
    targetPriority: monster.targetingPreference?.priority ?? 'nearest',
    resistances: new Set(monster.damageResistances ?? []),
    vulnerabilities: new Set(monster.damageVulnerabilities ?? []),
    immunities: new Set(monster.damageImmunities ?? []),
    monster,
    damageDealt: 0,
    damageTypesSinceTurn: new Set(),
    perDayUses: new Map(actions.flatMap((action) =>
      action.usage?.kind === 'per-day' ? [[action.id, action.usage.max] as const] : [])),
    rechargeReady: new Map(actions.flatMap((action) =>
      action.usage?.kind === 'recharge' ? [[action.id, true] as const] : [])),
  }
}

function actionMaximumRange(action: SimulationAction): number {
  return Math.max(...action.parts.map((part) =>
    part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.long ?? part.reachFeet))
}

function actionNormalRange(action: SimulationAction): number {
  return Math.max(...action.parts.map((part) =>
    part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.normal ?? part.reachFeet))
}

function actionExpectedDamage(
  action: SimulationAction,
  targetAc: number,
  distanceFeet: number,
  actorHpRatio = 1,
): {
  expectedDamage: number
  hitProbability: number
} | undefined {
  let expectedDamage = 0
  let totalProbability = 0
  for (const part of action.parts) {
    const maximum = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.long ?? 0
    if (distanceFeet > maximum) return undefined
    const base = Math.max(0.05, Math.min(0.95, (21 + part.toHit - targetAc) / 20))
    const normal = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.normal ?? maximum
    const disadvantaged = distanceFeet > normal || (part.mode !== 'melee' && distanceFeet <= 5)
    const hitProbability = disadvantaged ? base ** 2 : base
    const damages = actorHpRatio <= 0.5 && part.damagesAtHalfHp
      ? part.damagesAtHalfHp
      : part.damages
    const average = damages.reduce((sum, damage) =>
      sum + damage.count * (damage.sides + 1) / 2 + damage.bonus, 0)
    expectedDamage += Math.max(0, average) * hitProbability
    totalProbability += hitProbability
  }
  return { expectedDamage, hitProbability: totalProbability / Math.max(1, action.parts.length) }
}

function targetPriorityWeight(
  actor: SimulationActor,
  target: SimulationActor,
  opponents: readonly SimulationActor[],
): number {
  const sorted = [...opponents].sort((left, right) => {
    const primary = (candidate: SimulationActor): number => {
      if (actor.targetPriority === 'lowest-current-hp') return candidate.hp
      if (actor.targetPriority === 'lowest-hp-percentage') return candidate.hp / candidate.maxHp
      if (actor.targetPriority === 'lowest-armor-class') return candidate.ac
      return Math.abs(actor.position - candidate.position)
    }
    return primary(left) - primary(right) ||
      Math.abs(actor.position - left.position) - Math.abs(actor.position - right.position) ||
      left.id.localeCompare(right.id)
  })
  const rank = sorted.findIndex((candidate) => candidate.id === target.id)
  return rank < 0 || opponents.length <= 1 ? 1 : 1 - rank / (opponents.length - 1)
}

function availableAction(actor: SimulationActor, action: SimulationAction): boolean {
  if (action.usage?.kind === 'per-day') return (actor.perDayUses.get(action.id) ?? 0) > 0
  if (action.usage?.kind === 'recharge') return actor.rechargeReady.get(action.id) !== false
  return true
}

function monsterDecision(actor: SimulationActor, opponents: readonly SimulationActor[]): SimulationDecision {
  const candidates: MonsterDecisionCandidate<SimulationDecision>[] = []
  const hasNimbleEscape = actor.monster?.traits.some((trait) =>
    trait.automation === 'headless' &&
    trait.rule?.kind === 'nimble-escape' &&
    trait.rule.bonusActionOptions.includes('disengage')) === true
  for (const target of opponents) {
    const startDistance = Math.abs(actor.position - target.position)
    for (const action of actor.actions.filter((candidate) => availableAction(actor, candidate))) {
      const preferred = Math.min(40, Math.max(5, actionNormalRange(action) / 2))
      const positions = new Set<number>([actor.position])
      const direction = target.position >= actor.position ? 1 : -1
      positions.add(actor.position + direction * Math.min(actor.speed, Math.max(0, startDistance - preferred)))
      if (actionNormalRange(action) > 5) positions.add(actor.position - direction * actor.speed)
      for (const nextPosition of positions) {
        const distance = Math.abs(nextPosition - target.position)
        const attack = actionExpectedDamage(action, target.ac, distance, actor.hp / actor.maxHp)
        if (!attack) continue
        const movementFeet = Math.abs(nextPosition - actor.position)
        const supportCount = opponents.filter((candidate) =>
          candidate.id !== target.id && Math.abs(nextPosition - candidate.position) <= 5).length
        candidates.push({
          id: `attack:${target.id}:${action.id}:${nextPosition}`,
          kind: movementFeet > 0
            ? distance > startDistance ? 'retreat-attack' : 'move-attack'
            : 'attack',
          payload: { targetId: target.id, actionId: action.id, nextPosition },
          metrics: {
            expectedDamage: attack.expectedDamage,
            targetCurrentHp: target.hp,
            targetMaximumHp: target.maxHp,
            targetArmorClass: target.ac,
            targetPriorityWeight: targetPriorityWeight(actor, target, opponents),
            targetSupportCount: supportCount,
            hitProbability: attack.hitProbability,
            targetDistanceFeet: distance,
            preferredDistanceFeet: preferred,
            movementFeet,
            distanceImprovementFeet: Math.max(0,
              Math.abs(startDistance - preferred) - Math.abs(distance - preferred)),
            defensiveCoverBonus: 0,
            opportunityAttackRisk: !hasNimbleEscape && movementFeet > 0 && startDistance <= 5 && distance > 5 ? 1 : 0,
            attacksThisTurn: true,
            consumesAction: true,
            dodges: false,
            dashes: false,
            usesNimbleEscape: hasNimbleEscape && movementFeet > 0 && startDistance <= 5 && distance > 5,
            usesPreciseCoverRoute: false,
            resourceCost: action.usage ? 4 : 0,
          },
        })
      }
    }
    const direction = target.position >= actor.position ? 1 : -1
    const nextPosition = actor.position + direction * actor.speed * 2
    candidates.push({
      id: `dash:${target.id}:${nextPosition}`,
      kind: 'dash',
      payload: { targetId: target.id, nextPosition, dashes: true },
      metrics: {
        expectedDamage: 0,
        targetCurrentHp: target.hp,
        targetMaximumHp: target.maxHp,
        targetArmorClass: target.ac,
        targetPriorityWeight: targetPriorityWeight(actor, target, opponents),
        hitProbability: 0,
        targetDistanceFeet: Math.abs(nextPosition - target.position),
        preferredDistanceFeet: 5,
        movementFeet: actor.speed * 2,
        distanceImprovementFeet: Math.min(actor.speed * 2, startDistance),
        defensiveCoverBonus: 0,
        opportunityAttackRisk: 0,
        attacksThisTurn: false,
        consumesAction: true,
        dodges: false,
        dashes: true,
        usesNimbleEscape: false,
        usesPreciseCoverRoute: false,
      },
    })
  }
  candidates.push({
    id: 'dodge',
    kind: 'dodge',
    payload: { nextPosition: actor.position, dodges: true },
    metrics: {
      expectedDamage: 0,
      targetCurrentHp: opponents[0]?.hp ?? 1,
      targetMaximumHp: opponents[0]?.maxHp ?? 1,
      hitProbability: 0,
      targetDistanceFeet: opponents[0] ? Math.abs(actor.position - opponents[0].position) : 0,
      preferredDistanceFeet: 5,
      movementFeet: 0,
      distanceImprovementFeet: 0,
      defensiveCoverBonus: 0,
      opportunityAttackRisk: 0,
      attacksThisTurn: false,
      consumesAction: true,
      dodges: true,
      dashes: false,
      usesNimbleEscape: false,
      usesPreciseCoverRoute: false,
    },
  })
  const context: MonsterDecisionContext = {
    monsterId: actor.monster?.id ?? actor.id,
    actorTokenId: actor.id,
    currentHp: actor.hp,
    maxHp: actor.maxHp,
    tacticalRole: actor.behaviorStyle === 'aggressive'
      ? 'melee'
      : actor.behaviorStyle === 'skirmisher' ? 'skirmisher' : 'ranged',
    behaviorStyle: actor.behaviorStyle,
  }
  return rankMonsterDecisionCandidates(
    DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
    context,
    candidates,
  )[0]?.candidate.payload ?? { nextPosition: actor.position, dodges: true }
}

function playerDecision(actor: SimulationActor, opponents: readonly SimulationActor[]): SimulationDecision {
  const target = [...opponents].sort((left, right) =>
    left.hp / left.maxHp - right.hp / right.maxHp ||
    Math.abs(actor.position - left.position) - Math.abs(actor.position - right.position) ||
    left.id.localeCompare(right.id))[0]
  if (!target) return { nextPosition: actor.position }
  const action = actor.actions[0]
  const maximum = actionMaximumRange(action)
  const distance = Math.abs(actor.position - target.position)
  const direction = target.position >= actor.position ? 1 : -1
  const movement = Math.min(actor.speed, Math.max(0, distance - maximum))
  const nextPosition = actor.position + direction * movement
  if (Math.abs(nextPosition - target.position) <= maximum) {
    return { targetId: target.id, actionId: action.id, nextPosition }
  }
  return { targetId: target.id, nextPosition: actor.position + direction * actor.speed * 2, dashes: true }
}

function applyDamage(target: SimulationActor, rawDamage: number, type: Dnd5eDamageType): number {
  let damage = Math.max(0, rawDamage)
  if (target.immunities.has(type)) damage = 0
  else if (target.resistances.has(type)) damage = Math.floor(damage / 2)
  else if (target.vulnerabilities.has(type)) damage *= 2
  target.hp = Math.max(0, target.hp - damage)
  if (damage > 0) target.damageTypesSinceTurn.add(type)
  return damage
}

function executeAction(
  actor: SimulationActor,
  decision: SimulationDecision,
  actors: SimulationActor[],
  random: SeededRandom,
  dodgingIds: ReadonlySet<string>,
): void {
  actor.position = decision.nextPosition
  const action = actor.actions.find((candidate) => candidate.id === decision.actionId)
  let target = actors.find((candidate) => candidate.id === decision.targetId && candidate.hp > 0)
  if (!action || !target || !availableAction(actor, action)) return
  if (action.usage?.kind === 'per-day') {
    actor.perDayUses.set(action.id, Math.max(0, (actor.perDayUses.get(action.id) ?? 0) - 1))
  }
  if (action.usage?.kind === 'recharge') actor.rechargeReady.set(action.id, false)

  for (const part of action.parts) {
    if (!target || target.hp <= 0) {
      target = actors.filter((candidate) => candidate.side !== actor.side && candidate.hp > 0)
        .sort((left, right) =>
          Math.abs(actor.position - left.position) - Math.abs(actor.position - right.position))[0]
    }
    if (!target) break
    const distance = Math.abs(actor.position - target.position)
    const maximum = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.long ?? 0
    if (distance > maximum) continue
    const normal = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.normal ?? maximum
    const disadvantage = distance > normal || (part.mode !== 'melee' && distance <= 5) || dodgingIds.has(target.id)
    const first = random.die(20)
    const second = disadvantage ? random.die(20) : first
    const roll = disadvantage ? Math.min(first, second) : first
    const attack = rules.resolveAttack({ rolls: [roll], mode: 'normal', modifier: part.toHit, targetAc: target.ac })
    if (!attack.hit) continue
    const critical = attack.critical || roll >= part.criticalThreshold
    const damages = actor.hp / actor.maxHp <= 0.5 && part.damagesAtHalfHp
      ? part.damagesAtHalfHp
      : part.damages
    for (const damage of damages) {
      let rawDamage = damage.bonus
      const count = damage.count * (critical ? 2 : 1)
      for (let dieIndex = 0; dieIndex < count; dieIndex += 1) rawDamage += random.die(damage.sides)
      const dealt = applyDamage(target, Math.max(0, rawDamage), damage.type)
      actor.damageDealt += dealt
    }
  }
}

function rechargeMonsterActions(actor: SimulationActor, random: SeededRandom): void {
  for (const action of actor.actions) {
    if (action.usage?.kind !== 'recharge' || actor.rechargeReady.get(action.id) !== false) continue
    actor.rechargeReady.set(action.id, random.die(action.usage.dieSides) >= action.usage.minimum)
  }
}

function regenerateMonster(actor: SimulationActor): void {
  const regeneration = actor.monster?.traits.find((trait) =>
    trait.automation === 'headless' && trait.rule?.kind === 'regeneration')?.rule
  if (!regeneration || regeneration.kind !== 'regeneration') {
    actor.damageTypesSinceTurn.clear()
    return
  }
  const suppressed = regeneration.suppressedByDamageTypes.some((type) =>
    actor.damageTypesSinceTurn.has(type))
  actor.damageTypesSinceTurn.clear()
  if (suppressed || (regeneration.requiresPositiveHp && actor.hp <= 0)) return
  actor.hp = Math.min(actor.maxHp, actor.hp + regeneration.amount)
}

function simulateTrial(
  actors: SimulationActor[],
  random: SeededRandom,
  maxRounds: number,
): { winner: 'players' | 'monsters' | 'draw'; rounds: number } {
  const initiativeRolls = new Map(actors.map((actor) => [
    actor.id,
    random.die(20) + actor.initiativeBonus,
  ]))
  const initiative = [...actors].sort((left, right) =>
    (initiativeRolls.get(right.id) ?? 0) - (initiativeRolls.get(left.id) ?? 0) ||
    right.initiativeBonus - left.initiativeBonus ||
    left.id.localeCompare(right.id))
  const dodgingIds = new Set<string>()
  for (let round = 1; round <= maxRounds; round += 1) {
    for (const actor of initiative) {
      if (actor.hp <= 0) continue
      dodgingIds.delete(actor.id)
      rechargeMonsterActions(actor, random)
      regenerateMonster(actor)
      const opponents = actors.filter((candidate) => candidate.side !== actor.side && candidate.hp > 0)
      if (opponents.length === 0) return { winner: actor.side, rounds: round }
      const decision = actor.side === 'monsters'
        ? monsterDecision(actor, opponents)
        : playerDecision(actor, opponents)
      if (decision.dodges) dodgingIds.add(actor.id)
      executeAction(actor, decision, actors, random, dodgingIds)
      const remainingOpponents = actors.some((candidate) => candidate.side !== actor.side && candidate.hp > 0)
      if (!remainingOpponents) return { winner: actor.side, rounds: round }
    }
  }
  return { winner: 'draw', rounds: maxRounds }
}

function wilson95(successes: number, total: number): { low: number; high: number } {
  if (total <= 0) return { low: 0, high: 0 }
  const z = 1.959963984540054
  const p = successes / total
  const denominator = 1 + z * z / total
  const center = (p + z * z / (2 * total)) / denominator
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) }
}

function simulationCoverage(
  characters: readonly Character[],
  monsters: readonly Dnd5eMonsterStatBlock[],
): Dnd5eCombatSimulationCoverage {
  const totalMonsterActions = monsters.reduce((sum, monster) => sum + monster.actions.length, 0)
  const automatedMonsterActions = monsters.reduce((sum, monster) =>
    sum + monster.actions.filter((action) =>
      dnd5eMonsterActionAutomation(action) === 'headless' && actionSequence(monster, action).some((child) => child.attack),
    ).length, 0)
  const playerBasicAttackProfiles = characters.filter((character) => !!dnd5eWeaponAttackProfile(character)).length
  const denominator = Math.max(1, totalMonsterActions + characters.length)
  return {
    playerBasicAttackProfiles,
    playerCount: characters.length,
    automatedMonsterActions,
    totalMonsterActions,
    percentage: (automatedMonsterActions + playerBasicAttackProfiles) / denominator,
    limitations: [
      '模拟使用平均生命值、当前 AC、武器攻击、多重攻击、射程、劣势、抗性/免疫/易伤、再生、充能与每日次数。',
      '地图墙体、精确掩护、法术选择、传奇/巢穴动作、反应、专注、死亡豁免和需 DM 裁定的能力暂不进入胜率。',
      '结果用于遭遇强度预估，不替代真实地图上的 Headless 权威战斗。',
    ],
  }
}

export function validateDnd5eCombatSimulationRequest(
  request: Dnd5eCombatSimulationRequest,
): readonly string[] {
  const errors: string[] = []
  if (request.characters.length === 0) errors.push('至少选择一名玩家角色。')
  if (request.characters.length > 8) errors.push('单次模拟最多选择 8 名玩家角色。')
  const count = request.monsters.reduce((sum, entry) => sum + Math.floor(entry.count), 0)
  if (count <= 0) errors.push('至少选择一只怪物。')
  if (count > 24) errors.push('单次模拟最多放入 24 只怪物。')
  for (const entry of request.monsters) {
    if (!getDnd5eSrdMonster(entry.monsterId)) errors.push(`找不到怪物：${entry.monsterId}`)
    if (!Number.isInteger(entry.count) || entry.count < 1 || entry.count > 12) {
      errors.push('每种怪物数量必须是 1 至 12 的整数。')
    }
  }
  const trials = request.trials ?? DND5E_COMBAT_SIMULATION_MAX_TRIALS
  if (!Number.isInteger(trials) || trials < 1 || trials > DND5E_COMBAT_SIMULATION_MAX_TRIALS) {
    errors.push(`模拟次数必须是 1 至 ${DND5E_COMBAT_SIMULATION_MAX_TRIALS} 的整数。`)
  }
  return [...new Set(errors)]
}

export function simulateDnd5eCombats(
  request: Dnd5eCombatSimulationRequest,
): Dnd5eCombatSimulationResult {
  const errors = validateDnd5eCombatSimulationRequest(request)
  if (errors.length > 0) throw new Error(errors.join(' '))
  const trials = Math.floor(request.trials ?? DND5E_COMBAT_SIMULATION_MAX_TRIALS)
  const seed = (Math.floor(request.seed ?? Date.now()) || 1) >>> 0
  const initialDistanceFeet = Math.max(5, Math.min(300, Math.floor(request.initialDistanceFeet ?? 30)))
  const maxRounds = Math.max(1, Math.min(100, Math.floor(request.maxRounds ?? 20)))
  const selectedMonsters = request.monsters.flatMap((entry) => {
    const monster = getDnd5eSrdMonster(entry.monsterId)!
    return Array.from({ length: entry.count }, () => monster)
  })
  const coverage = simulationCoverage(request.characters, selectedMonsters)
  const random = seededRandom(seed)
  let playerWins = 0
  let monsterWins = 0
  let draws = 0
  let totalRounds = 0
  let totalPlayerSurvivors = 0
  let totalMonsterSurvivors = 0
  const participantTotals = new Map<string, {
    name: string
    side: 'players' | 'monsters'
    appearances: number
    survivals: number
    damage: number
    remainingHp: number
  }>()

  for (let trial = 0; trial < trials; trial += 1) {
    const actors = [
      ...request.characters.map(playerActor),
      ...selectedMonsters.map((monster, index) => monsterActor(monster, index, initialDistanceFeet)),
    ]
    const outcome = simulateTrial(actors, random, maxRounds)
    if (outcome.winner === 'players') playerWins += 1
    else if (outcome.winner === 'monsters') monsterWins += 1
    else draws += 1
    totalRounds += outcome.rounds
    totalPlayerSurvivors += actors.filter((actor) => actor.side === 'players' && actor.hp > 0).length
    totalMonsterSurvivors += actors.filter((actor) => actor.side === 'monsters' && actor.hp > 0).length
    for (const actor of actors) {
      const key = actor.side === 'players'
        ? actor.id
        : `monster-summary:${actor.monster?.id ?? actor.name}`
      const total = participantTotals.get(key) ?? {
        name: actor.name,
        side: actor.side,
        appearances: 0,
        survivals: 0,
        damage: 0,
        remainingHp: 0,
      }
      total.appearances += 1
      total.survivals += actor.hp > 0 ? 1 : 0
      total.damage += actor.damageDealt
      total.remainingHp += actor.hp
      participantTotals.set(key, total)
    }
  }

  return {
    schemaVersion: 1,
    trials,
    seed,
    playerWins,
    monsterWins,
    draws,
    playerWinRate: playerWins / trials,
    monsterWinRate: monsterWins / trials,
    drawRate: draws / trials,
    playerWinRate95PercentInterval: wilson95(playerWins, trials),
    averageRounds: totalRounds / trials,
    averagePlayerSurvivors: totalPlayerSurvivors / trials,
    averageMonsterSurvivors: totalMonsterSurvivors / trials,
    participantSummaries: [...participantTotals.entries()].map(([id, total]) => ({
      id,
      name: total.name,
      side: total.side,
      appearances: total.appearances,
      survivalRate: total.survivals / total.appearances,
      averageDamage: total.damage / total.appearances,
      averageRemainingHp: total.remainingHp / total.appearances,
    })).sort((left, right) =>
      left.side.localeCompare(right.side) || right.averageDamage - left.averageDamage || left.name.localeCompare(right.name)),
    coverage,
  }
}

/** 供 UI 使用的稳定、已翻译 SRD 目录。 */
export const DND5E_COMBAT_SIMULATION_MONSTERS = DND5E_SRD_MONSTERS
