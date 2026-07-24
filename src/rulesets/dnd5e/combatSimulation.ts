import type { AbilityKey } from '../../lib/dnd'
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
import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import {
  dnd5eSpellDiceCount,
  getDnd5eSrdCombatSpell,
  type Dnd5eSrdSpellDefinition,
} from './spells'
import {
  DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
  rankMonsterDecisionCandidates,
  type MonsterDecisionCandidate,
  type MonsterDecisionContext,
} from './monsterDecisionProvider'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'

export const DND5E_COMBAT_SIMULATION_MAX_TRIALS = 1_000

export interface Dnd5eCombatSimulationMonsterSelection {
  monsterId: string
  count: number
}

export interface Dnd5eCombatSimulationRequest {
  characters: readonly Character[]
  monsters: readonly Dnd5eCombatSimulationMonsterSelection[]
  customMonsters?: readonly Dnd5eMonsterStatBlock[]
  trials?: number
  seed?: number
  initialDistanceFeet?: number
  maxRounds?: number
}

export interface Dnd5eCombatSimulationRoundSummary {
  round: number
  appearances: number
  averagePlayerDamage: number
  averageMonsterDamage: number
  averagePlayerDeaths: number
  averageMonsterDeaths: number
}

export interface Dnd5eCombatSimulationActionUsage {
  actorName: string
  side: 'players' | 'monsters'
  actionId: string
  actionName: string
  uses: number
  attempts: number
  hits: number
  totalDamage: number
  usesPerTrial: number
  hitRate: number
  averageDamage: number
  headlessTransactions: number
}

export interface Dnd5eCombatSimulationDeathCause {
  victimName: string
  killerName: string
  actionName: string
  count: number
}

export interface Dnd5eCombatSimulationDecisionLog {
  round: number
  actorName: string
  targetName?: string
  actionName?: string
  candidateId: string
  score: number
  reasons: readonly string[]
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
  automatedMonsterSpells: number
  totalMonsterSpells: number
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
  roundSummaries: readonly Dnd5eCombatSimulationRoundSummary[]
  actionUsage: readonly Dnd5eCombatSimulationActionUsage[]
  deathCauses: readonly Dnd5eCombatSimulationDeathCause[]
  decisionLog: readonly Dnd5eCombatSimulationDecisionLog[]
  headlessTransactionCount: number
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
  spell?: {
    id: string
    effect: Dnd5eSrdSpellDefinition['effect']
    saveAbility?: AbilityKey
    saveDc?: number
    attackBonus?: number
    damageOnSuccessfulSave?: 'none' | 'half'
    dice: { count: number; sides: number; bonus: number }
    damageType?: Dnd5eDamageType
    rangeFeet: number
    slotLevel: number
    consumesSpellSlot: boolean
  }
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
  spellSlots: Map<number, number>
  savingThrowModifiers: Record<AbilityKey, number>
}

interface SimulationDecision {
  targetId?: string
  actionId?: string
  nextPosition: number
  dodges?: boolean
  dashes?: boolean
  candidateId?: string
  score?: number
  reasons?: readonly string[]
}

interface SimulationTelemetry {
  roundTotals: Map<number, {
    appearances: number
    playerDamage: number
    monsterDamage: number
    playerDeaths: number
    monsterDeaths: number
  }>
  actionUsage: Map<string, {
    actorName: string
    side: 'players' | 'monsters'
    actionId: string
    actionName: string
    uses: number
    attempts: number
    hits: number
    totalDamage: number
    headlessTransactions: number
  }>
  deathCauses: Map<string, Dnd5eCombatSimulationDeathCause>
  decisionLog: Dnd5eCombatSimulationDecisionLog[]
  headlessTransactionCount: number
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
  const weaponActions = monster.actions.flatMap((action) => {
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
        criticalThreshold: child.attack.criticalThreshold ?? 20,
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
  const spellActions = (monster.spellcasting?.spells ?? []).flatMap((listedSpell) => {
    const spell = getDnd5eSrdCombatSpell(listedSpell.id)
    if (
      !spell ||
      dnd5eMonsterCoreSpellCompatibility(spell).automation !== 'full' ||
      !['spell-attack', 'saving-throw', 'power-word-kill'].includes(spell.effect) ||
      !['hostile', 'creature'].includes(spell.target)
    ) return []
    const slotLevels = listedSpell.usage?.kind === 'at-will' || listedSpell.level === 0
      ? [listedSpell.level]
      : listedSpell.usage?.kind === 'per-day'
        ? [listedSpell.level]
        : Object.keys(monster.spellcasting?.slots ?? {})
            .map(Number)
            .filter((slotLevel) => slotLevel >= listedSpell.level)
    return slotLevels.map((slotLevel): SimulationAction => ({
      id: `spell:${spell.id}:${slotLevel}`,
      name: spell.name,
      parts: [],
      usage: listedSpell.usage?.kind === 'per-day'
        ? { kind: 'per-day', max: listedSpell.usage.max }
        : undefined,
      spell: {
        id: spell.id,
        effect: spell.effect,
        saveAbility: spell.saveAbility,
        saveDc: monster.spellcasting?.saveDc,
        attackBonus: monster.spellcasting?.attackBonus,
        damageOnSuccessfulSave: spell.damageOnSuccessfulSave,
        dice: {
          count: dnd5eSpellDiceCount(
            spell,
            Math.max(1, monster.spellcasting?.casterLevel ?? 1),
            slotLevel,
          ),
          sides: spell.dice.sides,
          bonus: spell.dice.bonus,
        },
        damageType: spell.damageType,
        rangeFeet: spell.rangeFeet,
        slotLevel,
        consumesSpellSlot: listedSpell.usage == null && listedSpell.level > 0,
      },
    }))
  })
  return [...weaponActions, ...spellActions]
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
  const actions = simulationMonsterActions(monster)
  const parts = actions.flatMap((action) => action.parts)
  const hasMelee = parts.some((part) => part.mode !== 'ranged')
  const hasRanged = parts.some((part) => part.mode !== 'melee' && (part.rangeFeet?.normal ?? 0) >= 20) ||
    actions.some((action) => (action.spell?.rangeFeet ?? 0) >= 20)
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
    spellSlots: new Map(),
    savingThrowModifiers: Object.fromEntries(
      Object.entries(character.abilities).map(([ability, score]) => [
        ability,
        rules.abilityModifier(score) +
          (character.savingThrows.includes(ability as AbilityKey)
            ? rules.proficiencyBonus(character.level)
            : 0),
      ]),
    ) as Record<AbilityKey, number>,
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
    spellSlots: new Map(Object.entries(monster.spellcasting?.slots ?? {})
      .map(([level, count]) => [Number(level), count])),
    savingThrowModifiers: Object.fromEntries(
      Object.entries(monster.abilities).map(([ability, score]) => [
        ability,
        monster.savingThrows?.[ability as AbilityKey] ?? rules.abilityModifier(score),
      ]),
    ) as Record<AbilityKey, number>,
  }
}

function actionMaximumRange(action: SimulationAction): number {
  if (action.spell) return action.spell.rangeFeet
  return Math.max(...action.parts.map((part) =>
    part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.long ?? part.reachFeet))
}

function actionNormalRange(action: SimulationAction): number {
  if (action.spell) return action.spell.rangeFeet
  return Math.max(...action.parts.map((part) =>
    part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.normal ?? part.reachFeet))
}

function actionExpectedDamage(
  action: SimulationAction,
  target: SimulationActor,
  distanceFeet: number,
  actorHpRatio = 1,
): {
  expectedDamage: number
  hitProbability: number
} | undefined {
  if (action.spell) {
    const spell = action.spell
    if (distanceFeet > spell.rangeFeet) return undefined
    if (spell.effect === 'power-word-kill') {
      return target.hp <= 100
        ? { expectedDamage: target.hp, hitProbability: 1 }
        : undefined
    }
    const average = spell.dice.count * (spell.dice.sides + 1) / 2 + spell.dice.bonus
    if (spell.effect === 'spell-attack' && spell.attackBonus != null) {
      const base = Math.max(0.05, Math.min(0.95, (21 + spell.attackBonus - target.ac) / 20))
      const hitProbability = distanceFeet <= 5 ? base ** 2 : base
      return { expectedDamage: average * hitProbability, hitProbability }
    }
    if (spell.effect === 'saving-throw' && spell.saveAbility && spell.saveDc != null) {
      const modifier = target.savingThrowModifiers[spell.saveAbility]
      const successProbability = Math.max(0.05, Math.min(0.95, (21 + modifier - spell.saveDc) / 20))
      const multiplier = 1 - successProbability +
        (spell.damageOnSuccessfulSave === 'half' ? successProbability / 2 : 0)
      return { expectedDamage: average * multiplier, hitProbability: 1 - successProbability }
    }
    return undefined
  }
  let expectedDamage = 0
  let totalProbability = 0
  for (const part of action.parts) {
    const maximum = part.mode === 'melee' ? part.reachFeet : part.rangeFeet?.long ?? 0
    if (distanceFeet > maximum) return undefined
    const base = Math.max(0.05, Math.min(0.95, (21 + part.toHit - target.ac) / 20))
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
  if (
    action.spell?.consumesSpellSlot &&
    (actor.spellSlots.get(action.spell.slotLevel) ?? 0) <= 0
  ) return false
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
        const attack = actionExpectedDamage(action, target, distance, actor.hp / actor.maxHp)
        if (!attack) continue
        const movementFeet = Math.abs(nextPosition - actor.position)
        const supportCount = opponents.filter((candidate) =>
          candidate.id !== target.id && Math.abs(nextPosition - candidate.position) <= 5).length
        candidates.push({
          id: `attack:${target.id}:${action.id}:${nextPosition}`,
          kind: action.spell
            ? movementFeet > 0
              ? distance > startDistance ? 'retreat-spell' : 'move-spell'
              : 'spell'
            : movementFeet > 0
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
            resourceCost: action.spell?.consumesSpellSlot
              ? action.spell.slotLevel * 3
              : action.usage ? 4 : 0,
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
  const ranked = rankMonsterDecisionCandidates(
    DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3,
    context,
    candidates,
  )[0]
  return ranked
    ? {
        ...ranked.candidate.payload,
        candidateId: ranked.candidate.id,
        score: ranked.score,
        reasons: ranked.reasons,
      }
    : { nextPosition: actor.position, dodges: true, candidateId: 'fallback:dodge', score: 0, reasons: ['没有可执行攻击，采取闪避。'] }
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

function synchronizeHeadlessActors(
  holder: { state: Dnd5eHeadlessCombatState },
  actors: readonly SimulationActor[],
): void {
  holder.state.distanceFeetByCombatantPair = {}
  for (const actor of actors) {
    const combatant = holder.state.combatants[actor.id]
    if (!combatant) continue
    combatant.currentHp = actor.hp
    combatant.maxHp = actor.maxHp
    combatant.position = { x: actor.position, y: 0 }
  }
  for (let left = 0; left < actors.length; left += 1) {
    for (let right = left + 1; right < actors.length; right += 1) {
      holder.state.distanceFeetByCombatantPair[
        dnd5eCombatantPairKey(actors[left].id, actors[right].id)
      ] = Math.abs(actors[left].position - actors[right].position)
    }
  }
}

function rollDamageGroups(
  parts: readonly SimulationAttackPart[],
  random: SeededRandom,
): readonly (readonly (readonly number[])[])[] {
  return parts.map((part) => part.damages.map((damage) =>
    Array.from({ length: damage.count }, () => random.die(damage.sides))))
}

function executeHeadlessWeaponAction(input: {
  actor: SimulationActor
  target: SimulationActor
  action: SimulationAction
  actors: SimulationActor[]
  holder: { state: Dnd5eHeadlessCombatState }
  random: SeededRandom
  disadvantaged: boolean
}): { handled: boolean; hits: number; damage: number; transactions: number } {
  const { actor, target, action, actors, holder, random } = input
  if (action.spell || action.parts.length === 0) {
    return { handled: false, hits: 0, damage: 0, transactions: 0 }
  }
  synchronizeHeadlessActors(holder, actors)
  const actorIndex = holder.state.initiativeOrder.indexOf(actor.id)
  if (actorIndex < 0) return { handled: false, hits: 0, damage: 0, transactions: 0 }
  holder.state.initiativeIndex = actorIndex
  const combatant = holder.state.combatants[actor.id]
  if (!combatant) return { handled: false, hits: 0, damage: 0, transactions: 0 }
  combatant.turn.actionAvailable = true
  combatant.turn.bonusActionAvailable = true
  combatant.turn.reactionAvailable = true
  combatant.turn.movementRemaining = actor.speed
  const hpBefore = target.hp
  let hits = 0
  let transactions = 0
  if (actor.monster) {
    const damageGroups = rollDamageGroups(action.parts, random)
    const result = resolveDnd5eHeadlessAction(holder.state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: action.id,
      rolls: action.parts.map((_, index) => ({
        targetId: target.id,
        d20: random.die(20),
        d20Second: input.disadvantaged ? random.die(20) : undefined,
        mode: input.disadvantaged ? 'disadvantage' : 'normal',
        damageRolls: damageGroups[index],
      })),
    }, {
      transactionId: `${holder.state.combatId}:${holder.state.round}:${actor.id}:${action.id}`,
      now: holder.state.round,
    })
    if (!result.ok) return { handled: false, hits: 0, damage: 0, transactions: 0 }
    holder.state = result.state
    hits = result.events.filter((event) => event.type === 'attack-resolved' && event.hit).length
    transactions = result.transaction?.status === 'committed' ? 1 : 0
  } else {
    let state = holder.state
    for (const [index, part] of action.parts.entries()) {
      const damage = part.damages[0]
      if (!damage) continue
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'attack',
        actorId: actor.id,
        targetId: target.id,
        attackModifier: part.toHit,
        criticalThreshold: part.criticalThreshold,
        d20: random.die(20),
        d20Second: input.disadvantaged ? random.die(20) : undefined,
        mode: input.disadvantaged ? 'disadvantage' : 'normal',
        spendAction: index === 0,
        damage: {
          ...damage,
          rolls: Array.from({ length: damage.count }, () => random.die(damage.sides)),
        },
      }, {
        transactionId: `${holder.state.combatId}:${holder.state.round}:${actor.id}:${action.id}:${index}`,
        now: holder.state.round,
      })
      if (!result.ok) return index === 0
        ? { handled: false, hits: 0, damage: 0, transactions: 0 }
        : { handled: true, hits, damage: Math.max(0, hpBefore - target.hp), transactions }
      state = result.state
      holder.state = state
      hits += result.events.some((event) => event.type === 'attack-resolved' && event.hit) ? 1 : 0
      if (result.transaction?.status === 'committed') transactions += 1
      const nextTargetHp = state.combatants[target.id]?.currentHp
      if (nextTargetHp != null && nextTargetHp <= 0) break
    }
  }
  for (const candidate of actors) {
    const resolved = holder.state.combatants[candidate.id]
    if (resolved) candidate.hp = Math.max(0, resolved.currentHp)
  }
  const resolvedActor = holder.state.combatants[actor.id]
  const actionUses = resolvedActor?.classState.monsterActionUsesByActionId?.[action.id]
  if (actionUses) actor.perDayUses.set(action.id, actionUses.current)
  const rechargeReady = resolvedActor?.classState.monsterRechargeReadyByActionId?.[action.id]
  if (rechargeReady != null) actor.rechargeReady.set(action.id, rechargeReady)
  return {
    handled: true,
    hits,
    damage: Math.max(0, hpBefore - target.hp),
    transactions,
  }
}

function executeHeadlessSpellAction(input: {
  actor: SimulationActor
  target: SimulationActor
  action: SimulationAction
  actors: readonly SimulationActor[]
  holder: { state: Dnd5eHeadlessCombatState }
  random: SeededRandom
  disadvantaged: boolean
}): { handled: boolean; hits: number; damage: number; transactions: number } {
  const { actor, target, action, actors, holder, random } = input
  const spell = action.spell
  if (!actor.monster || !spell) {
    return { handled: false, hits: 0, damage: 0, transactions: 0 }
  }
  synchronizeHeadlessActors(holder, actors)
  const actorIndex = holder.state.initiativeOrder.indexOf(actor.id)
  const combatant = holder.state.combatants[actor.id]
  if (actorIndex < 0 || !combatant) {
    return { handled: false, hits: 0, damage: 0, transactions: 0 }
  }
  holder.state.initiativeIndex = actorIndex
  combatant.turn.actionAvailable = true
  combatant.turn.bonusActionAvailable = true
  combatant.turn.reactionAvailable = true
  const targetCombatant = holder.state.combatants[target.id]
  if (targetCombatant) targetCombatant.dodging = input.disadvantaged
  const hpBefore = target.hp
  const effectRolls = ['spell-attack', 'saving-throw'].includes(spell.effect)
    ? [Array.from({ length: spell.dice.count }, () => random.die(spell.dice.sides))]
    : []
  const result = resolveDnd5eHeadlessAction(holder.state, {
    type: 'monster-core-spell',
    actorId: actor.id,
    spellId: spell.id,
    slotLevel: spell.slotLevel,
    resolution: {
      schemaVersion: 1,
      targetIds: [target.id],
      d20: spell.effect === 'spell-attack' ? random.die(20) : undefined,
      d20Second: spell.effect === 'spell-attack' && input.disadvantaged ? random.die(20) : undefined,
      targetSavingThrows: spell.effect === 'saving-throw'
        ? [{ targetId: target.id, d20: random.die(20), d20Second: random.die(20) }]
        : undefined,
      effectRolls,
    },
  }, {
    transactionId: `${holder.state.combatId}:${holder.state.round}:${actor.id}:${action.id}`,
    now: holder.state.round,
  })
  if (!result.ok) return { handled: false, hits: 0, damage: 0, transactions: 0 }
  holder.state = result.state
  for (const candidate of actors) {
    const resolved = holder.state.combatants[candidate.id]
    if (resolved) candidate.hp = Math.max(0, resolved.currentHp)
  }
  const resolvedActor = holder.state.combatants[actor.id]
  const listedSpellUses = resolvedActor?.classState.monsterSpellUsesBySpellId?.[spell.id]
  if (listedSpellUses) actor.perDayUses.set(action.id, listedSpellUses.current)
  const slot = resolvedActor?.classState.monsterSpellSlots?.[String(spell.slotLevel)]
  if (slot) actor.spellSlots.set(spell.slotLevel, slot.current)
  const hits = result.events.filter((event) =>
    (event.type === 'attack-resolved' && event.hit) ||
    (event.type === 'saving-throw-resolved' && !event.success)).length ||
    (hpBefore > target.hp ? 1 : 0)
  return {
    handled: true,
    hits,
    damage: Math.max(0, hpBefore - target.hp),
    transactions: result.transaction?.status === 'committed' ? 1 : 0,
  }
}

function executeAction(
  actor: SimulationActor,
  decision: SimulationDecision,
  actors: SimulationActor[],
  random: SeededRandom,
  dodgingIds: ReadonlySet<string>,
  headless: { state: Dnd5eHeadlessCombatState },
): { action?: SimulationAction; target?: SimulationActor; hits: number; damage: number; transactions: number } {
  actor.position = decision.nextPosition
  const action = actor.actions.find((candidate) => candidate.id === decision.actionId)
  let target = actors.find((candidate) => candidate.id === decision.targetId && candidate.hp > 0)
  if (!action || !target || !availableAction(actor, action)) {
    return { hits: 0, damage: 0, transactions: 0 }
  }
  const headlessSpellResult = executeHeadlessSpellAction({
    actor,
    target,
    action,
    actors,
    holder: headless,
    random,
    disadvantaged: dodgingIds.has(target.id),
  })
  if (headlessSpellResult.handled) return { action, target, ...headlessSpellResult }
  const headlessResult = executeHeadlessWeaponAction({
    actor,
    target,
    action,
    actors,
    holder: headless,
    random,
    disadvantaged: dodgingIds.has(target.id),
  })
  if (headlessResult.handled) return { action, target, ...headlessResult }
  if (action.usage?.kind === 'per-day') {
    actor.perDayUses.set(action.id, Math.max(0, (actor.perDayUses.get(action.id) ?? 0) - 1))
  }
  if (action.usage?.kind === 'recharge') actor.rechargeReady.set(action.id, false)
  if (action.spell?.consumesSpellSlot) {
    actor.spellSlots.set(
      action.spell.slotLevel,
      Math.max(0, (actor.spellSlots.get(action.spell.slotLevel) ?? 0) - 1),
    )
  }

  if (action.spell) {
    const spell = action.spell
    const distance = Math.abs(actor.position - target.position)
    if (distance > spell.rangeFeet) return { action, target, hits: 0, damage: 0, transactions: 0 }
    if (spell.effect === 'power-word-kill') {
      if (target.hp <= 100) {
        const dealt = target.hp
        target.hp = 0
        return { action, target, hits: 1, damage: dealt, transactions: 0 }
      }
      return { action, target, hits: 1, damage: 0, transactions: 0 }
    }
    let applies = false
    let halfDamage = false
    let critical = false
    if (spell.effect === 'spell-attack' && spell.attackBonus != null) {
      const disadvantaged = distance <= 5 || dodgingIds.has(target.id)
      const first = random.die(20)
      const second = disadvantaged ? random.die(20) : first
      const roll = disadvantaged ? Math.min(first, second) : first
      const attack = rules.resolveAttack({
        rolls: [roll],
        mode: 'normal',
        modifier: spell.attackBonus,
        targetAc: target.ac,
      })
      applies = attack.hit
      critical = attack.critical
    } else if (spell.effect === 'saving-throw' && spell.saveAbility && spell.saveDc != null) {
      const total = random.die(20) + target.savingThrowModifiers[spell.saveAbility]
      applies = total < spell.saveDc
      halfDamage = !applies && spell.damageOnSuccessfulSave === 'half'
    }
    if (!applies && !halfDamage) return { action, target, hits: 0, damage: 0, transactions: 0 }
    let rawDamage = spell.dice.bonus
    const count = spell.dice.count * (critical ? 2 : 1)
    for (let dieIndex = 0; dieIndex < count; dieIndex += 1) {
      rawDamage += random.die(spell.dice.sides)
    }
    if (halfDamage) rawDamage = Math.floor(rawDamage / 2)
    const dealt = applyDamage(target, rawDamage, spell.damageType ?? 'force')
    return { action, target, hits: applies ? 1 : 0, damage: dealt, transactions: 0 }
  }

  let hits = 0
  let totalDamage = 0
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
    hits += 1
    const critical = attack.critical || roll >= part.criticalThreshold
    const damages = actor.hp / actor.maxHp <= 0.5 && part.damagesAtHalfHp
      ? part.damagesAtHalfHp
      : part.damages
    for (const damage of damages) {
      let rawDamage = damage.bonus
      const count = damage.count * (critical ? 2 : 1)
      for (let dieIndex = 0; dieIndex < count; dieIndex += 1) rawDamage += random.die(damage.sides)
      const dealt = applyDamage(target, Math.max(0, rawDamage), damage.type)
      totalDamage += dealt
    }
  }
  return { action, target, hits, damage: totalDamage, transactions: 0 }
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
  telemetry: SimulationTelemetry,
  trialIndex: number,
): { winner: 'players' | 'monsters' | 'draw'; rounds: number } {
  const initiativeRolls = new Map(actors.map((actor) => [
    actor.id,
    random.die(20) + actor.initiativeBonus,
  ]))
  const initiative = [...actors].sort((left, right) =>
    (initiativeRolls.get(right.id) ?? 0) - (initiativeRolls.get(left.id) ?? 0) ||
    right.initiativeBonus - left.initiativeBonus ||
    left.id.localeCompare(right.id))
  const headless = {
    state: startDnd5eHeadlessCombat(
      `simulation:${trialIndex}`,
      initiative.map((actor) => createDnd5eCombatant({
        id: actor.id,
        name: actor.name,
        controller: actor.side === 'players' ? 'player' : 'dm',
        initiative: initiativeRolls.get(actor.id) ?? 0,
        abilities: actor.monster ? { ...actor.monster.abilities } : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        savingThrowBonuses: actor.savingThrowModifiers,
        proficiencyBonus: actor.monster ? rules.proficiencyBonus(Math.max(1, Number(actor.monster.challenge.rating) || 1)) : 2,
        armorClass: actor.ac,
        currentHp: actor.hp,
        maxHp: actor.maxHp,
        temporaryHp: 0,
        speed: actor.speed,
        position: { x: actor.position, y: 0 },
        concentrating: false,
        usesDeathSaves: false,
        classState: actor.monster ? {
          monsterRechargeReadyByActionId: Object.fromEntries(actor.actions.flatMap((action) =>
            action.usage?.kind === 'recharge' ? [[action.id, true]] : [])),
          monsterActionUsesByActionId: Object.fromEntries(actor.actions.flatMap((action) =>
            action.usage?.kind === 'per-day'
              ? [[action.id, { current: action.usage.max, max: action.usage.max }]]
              : [])),
          monsterSpellSlots: actor.monster.spellcasting?.slots
            ? Object.fromEntries(Object.entries(actor.monster.spellcasting.slots).map(([level, maximum]) => [
                level,
                { current: maximum, max: maximum },
              ]))
            : undefined,
          monsterSpellUsesBySpellId: actor.monster.spellcasting?.spells
            ? Object.fromEntries(actor.monster.spellcasting.spells.flatMap((spell) =>
                spell.usage?.kind === 'per-day'
                  ? [[spell.id, { current: spell.usage.max, max: spell.usage.max }]]
                  : []))
            : undefined,
        } : undefined,
        statBlockId: actor.monster?.id,
        creatureType: actor.monster?.creatureType,
        damageVulnerabilities: [...actor.vulnerabilities],
        damageResistances: [...actor.resistances],
        damageImmunities: [...actor.immunities],
        conditionImmunities: actor.monster?.conditionImmunities,
        magicResistance: actor.monster?.traits.some((trait) =>
          trait.automation === 'headless' && trait.rule?.kind === 'magic-resistance'),
      })),
    ),
  }
  const dodgingIds = new Set<string>()
  for (let round = 1; round <= maxRounds; round += 1) {
    headless.state.round = round
    const roundTotal = telemetry.roundTotals.get(round) ?? {
      appearances: 0,
      playerDamage: 0,
      monsterDamage: 0,
      playerDeaths: 0,
      monsterDeaths: 0,
    }
    roundTotal.appearances += 1
    telemetry.roundTotals.set(round, roundTotal)
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
      const selectedAction = actor.actions.find((action) => action.id === decision.actionId)
      const selectedTarget = actors.find((candidate) => candidate.id === decision.targetId)
      if (trialIndex === 0 && actor.side === 'monsters' && telemetry.decisionLog.length < 200) {
        telemetry.decisionLog.push({
          round,
          actorName: actor.name,
          targetName: selectedTarget?.name,
          actionName: selectedAction?.name,
          candidateId: decision.candidateId ?? 'unknown',
          score: decision.score ?? 0,
          reasons: decision.reasons ?? [],
        })
      }
      if (decision.dodges) dodgingIds.add(actor.id)
      const targetHpBefore = selectedTarget?.hp ?? 0
      const executed = executeAction(actor, decision, actors, random, dodgingIds, headless)
      actor.damageDealt += executed.damage
      if (executed.action) {
        const key = `${actor.side}:${actor.name}:${executed.action.id}`
        const usage = telemetry.actionUsage.get(key) ?? {
          actorName: actor.name,
          side: actor.side,
          actionId: executed.action.id,
          actionName: executed.action.name,
          uses: 0,
          attempts: 0,
          hits: 0,
          totalDamage: 0,
          headlessTransactions: 0,
        }
        usage.uses += 1
        usage.attempts += executed.action.spell ? 1 : executed.action.parts.length
        usage.hits += executed.hits
        usage.totalDamage += executed.damage
        usage.headlessTransactions += executed.transactions
        telemetry.actionUsage.set(key, usage)
        telemetry.headlessTransactionCount += executed.transactions
        if (actor.side === 'players') roundTotal.playerDamage += executed.damage
        else roundTotal.monsterDamage += executed.damage
      }
      if (executed.target && targetHpBefore > 0 && executed.target.hp <= 0 && executed.action) {
        if (executed.target.side === 'players') roundTotal.playerDeaths += 1
        else roundTotal.monsterDeaths += 1
        const key = `${executed.target.name}\u0000${actor.name}\u0000${executed.action.name}`
        const cause = telemetry.deathCauses.get(key) ?? {
          victimName: executed.target.name,
          killerName: actor.name,
          actionName: executed.action.name,
          count: 0,
        }
        cause.count += 1
        telemetry.deathCauses.set(key, cause)
      }
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
  const totalMonsterSpells = monsters.reduce((sum, monster) =>
    sum + (monster.spellcasting?.spells?.length ?? 0), 0)
  const automatedMonsterSpells = monsters.reduce((sum, monster) =>
    sum + (monster.spellcasting?.spells ?? []).filter((listedSpell) => {
      const spell = getDnd5eSrdCombatSpell(listedSpell.id)
      return !!spell &&
        dnd5eMonsterCoreSpellCompatibility(spell).automation === 'full' &&
        ['spell-attack', 'saving-throw', 'power-word-kill'].includes(spell.effect)
    }).length, 0)
  const playerBasicAttackProfiles = characters.filter((character) => !!dnd5eWeaponAttackProfile(character)).length
  const denominator = Math.max(1, totalMonsterActions + totalMonsterSpells + characters.length)
  return {
    playerBasicAttackProfiles,
    playerCount: characters.length,
    automatedMonsterActions,
    totalMonsterActions,
    automatedMonsterSpells,
    totalMonsterSpells,
    percentage: (
      automatedMonsterActions + automatedMonsterSpells + playerBasicAttackProfiles
    ) / denominator,
    limitations: [
      '模拟使用平均生命值、当前 AC、武器攻击、多重攻击、单体伤害法术、射程、豁免、抗性/免疫/易伤、再生、充能与每日次数。',
      '地图墙体、精确掩护、范围/专注/附带状态法术、传奇/巢穴动作、反应、死亡豁免和需 DM 裁定的能力暂不进入胜率。',
      '结果用于遭遇强度预估，不替代真实地图上的 Headless 权威战斗。',
    ],
  }
}

function configureSimulationMonsterCatalog(request: Dnd5eCombatSimulationRequest): void {
  setDnd5eRoomMonsterCatalog(request.customMonsters ?? [])
}

export function validateDnd5eCombatSimulationRequest(
  request: Dnd5eCombatSimulationRequest,
): readonly string[] {
  configureSimulationMonsterCatalog(request)
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
  configureSimulationMonsterCatalog(request)
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
  const telemetry: SimulationTelemetry = {
    roundTotals: new Map(),
    actionUsage: new Map(),
    deathCauses: new Map(),
    decisionLog: [],
    headlessTransactionCount: 0,
  }
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
    const outcome = simulateTrial(actors, random, maxRounds, telemetry, trial)
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
    roundSummaries: [...telemetry.roundTotals.entries()]
      .sort(([left], [right]) => left - right)
      .map(([round, total]) => ({
        round,
        appearances: total.appearances,
        averagePlayerDamage: total.playerDamage / Math.max(1, total.appearances),
        averageMonsterDamage: total.monsterDamage / Math.max(1, total.appearances),
        averagePlayerDeaths: total.playerDeaths / Math.max(1, total.appearances),
        averageMonsterDeaths: total.monsterDeaths / Math.max(1, total.appearances),
      })),
    actionUsage: [...telemetry.actionUsage.values()]
      .map((usage) => ({
        ...usage,
        usesPerTrial: usage.uses / trials,
        hitRate: usage.hits / Math.max(1, usage.attempts),
        averageDamage: usage.totalDamage / Math.max(1, usage.uses),
      }))
      .sort((left, right) => right.uses - left.uses || left.actorName.localeCompare(right.actorName, 'zh-CN')),
    deathCauses: [...telemetry.deathCauses.values()]
      .sort((left, right) => right.count - left.count || left.victimName.localeCompare(right.victimName, 'zh-CN')),
    decisionLog: telemetry.decisionLog,
    headlessTransactionCount: telemetry.headlessTransactionCount,
    coverage,
  }
}

/** 供 UI 使用的稳定、已翻译 SRD 目录。 */
export const DND5E_COMBAT_SIMULATION_MONSTERS = DND5E_SRD_MONSTERS
