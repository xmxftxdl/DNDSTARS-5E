import type {
  D20RollInput,
  D20RollResult,
  DamageAdjustment,
  DamageRollInput,
  DamageRollResult,
  DeathSaveState,
  RestingCreature,
  RulesetAdapter,
  SavingThrowResolution,
  ShortRestHitDieSpend,
  TurnEconomy,
  TurnResourceCost,
  TurnValidationResult,
} from '../contracts'

function integerInRange(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}`)
  }
  return value
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer`)
  return value
}

function requiredD20Count(mode: D20RollResult['mode']): number {
  return mode === 'normal' ? 1 : 2
}

function turnFailure(turn: TurnEconomy, cost: TurnResourceCost): TurnValidationResult['reason'] | undefined {
  const amount = cost.amount ?? 1
  nonNegativeInteger(amount, 'turn resource amount')
  if (cost.resource === 'action' && (!turn.actionAvailable || amount !== 1)) return 'action-unavailable'
  if (cost.resource === 'bonusAction' && (!turn.bonusActionAvailable || amount !== 1)) return 'bonus-action-unavailable'
  if (cost.resource === 'reaction' && (!turn.reactionAvailable || amount !== 1)) return 'reaction-unavailable'
  if (cost.resource === 'movement' && turn.movementRemaining < amount) return 'insufficient-movement'
  return undefined
}

function normalizeDeathSaveState(state: DeathSaveState): DeathSaveState {
  const successes = Math.min(3, nonNegativeInteger(state.successes, 'death save successes'))
  const failures = Math.min(3, nonNegativeInteger(state.failures, 'death save failures'))
  return {
    successes,
    failures,
    stable: state.stable || successes >= 3,
    dead: state.dead || failures >= 3,
    currentHp: Math.max(0, state.currentHp),
  }
}

export const dnd5e2014Adapter: RulesetAdapter = {
  id: 'dnd5e-2014-srd-5.1',
  name: 'D&D 5e 2014',
  version: '2014 / SRD 5.1',

  abilityModifier(score) {
    integerInRange(score, 1, 30, 'ability score')
    return Math.floor((score - 10) / 2)
  },

  proficiencyBonus(level) {
    integerInRange(level, 1, 20, 'level')
    return 2 + Math.floor((level - 1) / 4)
  },

  createTurn(speed) {
    nonNegativeInteger(speed, 'speed')
    return {
      actionAvailable: true,
      bonusActionAvailable: true,
      reactionAvailable: true,
      movementRemaining: speed,
    }
  },

  validateTurnCost(turn, cost) {
    const reason = turnFailure(turn, cost)
    return reason ? { valid: false, reason } : { valid: true }
  },

  spendTurnCost(turn, cost) {
    const validation = this.validateTurnCost(turn, cost)
    if (!validation.valid) throw new Error(validation.reason)
    const amount = cost.amount ?? 1
    if (cost.resource === 'action') return { ...turn, actionAvailable: false }
    if (cost.resource === 'bonusAction') return { ...turn, bonusActionAvailable: false }
    if (cost.resource === 'reaction') return { ...turn, reactionAvailable: false }
    return { ...turn, movementRemaining: turn.movementRemaining - amount }
  },

  resolveD20(input: D20RollInput): D20RollResult {
    const mode = input.mode ?? 'normal'
    const expected = requiredD20Count(mode)
    if (input.rolls.length !== expected) throw new RangeError(`${mode} requires exactly ${expected} d20 roll(s)`)
    const rolls = input.rolls.map((roll) => integerInRange(roll, 1, 20, 'd20 roll'))
    const d20 = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0]
    const modifier = input.modifier ?? 0
    return { d20, modifier, total: d20 + modifier, mode, naturalOne: d20 === 1, naturalTwenty: d20 === 20 }
  },

  resolveAttack(input) {
    nonNegativeInteger(input.targetAc, 'armor class')
    const roll = this.resolveD20(input)
    const hit = roll.naturalTwenty || (!roll.naturalOne && roll.total >= input.targetAc)
    return { roll, targetAc: input.targetAc, hit, critical: roll.naturalTwenty }
  },

  resolveSavingThrow(input): SavingThrowResolution {
    nonNegativeInteger(input.dc, 'difficulty class')
    const roll = this.resolveD20(input)
    return { roll, dc: input.dc, success: roll.total >= input.dc }
  },

  resolveDamage(input: DamageRollInput): DamageRollResult {
    const count = nonNegativeInteger(input.count, 'damage dice count')
    const sides = integerInRange(input.sides, 2, Number.MAX_SAFE_INTEGER, 'damage die sides')
    const critical = input.critical ?? false
    const expectedRolls = critical ? count * 2 : count
    if (input.rolls.length !== expectedRolls) {
      throw new RangeError(`damage roll requires exactly ${expectedRolls} roll(s)`)
    }
    const rolls = input.rolls.map((roll) => integerInRange(roll, 1, sides, 'damage die roll'))
    const diceTotal = rolls.reduce((sum, roll) => sum + roll, 0)
    const bonus = input.bonus ?? 0
    return { rolls, diceTotal, bonus, total: Math.max(0, diceTotal + bonus), critical }
  },

  adjustDamage(amount: number, adjustment: DamageAdjustment) {
    nonNegativeInteger(amount, 'damage')
    if (adjustment === 'resistance') return Math.floor(amount / 2)
    if (adjustment === 'vulnerability') return amount * 2
    return amount
  },

  concentrationCheckDc(damageTaken) {
    nonNegativeInteger(damageTaken, 'damage taken')
    return Math.max(10, Math.floor(damageTaken / 2))
  },

  takeShortRest(creature: RestingCreature, spending: readonly ShortRestHitDieSpend[]) {
    let currentHp = Math.min(creature.maxHp, Math.max(0, creature.currentHp))
    const hitDice = creature.hitDice.map((pool) => ({ ...pool }))
    for (const spend of spending) {
      const pool = hitDice.find((candidate) => candidate.sides === spend.sides)
      if (!pool || pool.current < spend.rolls.length) throw new Error(`insufficient d${spend.sides} Hit Point Dice`)
      for (const roll of spend.rolls) {
        integerInRange(roll, 1, spend.sides, `d${spend.sides} Hit Point Die roll`)
        currentHp = Math.min(creature.maxHp, currentHp + Math.max(0, roll + creature.constitutionModifier))
      }
      pool.current -= spend.rolls.length
    }
    return { ...creature, currentHp, hitDice }
  },

  takeLongRest(creature: RestingCreature) {
    let diceToRecover = Math.max(1, Math.floor(creature.hitDice.reduce((total, pool) => total + pool.max, 0) / 2))
    const hitDice = creature.hitDice.map((pool) => {
      const recovered = Math.min(pool.max - pool.current, diceToRecover)
      diceToRecover -= recovered
      return { ...pool, current: pool.current + recovered }
    })
    return {
      ...creature,
      currentHp: creature.maxHp,
      temporaryHp: 0,
      hitDice,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
    }
  },

  resolveDeathSave(state: DeathSaveState, d20: number) {
    const current = normalizeDeathSaveState(state)
    integerInRange(d20, 1, 20, 'death saving throw')
    if (current.dead || current.stable || current.currentHp > 0) return current
    if (d20 === 20) return { successes: 0, failures: 0, stable: false, dead: false, currentHp: 1 }
    const successes = Math.min(3, current.successes + (d20 >= 10 ? 1 : 0))
    const failures = Math.min(3, current.failures + (d20 === 1 ? 2 : d20 < 10 ? 1 : 0))
    return normalizeDeathSaveState({ ...current, successes, failures })
  },

  applyDamageAtZeroHp(state: DeathSaveState, criticalHit = false) {
    const current = normalizeDeathSaveState(state)
    if (current.dead || current.currentHp > 0) return current
    return normalizeDeathSaveState({ ...current, stable: false, failures: current.failures + (criticalHit ? 2 : 1) })
  },
}
