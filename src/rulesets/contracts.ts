export type RulesetId = 'dnd5e-2014-srd-5.1'

export type D20RollMode = 'normal' | 'advantage' | 'disadvantage'

export interface D20RollInput {
  rolls: readonly number[]
  modifier?: number
  mode?: D20RollMode
}

export interface D20RollResult {
  d20: number
  modifier: number
  total: number
  mode: D20RollMode
  naturalOne: boolean
  naturalTwenty: boolean
}

export interface DiceExpression {
  count: number
  sides: number
  bonus?: number
}

export interface DamageRollInput extends DiceExpression {
  rolls: readonly number[]
  critical?: boolean
}

export interface DamageRollResult {
  rolls: readonly number[]
  diceTotal: number
  bonus: number
  total: number
  critical: boolean
}

export type DamageAdjustment = 'normal' | 'resistance' | 'vulnerability'

export interface TurnEconomy {
  actionAvailable: boolean
  bonusActionAvailable: boolean
  reactionAvailable: boolean
  objectInteractionAvailable?: boolean
  movementRemaining: number
}

export type TurnResource = 'action' | 'bonusAction' | 'reaction' | 'objectInteraction' | 'movement'

export interface TurnResourceCost {
  resource: TurnResource
  amount?: number
}

export interface TurnValidationResult {
  valid: boolean
  reason?: 'action-unavailable' | 'bonus-action-unavailable' | 'reaction-unavailable' | 'object-interaction-unavailable' | 'insufficient-movement'
}

export interface HitDiePool {
  sides: number
  current: number
  max: number
}

export interface RestingCreature {
  currentHp: number
  maxHp: number
  constitutionModifier: number
  hitDice: readonly HitDiePool[]
  temporaryHp?: number
  deathSaveSuccesses?: number
  deathSaveFailures?: number
}

export interface ShortRestHitDieSpend {
  sides: number
  rolls: readonly number[]
}

export interface AttackResolution {
  roll: D20RollResult
  targetAc: number
  hit: boolean
  critical: boolean
}

export interface SavingThrowResolution {
  roll: D20RollResult
  dc: number
  success: boolean
}

export interface DeathSaveState {
  successes: number
  failures: number
  stable: boolean
  dead: boolean
  currentHp: number
}

export interface RulesetAdapter {
  readonly id: RulesetId
  readonly name: string
  readonly version: string
  abilityModifier(score: number): number
  proficiencyBonus(level: number): number
  createTurn(speed: number): TurnEconomy
  validateTurnCost(turn: TurnEconomy, cost: TurnResourceCost): TurnValidationResult
  spendTurnCost(turn: TurnEconomy, cost: TurnResourceCost): TurnEconomy
  resolveD20(input: D20RollInput): D20RollResult
  resolveAttack(input: D20RollInput & { targetAc: number }): AttackResolution
  resolveSavingThrow(input: D20RollInput & { dc: number }): SavingThrowResolution
  resolveDamage(input: DamageRollInput): DamageRollResult
  adjustDamage(amount: number, adjustment: DamageAdjustment): number
  concentrationCheckDc(damageTaken: number): number
  takeShortRest(creature: RestingCreature, spending: readonly ShortRestHitDieSpend[]): RestingCreature
  takeLongRest(creature: RestingCreature): RestingCreature
  resolveDeathSave(state: DeathSaveState, d20: number): DeathSaveState
  applyDamageAtZeroHp(state: DeathSaveState, criticalHit?: boolean): DeathSaveState
}
