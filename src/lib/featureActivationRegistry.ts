import type { Token } from '../store/maps'
import type { Character, ClassFeatureKey, Trait } from '../types/character'
import { ARCHER_FEATURE_ACTIVATION_CONTRACTS } from '../classes/archer/featureActivationContracts'
import type {
  HeadlessActivateFeatureAction,
  HeadlessCombatEvent,
  HeadlessCombatResult,
  HeadlessDiceRoller,
  HeadlessDmCombatState,
  HeadlessCombatFailureReason,
} from './headlessDmCombatEngine'

export type FeatureUiTone = 'amber' | 'sky' | 'rose' | 'fuchsia'

export interface FeatureStatusView {
  text: string
  tone: 'amber' | 'sky' | 'rose' | 'cyan' | 'lime' | 'emerald' | 'teal' | 'orange' | 'fuchsia'
}

export interface FeatureActivationButtonView {
  label: string
  disabled: boolean
  tone: FeatureUiTone
}

export interface FeaturePresentationView {
  statuses: FeatureStatusView[]
  activation?: FeatureActivationButtonView
  auxiliary?: 'wilderness-checks'
}

export interface FeatureActivationContract {
  key: ClassFeatureKey
  apCost: number
  resourceCost?: { key: string; amount: number }
  requiresUse: boolean
  toggleActive?: (character: Character) => boolean
  buildPresentation?: (character: Character, trait: Trait) => FeaturePresentationView
}

export interface HeadlessFeatureActivationContext {
  state: HeadlessDmCombatState
  action: HeadlessActivateFeatureAction
  actorToken: Token
  actor: Character
  trait: Trait
  dice: HeadlessDiceRoller
  events: HeadlessCombatEvent[]
  services: HeadlessFeatureActivationServices
}

export interface HeadlessFeatureActivationServices {
  fail(reason: HeadlessCombatFailureReason): HeadlessCombatResult
  succeed(): HeadlessCombatResult
  spendActorAp(amount: number): boolean
  updateCharacter(characterId: string, update: (character: Character) => Character): void
  updateToken(tokenId: string, update: (token: Token) => Token): void
  findCharacter(characterId: string): Character | undefined
  isTokenAlive(token: Token): boolean
  distanceFeet(left: Token, right: Token): number
  resolveIllusionDance(): HeadlessCombatResult
  resolveFinaleDamageValues(values: number[] | undefined, featureRank: number): number[] | null
  resolveFinaleTrigger(actor: Character, target: Token, values: number[]): void
}

export type HeadlessFeatureActivationResolver = (
  context: HeadlessFeatureActivationContext,
) => HeadlessCombatResult

const contracts = new Map<ClassFeatureKey, FeatureActivationContract>(
  ARCHER_FEATURE_ACTIVATION_CONTRACTS.map((contract) => [contract.key, contract]),
)
const resolvers = new Map<ClassFeatureKey, HeadlessFeatureActivationResolver>()

export function registerFeatureActivationContract(contract: FeatureActivationContract): () => void {
  const previous = contracts.get(contract.key)
  contracts.set(contract.key, contract)
  return () => {
    if (contracts.get(contract.key) !== contract) return
    if (previous) contracts.set(contract.key, previous)
    else contracts.delete(contract.key)
  }
}

export function featureActivationContract(key: ClassFeatureKey): FeatureActivationContract | undefined {
  return contracts.get(key)
}

export function registerHeadlessFeatureActivationResolver(
  key: ClassFeatureKey,
  resolver: HeadlessFeatureActivationResolver,
): () => void {
  const previous = resolvers.get(key)
  resolvers.set(key, resolver)
  return () => {
    if (resolvers.get(key) !== resolver) return
    if (previous) resolvers.set(key, previous)
    else resolvers.delete(key)
  }
}

export function headlessFeatureActivationResolver(
  key: ClassFeatureKey,
): HeadlessFeatureActivationResolver | undefined {
  return resolvers.get(key)
}

export function buildFeaturePresentation(character: Character, trait: Trait): FeaturePresentationView {
  if (!trait.featureKey) return { statuses: [] }
  return featureActivationContract(trait.featureKey)?.buildPresentation?.(character, trait) ?? { statuses: [] }
}
